/// Home.
///
/// Duas leituras do mesmo ambiente, escolhidas pelo perfil derivado das
/// permissões:
///
/// - **Operator** — o próprio trabalho: o que está em execução, o que vem a
///   seguir, a agenda do dia e os alertas.
/// - **Owner** — a unidade: KPIs do Analytics, volumes por status, prazo
///   vencido, agenda e alertas.
///
/// Nenhum número é calculado aqui. Ou veio de um Read Model do Analytics, ou é
/// o `total` que o backend devolveu ao contar a própria consulta.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../core/contracts/agenda_contracts.dart';
import '../../../core/routing/orbit_router.dart';
import '../../../core/theme/orbit_theme.dart';
import '../../../core/widgets/orbit_brand.dart';
import '../../../core/widgets/section_states.dart';
import '../../authentication/domain/session.dart';
import '../../operations/presentation/widgets/operation_tile.dart';
import '../application/home_providers.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    if (session == null) return const SizedBox.shrink();
    final isOwner = session.profile == OrbitProfile.owner;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: OrbitSpacing.md,
        title: Row(
          children: [
            const OrbitSymbol(size: 30),
            const SizedBox(width: OrbitSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    isOwner ? 'Visão Geral' : 'Início',
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    session.businessUnit?.name ??
                        session.organization?.displayName ??
                        '',
                    style: const TextStyle(
                      fontSize: 12,
                      color: OrbitColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref
            ..invalidate(operationalSummaryProvider)
            ..invalidate(statusCountsProvider)
            ..invalidate(overdueCountProvider)
            ..invalidate(upcomingOperationsProvider)
            ..invalidate(todayAgendaProvider)
            ..invalidate(alertsProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(OrbitSpacing.md),
          children: [
            _Greeting(name: session.user.displayName),
            const SizedBox(height: OrbitSpacing.md),

            if (isOwner) ...[
              const _OwnerIndicators(),
              const SizedBox(height: OrbitSpacing.md),
            ],

            const _StatusCounts(),
            const SizedBox(height: OrbitSpacing.md),

            const _UpcomingOperations(),
            const SizedBox(height: OrbitSpacing.md),

            const _TodayAgenda(),
            const SizedBox(height: OrbitSpacing.md),

            const _Alerts(),
            const SizedBox(height: OrbitSpacing.xl),
          ],
        ),
      ),
    );
  }
}

class _Greeting extends StatelessWidget {
  const _Greeting({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? 'Bom dia'
        : hour < 18
            ? 'Boa tarde'
            : 'Boa noite';
    return Text(
      '$greeting, ${name.split(' ').first}',
      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
    );
  }
}

/// KPIs do Analytics — apenas quando o plano libera `analytics.read`.
class _OwnerIndicators extends ConsumerWidget {
  const _OwnerIndicators();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(operationalSummaryProvider);

    return SectionCard(
      title: 'Indicadores',
      subtitle: 'Read Model do Analytics',
      child: summary.when(
        loading: () => const SectionLoading(),
        error: (error, _) => SectionError(
          error: error,
          onRetry: () => ref.invalidate(operationalSummaryProvider),
        ),
        data: (data) {
          if (data == null) {
            return const SectionEmpty(
              icon: Icons.insights_outlined,
              message: 'O plano da organização não inclui o módulo de análises.',
            );
          }
          final metrics = data.metrics.take(4).toList();
          if (metrics.isEmpty) {
            return const SectionEmpty(message: 'Sem indicadores no período.');
          }
          return Column(
            children: [
              for (final metric in metrics)
                Padding(
                  padding: const EdgeInsets.only(bottom: OrbitSpacing.sm),
                  child: _MetricRow(metric: metric),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _MetricRow extends StatelessWidget {
  const _MetricRow({required this.metric});

  final AnalyticsMetric metric;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                metric.label,
                style: const TextStyle(
                  fontSize: 13,
                  color: OrbitColors.textSecondary,
                ),
              ),
              const SizedBox(height: 2),
              ProvenanceChip(dataQuality: metric.dataQuality),
            ],
          ),
        ),
        Text(
          metric.formattedValue,
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
        ),
      ],
    );
  }
}

/// Volumes por status, contados pelo backend.
class _StatusCounts extends ConsumerWidget {
  const _StatusCounts();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final counts = ref.watch(statusCountsProvider);
    final overdue = ref.watch(overdueCountProvider);

