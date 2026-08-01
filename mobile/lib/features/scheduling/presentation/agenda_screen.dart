/// Agenda operacional.
///
/// `GET /scheduling/agenda` com `view=DAY`. A navegação entre dias muda a
/// consulta — o backend é quem recorta o período.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/contracts/agenda_contracts.dart';
import '../../../core/theme/orbit_theme.dart';
import '../../../core/widgets/section_states.dart';
import '../../operations/data/operations_repository.dart';

/// Dia visível na agenda.
final agendaDateProvider = StateProvider.autoDispose<DateTime>((ref) {
  final now = DateTime.now();
  return DateTime(now.year, now.month, now.day);
});

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
            onPressed: () {
              final now = DateTime.now();
              ref.read(agendaDateProvider.notifier).state = DateTime(
                now.year,
                now.month,
                now.day,
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          _DayNavigator(date: date),
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
                        for (final event in events) _EventCard(event: event),
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

class _DayNavigator extends ConsumerWidget {
  const _DayNavigator({required this.date});

  final DateTime date;

  static const _months = [
    'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
    'jul', 'ago', 'set', 'out', 'nov', 'dez',
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    void shift(int days) {
      ref.read(agendaDateProvider.notifier).state = date.add(
        Duration(days: days),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: OrbitSpacing.md),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            onPressed: () => shift(-1),
            icon: const Icon(Icons.chevron_left),
            tooltip: 'Dia anterior',
          ),
          Text(
            '${date.day.toString().padLeft(2, '0')} de '
            '${_months[date.month - 1]} de ${date.year}',
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
          ),
          IconButton(
            onPressed: () => shift(1),
            icon: const Icon(Icons.chevron_right),
            tooltip: 'Próximo dia',
          ),
        ],
      ),
    );
  }
}

class _EventCard extends StatelessWidget {
  const _EventCard({required this.event});

  final AgendaEvent event;

  @override
  Widget build(BuildContext context) {
    final start = event.startsAt?.toLocal();
    final end = event.endsAt?.toLocal();
    String time(DateTime? value) => value == null
        ? '--:--'
        : '${value.hour.toString().padLeft(2, '0')}:'
              '${value.minute.toString().padLeft(2, '0')}';

    return Card(
      margin: const EdgeInsets.only(bottom: OrbitSpacing.sm),
      child: Padding(
        padding: const EdgeInsets.all(OrbitSpacing.md),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  time(start),
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: OrbitColors.brandBright,
                  ),
                ),
                Text(
                  time(end),
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
    );
  }
}
