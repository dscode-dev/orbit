/// Meu Dia — a home do profissional em campo.
///
/// Uma requisição (`GET /mobile/field/dashboard`) responde às perguntas que
/// importam ao abrir o app: o que está em andamento, o que atrasou, o que é
/// para hoje e qual é o próximo. Antes desta PR a home fazia seis leituras
/// administrativas (`/analytics/dashboard`, `/operations` três vezes, agenda e
/// notificações) e ainda assim não respondia nenhuma delas diretamente.
///
/// Nada é contado nem classificado aqui: `counters`, `next`, `inProgress`,
/// `overdue` e `today` vêm prontos do MB-01.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../core/contracts/mobile_field_contracts.dart';
import '../../../core/routing/orbit_router.dart';
import '../../../core/theme/orbit_theme.dart';
import '../../../core/widgets/section_states.dart';
import '../application/field_providers.dart';
import 'widgets/work_item_card.dart';

class FieldDashboardScreen extends ConsumerWidget {
  const FieldDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(fieldDashboardProvider);
    final session = ref.watch(sessionProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Meu dia')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(fieldDashboardProvider),
        child: dashboard.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(OrbitSpacing.md),
            child: SectionLoading(lines: 6),
          ),
          error: (error, _) => ListView(
            padding: const EdgeInsets.all(OrbitSpacing.md),
            children: [
              SectionError(
                error: error,
                onRetry: () => ref.invalidate(fieldDashboardProvider),
              ),
            ],
          ),
          data: (result) => _Content(
            dashboard: result.value,
            cachedAt: result.cachedAt,
            currentUserId: session?.user.id,
          ),
        ),
      ),
    );
  }
}

class _Content extends StatelessWidget {
  const _Content({
    required this.dashboard,
    required this.cachedAt,
    required this.currentUserId,
  });

  final MobileFieldDashboardContract dashboard;
  final DateTime? cachedAt;
  final String? currentUserId;

  @override
  Widget build(BuildContext context) {
    final counters = dashboard.counters;
    final isEmpty =
        dashboard.inProgress.isEmpty &&
        dashboard.overdue.isEmpty &&
        dashboard.today.isEmpty &&
        dashboard.next == null;

    return ListView(
      padding: const EdgeInsets.all(OrbitSpacing.md),
      children: [
        if (cachedAt != null) StaleDataBanner(cachedAt: cachedAt!),

        _Counters(counters: counters),
        const SizedBox(height: OrbitSpacing.md),

        if (isEmpty)
          const SectionEmpty(
            icon: Icons.event_available_outlined,
            message: 'Nenhum atendimento programado para hoje.',
          ),

        /// Em andamento primeiro: é o trabalho que já começou, e é para ele
        /// que a pessoa volta ao abrir o app.
        _Group(
          title: 'Em andamento',
          items: dashboard.inProgress,
          currentUserId: currentUserId,
        ),

        /// O próximo é escolha do servidor. Só aparece quando não está já
        /// listado acima — repeti-lo seria ocupar a tela com o mesmo cartão.
        if (dashboard.next case final MobileWorkItemContract next
            when !dashboard.inProgress.any((item) => item.id == next.id))
          _Group(
            title: 'Próximo atendimento',
            items: [next],
            currentUserId: currentUserId,
          ),

        _Group(
          title: 'Atrasados',
          items: dashboard.overdue,
          currentUserId: currentUserId,
        ),
        _Group(
          title: 'Hoje',
          items: dashboard.today,
          currentUserId: currentUserId,
        ),

        const SizedBox(height: OrbitSpacing.sm),
        OutlinedButton.icon(
          onPressed: () => context.go(OrbitRoutes.workQueue),
          icon: const Icon(Icons.checklist_rtl),
          label: const Text('Ver toda a fila'),
          style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48)),
        ),
      ],
    );
  }
}

/// As quatro contagens do servidor.
class _Counters extends StatelessWidget {
  const _Counters({required this.counters});

  final MobileFieldCountersContract counters;

  @override
  Widget build(BuildContext context) {
    final entries = <(String, int, Color)>[
      ('Em andamento', counters.inProgress, OrbitColors.brandBright),
      ('Atrasados', counters.overdue, OrbitColors.danger),
      ('Hoje', counters.today, OrbitColors.warning),
      ('Próximos', counters.upcoming, OrbitColors.textSecondary),
    ];

    return Wrap(
      spacing: OrbitSpacing.sm,
      runSpacing: OrbitSpacing.sm,
      children: [
        for (final (label, value, color) in entries)
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: OrbitSpacing.md,
              vertical: OrbitSpacing.sm,
            ),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: OrbitRadius.field,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$value',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    color: OrbitColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _Group extends StatelessWidget {
  const _Group({
    required this.title,
    required this.items,
    required this.currentUserId,
  });

  final String title;
  final List<MobileWorkItemContract> items;
  final String? currentUserId;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(
            top: OrbitSpacing.sm,
            bottom: OrbitSpacing.xs,
          ),
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: OrbitColors.textSecondary,
            ),
          ),
        ),
        for (final item in items)
          WorkItemCard(
            key: ValueKey(item.id),
            item: item,
            currentUserId: currentUserId,
            onOpen: () => context.push(OrbitRoutes.workItemDetail(item.id)),
          ),
      ],
    );
  }
}