    return SectionCard(
      title: 'Operações',
      subtitle: 'Totais informados pelo servidor',
      child: counts.when(
        loading: () => const SectionLoading(lines: 2),
        error: (error, _) => SectionError(
          error: error,
          onRetry: () => ref.invalidate(statusCountsProvider),
        ),
        data: (data) => Wrap(
          spacing: OrbitSpacing.sm,
          runSpacing: OrbitSpacing.sm,
          children: [
            for (final count in data)
              _CountChip(label: count.label, value: count.total),
            overdue.maybeWhen(
              data: (value) => _CountChip(
                label: 'Prazo vencido',
                value: value.total,
                highlight: value.total > 0,
              ),
              orElse: () => const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }
}

class _CountChip extends StatelessWidget {
  const _CountChip({
    required this.label,
    required this.value,
    this.highlight = false,
  });

  final String label;
  final int value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final color = highlight ? OrbitColors.warning : OrbitColors.brand;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: OrbitSpacing.md,
        vertical: OrbitSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: OrbitRadius.field,
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
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
              fontSize: 11,
              color: OrbitColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _UpcomingOperations extends ConsumerWidget {
  const _UpcomingOperations();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final upcoming = ref.watch(upcomingOperationsProvider);

    return SectionCard(
      title: 'Próximas operações',
      trailing: TextButton(
        onPressed: () => context.go(OrbitRoutes.operations),
        child: const Text('Ver todas'),
      ),
      child: upcoming.when(
        loading: () => const SectionLoading(),
        error: (error, _) => SectionError(
          error: error,
          onRetry: () => ref.invalidate(upcomingOperationsProvider),
        ),
        data: (result) {
          final operations = result.value.data;
          if (operations.isEmpty) {
            return const SectionEmpty(
              icon: Icons.check_circle_outline,
              message: 'Nenhuma operação atribuída no momento.',
            );
          }
          return Column(
            children: [
              if (result.cachedAt != null)
                StaleDataBanner(cachedAt: result.cachedAt!),
              for (final operation in operations)
                OperationTile(
                  operation: operation,
                  onTap: () => context.push(
                    OrbitRoutes.operationDetail(operation.id),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _TodayAgenda extends ConsumerWidget {
  const _TodayAgenda();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final agenda = ref.watch(todayAgendaProvider);

    return SectionCard(
      title: 'Agenda de hoje',
      trailing: TextButton(
        onPressed: () => context.go(OrbitRoutes.agenda),
        child: const Text('Abrir'),
      ),
      child: agenda.when(
        loading: () => const SectionLoading(lines: 2),
        error: (error, _) => SectionError(
          error: error,
          onRetry: () => ref.invalidate(todayAgendaProvider),
        ),
        data: (result) {
          final events = result.value.events.take(4).toList();
          if (events.isEmpty) {
            return const SectionEmpty(
              icon: Icons.event_available_outlined,
              message: 'Nenhum compromisso para hoje.',
            );
          }
          return Column(
            children: [
              if (result.cachedAt != null)
                StaleDataBanner(cachedAt: result.cachedAt!),
              for (final event in events) _AgendaRow(event: event),
            ],
          );
        },
      ),
    );
  }
}

class _AgendaRow extends StatelessWidget {
  const _AgendaRow({required this.event});

  final AgendaEvent event;

  @override
  Widget build(BuildContext context) {
    final start = event.startsAt;
    final time = start == null
        ? '--:--'
        : '${start.hour.toString().padLeft(2, '0')}:'
              '${start.minute.toString().padLeft(2, '0')}';
    return Padding(
      padding: const EdgeInsets.only(bottom: OrbitSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 48,
            child: Text(
              time,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: OrbitColors.brandBright,
              ),
            ),
          ),
          Expanded(
            child: Text(event.title, style: const TextStyle(fontSize: 13)),
          ),
        ],
      ),
    );
  }
}

class _Alerts extends ConsumerWidget {
  const _Alerts();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final alerts = ref.watch(alertsProvider);

    return SectionCard(
      title: 'Alertas',
      subtitle: 'Notificações não lidas',
      child: alerts.when(
        loading: () => const SectionLoading(lines: 2),
        error: (error, _) => SectionError(
          error: error,
          onRetry: () => ref.invalidate(alertsProvider),
        ),
        data: (data) {
          if (data.isEmpty) {
            return const SectionEmpty(
              icon: Icons.notifications_none,
              message: 'Nenhum alerta pendente.',
            );
          }
          return Column(
            children: [
              for (final alert in data)
                Padding(
                  padding: const EdgeInsets.only(bottom: OrbitSpacing.sm),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.circle,
                        size: 8,
                        color: OrbitColors.brandBright,
                      ),
                      const SizedBox(width: OrbitSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              alert.title,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            if (alert.body != null)
                              Text(
                                alert.body!,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: OrbitColors.textSecondary,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
