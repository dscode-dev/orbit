/// Estado da projeção de campo.
///
/// O dashboard é uma leitura simples. A fila é uma **máquina de páginas**: ela
/// acumula o que o servidor entregou, na ordem em que entregou, e sabe pedir a
/// próxima sem duplicar nem correr consigo mesma.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/contracts/mobile_field_contracts.dart';
import '../../operations/data/operations_repository.dart' show CachedResult;
import '../data/field_repository.dart';

/// Recorte de escopo do cache.
///
/// Usuário, organização e unidade. Sem isso, trocar de contexto serviria o
/// trabalho de outra unidade a partir do cache — o vazamento mais fácil de
/// cometer e o mais difícil de perceber.
String fieldScopeKey(Ref ref) {
  final session = ref.watch(sessionProvider);
  return [
    session?.user.id ?? 'anon',
    session?.organization?.id ?? 'sem-org',
    session?.businessUnitId ?? 'sem-unidade',
  ].join('.');
}

final fieldRepositoryProvider = Provider<FieldRepository>(
  (ref) => FieldRepository(
    client: ref.watch(apiClientProvider),
    cache: ref.watch(readCacheProvider),
  ),
);

/// O dia do profissional — uma requisição.
final fieldDashboardProvider =
    FutureProvider.autoDispose<CachedResult<MobileFieldDashboardContract>>((
      ref,
    ) {
      final scope = fieldScopeKey(ref);
      return ref.watch(fieldRepositoryProvider).dashboard(scopeKey: scope);
    });

/// O contexto de um item.
final fieldWorkItemProvider = FutureProvider.autoDispose
    .family<MobileFieldContextContract?, String>(
      (ref, id) => ref.watch(fieldRepositoryProvider).workItem(id),
    );

/* ------------------------------------------------------------------ */
/* Fila paginada                                                       */
/* ------------------------------------------------------------------ */

/// O que a tela da fila precisa saber.
class WorkQueueState {
  const WorkQueueState({
    this.items = const [],
    this.cursor,
    this.hasNextPage = false,
    this.isLoadingMore = false,
    this.error,
  });

  /// **Na ordem do servidor**, acumulada página a página.
  final List<MobileWorkItemContract> items;
  final String? cursor;
  final bool hasNextPage;
  final bool isLoadingMore;
  final Object? error;

  WorkQueueState copyWith({
    List<MobileWorkItemContract>? items,
    String? cursor,
    bool? hasNextPage,
    bool? isLoadingMore,
    Object? error,
    bool clearError = false,
  }) => WorkQueueState(
    items: items ?? this.items,
    cursor: cursor ?? this.cursor,
    hasNextPage: hasNextPage ?? this.hasNextPage,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    error: clearError ? null : (error ?? this.error),
  );
}

/// Filtro ativo da fila.
class WorkQueueFilter {
  const WorkQueueFilter({this.view = WorkQueueView.all, this.kind});

  final WorkQueueView view;
  final MobileWorkItemKind? kind;

  @override
  bool operator ==(Object other) =>
      other is WorkQueueFilter && other.view == view && other.kind == kind;

  @override
  int get hashCode => Object.hash(view, kind);
}

final workQueueFilterProvider = StateProvider.autoDispose<WorkQueueFilter>(
  (ref) => const WorkQueueFilter(),
);

class WorkQueueController extends StateNotifier<AsyncValue<WorkQueueState>> {
  WorkQueueController({
    required FieldRepository repository,
    required WorkQueueFilter filter,
  }) : _repository = repository,
       _filter = filter,
       super(const AsyncValue.loading()) {
    load();
  }

  final FieldRepository _repository;
  final WorkQueueFilter _filter;

  /// Guarda contra corrida de rolagem: enquanto uma página está no ar, outra
  /// não é pedida. Sem isso, um `scroll` rápido dispara a mesma página duas
  /// vezes e a lista ganha itens repetidos.
  bool _inFlight = false;

  /// Recomeça do zero — usado pelo pull-to-refresh e pela troca de filtro.
  Future<void> load() async {
    _inFlight = true;
    state = const AsyncValue.loading();
    try {
      final page = await _repository.workQueue(
        view: _filter.view,
        kind: _filter.kind,
      );
      state = AsyncValue.data(
        WorkQueueState(
          items: page.data,
          cursor: page.nextCursor,
          hasNextPage: page.hasNextPage,
        ),
      );
    } on Object catch (error, stack) {
      state = AsyncValue.error(error, stack);
    } finally {
      _inFlight = false;
    }
  }

  /// Próxima página, uma de cada vez.
  Future<void> loadMore() async {
    final current = state.valueOrNull;
    if (current == null || !current.hasNextPage || _inFlight) return;

    _inFlight = true;
    state = AsyncValue.data(
      current.copyWith(isLoadingMore: true, clearError: true),
    );
    try {
      final page = await _repository.workQueue(
        view: _filter.view,
        kind: _filter.kind,
        cursor: current.cursor,
      );
      state = AsyncValue.data(
        current.copyWith(
          items: mergeWorkItems(current.items, page.data),
          cursor: page.nextCursor,
          hasNextPage: page.hasNextPage,
          isLoadingMore: false,
        ),
      );
    } on Object catch (error) {
      /// A falha de uma página não descarta o que já está na tela: o
      /// profissional continua vendo a fila e pode tentar de novo.
      state = AsyncValue.data(
        current.copyWith(isLoadingMore: false, error: error),
      );
    } finally {
      _inFlight = false;
    }
  }
}

/// Junta a página nova à lista, **preservando a ordem** e sem repetir.
///
/// A identidade é o ID canônico do item — nunca nome de cliente ou de
/// equipamento, que se repetem legitimamente: o mesmo cliente tem vários
/// atendimentos no mesmo dia.
///
/// Reenviar o mesmo cursor devolve a mesma página; aqui isso vira operação
/// sem efeito, em vez de duplicata.
List<MobileWorkItemContract> mergeWorkItems(
  List<MobileWorkItemContract> current,
  List<MobileWorkItemContract> incoming,
) {
  final seen = current.map((item) => item.id).toSet();
  return [...current, ...incoming.where((item) => seen.add(item.id))];
}

final workQueueControllerProvider =
    StateNotifierProvider.autoDispose<
      WorkQueueController,
      AsyncValue<WorkQueueState>
    >((ref) {
      final filter = ref.watch(workQueueFilterProvider);
      return WorkQueueController(
        repository: ref.watch(fieldRepositoryProvider),
        filter: filter,
      );
    });

/* ------------------------------------------------------------------ */
/* Ponte agenda → item de trabalho                                     */
/* ------------------------------------------------------------------ */

/// De evento de agenda para item de trabalho.
///
/// A correspondência é publicada pelos dois lados: o item carrega
/// `schedulingId`, o evento carrega `eventId`. O app apenas casa os dois — não
/// remonta identidade, que é opaca por contrato.
///
/// Uma requisição indexa a fila inteira (o teto é 50). Nem todo evento tem
/// item: bloqueios de agenda e trabalho de outra pessoa existem legitimamente
/// no calendário e não viram fila de campo.
final agendaWorkItemIndexProvider =
    FutureProvider.autoDispose<Map<String, String>>((ref) async {
      final page = await ref
          .watch(fieldRepositoryProvider)
          .workQueue(limit: 50);
      return {
        for (final item in page.data)
          if (item.schedulingId case final String scheduling)
            scheduling: item.id,
      };
    });
