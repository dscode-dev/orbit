/// Providers da Home.
///
/// Cada bloco tem o seu provider: uma falha de agenda não impede os KPIs de
/// aparecerem, e o `refresh` recarrega só o que interessa.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/contracts/agenda_contracts.dart';
import '../../../core/contracts/operation_contracts.dart';
import '../../authentication/domain/session.dart';
import '../../operations/data/operations_repository.dart';
import '../data/home_repository.dart';

/// Resumo do Analytics — só para quem tem `analytics.read` no plano.
final operationalSummaryProvider = FutureProvider.autoDispose<OperationalSummary?>(
  (ref) async {
    final session = ref.watch(sessionProvider);
    if (session == null || !session.hasCapability('analytics.read')) return null;
    return ref
        .watch(homeRepositoryProvider)
        .operationalSummary(businessUnitId: session.businessUnitId);
  },
);

/// Contagens por status, pedidas ao backend.
final statusCountsProvider = FutureProvider.autoDispose<List<StatusCount>>((
  ref,
) async {
  final session = ref.watch(sessionProvider);
  if (session == null) return const [];
  final repository = ref.watch(homeRepositoryProvider);
  final isOwner = session.profile == OrbitProfile.owner;

  // Operador vê o próprio trabalho; gestor vê a unidade.
  final assignedUserId = isOwner ? null : session.user.id;

  return Future.wait([
    repository.countByStatus(
      status: OperationStatus.open,
      businessUnitId: session.businessUnitId,
      assignedUserId: assignedUserId,
    ),
    repository.countByStatus(
      status: OperationStatus.inProgress,
      businessUnitId: session.businessUnitId,
      assignedUserId: assignedUserId,
    ),
    repository.countByStatus(
      status: OperationStatus.scheduled,
      businessUnitId: session.businessUnitId,
      assignedUserId: assignedUserId,
    ),
  ]);
});

/// Agendadas cujo prazo previsto já passou — contagem feita pelo servidor.
final overdueCountProvider = FutureProvider.autoDispose<StatusCount>((ref) async {
  final session = ref.watch(sessionProvider);
  if (session == null) {
    return const StatusCount(status: OperationStatus.scheduled, total: 0);
  }
  return ref
      .watch(homeRepositoryProvider)
      .countOverdue(
        status: OperationStatus.scheduled,
        businessUnitId: session.businessUnitId,
        assignedUserId: session.profile == OrbitProfile.owner
            ? null
            : session.user.id,
      );
});

/// Próximas operações do usuário (operador) ou da unidade (gestor).
final upcomingOperationsProvider =
    FutureProvider.autoDispose<CachedResult<Paginated<Operation>>>((ref) async {
      final session = ref.watch(sessionProvider);
      if (session == null) throw StateError('Sessão ausente');
      final isOwner = session.profile == OrbitProfile.owner;
      return ref
          .watch(operationsRepositoryProvider)
          .list(
            OperationQuery(
              assignedUserId: isOwner ? null : session.user.id,
              businessUnitId: session.businessUnitId,
              limit: 5,
            ),
          );
    });

/// Agenda do dia.
final todayAgendaProvider = FutureProvider.autoDispose<CachedResult<Agenda>>((
  ref,
) async {
  final session = ref.watch(sessionProvider);
  if (session == null) throw StateError('Sessão ausente');
  return ref
      .watch(agendaRepositoryProvider)
      /// Sem data: "hoje" é o dia da **unidade**, resolvido pelo servidor.
      .load(view: 'DAY', businessUnitId: session.businessUnitId);
});

/// Alertas não lidos do usuário.
final alertsProvider = FutureProvider.autoDispose<List<OrbitNotification>>(
  (ref) => ref.watch(homeRepositoryProvider).alerts(),
);
