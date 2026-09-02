/// Agenda operacional.
///
/// `GET /scheduling/agenda` com `view=DAY`. A navegação entre dias muda a
/// consulta — o backend é quem recorta o período.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../core/contracts/agenda_contracts.dart';
import '../../../core/time/civil_time.dart';
import '../../../core/presentation/orbit_format.dart';
import '../../../core/theme/orbit_theme.dart';
import '../../../core/widgets/section_states.dart';
import '../../../core/routing/orbit_router.dart';
import '../../field/application/field_providers.dart';
import '../../operations/data/operations_repository.dart';

/// Dia visível na agenda.
///
/// `null` significa **hoje**, e é o servidor quem diz qual dia é esse — no
/// fuso da unidade. Só quando o usuário navega a tela passa a carregar uma
/// data civil escolhida.
final agendaDateProvider = StateProvider.autoDispose<CivilDate?>((ref) => null);

final agendaProvider = FutureProvider.autoDispose<CachedResult<Agenda>>((
  ref,
) async {
  final date = ref.watch(agendaDateProvider);
  final session = ref.watch(sessionProvider);
  return ref
      .watch(agendaRepositoryProvider)
      .load(view: 'DAY', date: date, businessUnitId: session?.businessUnitId);
});

class AgendaScreen extends ConsumerWidget {
  const AgendaScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final date = ref.watch(agendaDateProvider);
    final agenda = ref.watch(agendaProvider);
    final session = ref.watch(sessionProvider);

    /// Índice evento → item de campo. Vazio enquanto carrega ou quando a fila
    /// não tem nada correspondente; nesse caso o cartão fica sem toque.
    final workItems =
        ref.watch(agendaWorkItemIndexProvider).valueOrNull ??
        const <String, String>{};

    // A agenda depende do módulo de scheduling no plano.
    if (session != null && !session.hasCapability('scheduling.read')) {
      return Scaffold(
        appBar: AppBar(title: const Text('Agenda')),
        body: const Padding(
          padding: EdgeInsets.all(OrbitSpacing.lg),
          child: SectionEmpty(
            icon: Icons.lock_outline,
            message:
                'O plano da organização não inclui o módulo de agendamento.',
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Agenda'),
        actions: [
          IconButton(
            tooltip: 'Hoje',
            icon: const Icon(Icons.today),

            /// Voltar para "hoje" é **esquecer** a data escolhida, não
            /// calcular uma nova: quem sabe que dia é hoje na unidade é o
            /// servidor.
            onPressed: () => ref.read(agendaDateProvider.notifier).state = null,
          ),
        ],
      ),
      body: Column(
        children: [
          _DayNavigator(
            selected: date,
            shown: agenda.valueOrNull?.value.civilDate,
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(agendaProvider),
              child: agenda.when(
                loading: () => const Padding(
                  padding: EdgeInsets.all(OrbitSpacing.md),
                  child: SectionLoading(lines: 5),
                ),
                error: (error, _) => ListView(
                  padding: const EdgeInsets.all(OrbitSpacing.md),
                  children: [
                    SectionError(
                      error: error,
                      onRetry: () => ref.invalidate(agendaProvider),
                    ),
                  ],
                ),
                data: (result) {
                  final events = result.value.events;
                  return ListView(
                    padding: const EdgeInsets.all(OrbitSpacing.md),
                    children: [
                      if (result.cachedAt != null)
                        StaleDataBanner(cachedAt: result.cachedAt!),
                      if (events.isEmpty)
                        const SectionEmpty(
                          icon: Icons.event_available_outlined,
                          message: 'Nenhum compromisso neste dia.',
                        )
                      else ...[
                        Padding(
                          padding: const EdgeInsets.only(
                            bottom: OrbitSpacing.sm,
                          ),
                          child: Text(
                            '${result.value.total} compromisso(s)',
                            style: const TextStyle(
                              fontSize: 12,
                              color: OrbitColors.textSecondary,
                            ),
                          ),
                        ),
                        for (final event in events)
                          _EventCard(
                            event: event,
                            workItemId: workItems[event.eventId],
                          ),
                      ],
                    ],
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Navegação por dia.
///
/// O rótulo e o ponto de partida vêm do **servidor**: `shown` é a data civil
/// que ele resolveu no fuso da unidade. Enquanto ela não chega, as setas ficam
/// desabilitadas — avançar a partir de um palpite do aparelho é justamente
/// como se erra o dia.
class _DayNavigator extends ConsumerWidget {
  const _DayNavigator({required this.selected, required this.shown});

  /// O dia escolhido pelo usuário; `null` enquanto ele estiver vendo "hoje".
  final CivilDate? selected;

  /// O dia que o servidor devolveu nesta resposta.
  final CivilDate? shown;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final anchor = selected ?? shown;

    void shift(int days) {
      if (anchor == null) return;
      ref.read(agendaDateProvider.notifier).state = anchor.addDays(days);
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: OrbitSpacing.md),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            onPressed: anchor == null ? null : () => shift(-1),
            icon: const Icon(Icons.chevron_left),
            tooltip: 'Dia anterior',
          ),
          Text(
            anchor == null ? 'Hoje' : OrbitFormat.fullDate(anchor),
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
          ),
          IconButton(
            onPressed: anchor == null ? null : () => shift(1),
            icon: const Icon(Icons.chevron_right),
            tooltip: 'Próximo dia',
          ),
        ],
      ),
    );
  }
}

/// Um compromisso do dia.
///
/// Quando o evento corresponde a um item de campo, tocar abre **o item** — não
/// uma tela paralela de agenda. O item de trabalho é o ponto de entrada
/// operacional; a agenda é a projeção temporal dele.
class _EventCard extends StatelessWidget {
  const _EventCard({required this.event, this.workItemId});

  final AgendaEvent event;

  /// `null` quando o evento não é trabalho de campo desta pessoa.
  final String? workItemId;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: OrbitSpacing.sm),
      child: InkWell(
        onTap: workItemId == null
            ? null
            : () => context.push(OrbitRoutes.workItemDetail(workItemId!)),
        borderRadius: OrbitRadius.card,
        child: Padding(
          padding: const EdgeInsets.all(OrbitSpacing.md),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    OrbitFormat.hourOf(event.startsAt),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: OrbitColors.brandBright,
                    ),
                  ),
                  Text(
                    OrbitFormat.hourOf(event.endsAt),
                    style: const TextStyle(
                      fontSize: 11,
                      color: OrbitColors.textSecondary,
                    ),
                  ),
                ],
              ),
              const SizedBox(width: OrbitSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      event.title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [
                        if (event.type != null) event.type!,
                        event.status,
                      ].join(' · '),
                      style: const TextStyle(
                        fontSize: 11,
                        color: OrbitColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
