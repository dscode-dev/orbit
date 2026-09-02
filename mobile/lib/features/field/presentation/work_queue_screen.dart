/// A fila de trabalho.
///
/// A lista operacional do profissional, **na ordem do servidor**: em
/// andamento, atrasados, hoje, próximos, sem data. O app não reordena e não
/// reagrupa de forma que altere a prioridade — os títulos de seção existem
/// apenas onde a própria ordem já mudou de faixa.
///
/// A paginação é por cursor do backend. Repetir a mesma página não duplica
/// item: a junção é por ID canônico.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../core/presentation/field_registry.dart';
import '../../../core/routing/orbit_router.dart';
import '../../../core/theme/orbit_theme.dart';
import '../../../core/widgets/section_states.dart';
import '../application/field_providers.dart';
import '../data/field_repository.dart';
import 'widgets/work_item_card.dart';

const _views = <(WorkQueueView, String)>[
  (WorkQueueView.all, 'Tudo'),
  (WorkQueueView.inProgress, 'Em andamento'),
  (WorkQueueView.overdue, 'Atrasados'),
  (WorkQueueView.today, 'Hoje'),
  (WorkQueueView.upcoming, 'Próximos'),
];

class WorkQueueScreen extends ConsumerStatefulWidget {
  const WorkQueueScreen({super.key});

  @override
  ConsumerState<WorkQueueScreen> createState() => _WorkQueueScreenState();
}

class _WorkQueueScreenState extends ConsumerState<WorkQueueScreen> {
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  /// Pede a próxima página perto do fim. O controlador ignora chamadas
  /// enquanto uma página está no ar, então rolar rápido não pede duas vezes.
  void _onScroll() {
    if (!_scroll.hasClients) return;
    final remaining =
        _scroll.position.maxScrollExtent - _scroll.position.pixels;
    if (remaining < 400) {
      ref.read(workQueueControllerProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final queue = ref.watch(workQueueControllerProvider);
    final filter = ref.watch(workQueueFilterProvider);
    final session = ref.watch(sessionProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Trabalho')),
      body: Column(
        children: [
          _ViewSelector(active: filter.view),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () =>
                  ref.read(workQueueControllerProvider.notifier).load(),
              child: queue.when(
                loading: () => const Padding(
                  padding: EdgeInsets.all(OrbitSpacing.md),
                  child: SectionLoading(lines: 6),
                ),
                error: (error, _) => ListView(
                  padding: const EdgeInsets.all(OrbitSpacing.md),
                  children: [
                    SectionError(
                      error: error,
                      onRetry: () =>
                          ref.read(workQueueControllerProvider.notifier).load(),
                    ),
                  ],
                ),
                data: (state) => _Queue(
                  state: state,
                  scroll: _scroll,
                  currentUserId: session?.user.id,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ViewSelector extends ConsumerWidget {
  const _ViewSelector({required this.active});

  final WorkQueueView active;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SizedBox(
      height: 52,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: OrbitSpacing.md),
        itemCount: _views.length,
        separatorBuilder: (_, _) => const SizedBox(width: OrbitSpacing.sm),
        itemBuilder: (context, index) {
          final (view, label) = _views[index];
          return Center(
            child: ChoiceChip(
              label: Text(label),
              selected: view == active,

              /// O recorte é do servidor: muda a consulta, não a lista local.
              onSelected: (_) =>
                  ref.read(workQueueFilterProvider.notifier).state =
                      WorkQueueFilter(view: view),
            ),
          );
        },
      ),
    );
  }
}

class _Queue extends StatelessWidget {
  const _Queue({
    required this.state,
    required this.scroll,
    required this.currentUserId,
  });

  final WorkQueueState state;
  final ScrollController scroll;
  final String? currentUserId;

  @override
  Widget build(BuildContext context) {
    if (state.items.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(OrbitSpacing.md),
        children: const [
          SectionEmpty(
            icon: Icons.inbox_outlined,
            message: 'Nenhum trabalho nesta fila.',
          ),
        ],
      );
    }

    return ListView.builder(
      controller: scroll,
      padding: const EdgeInsets.all(OrbitSpacing.md),

      /// +1 pelo rodapé, +1 pelo aviso de lista local quando ele existe.
      itemCount: state.items.length + (state.isOffline ? 2 : 1),
      itemBuilder: (context, rawIndex) {
        if (state.isOffline && rawIndex == 0) return const _OfflineNotice();
        final index = state.isOffline ? rawIndex - 1 : rawIndex;
        if (index == state.items.length) return _Footer(state: state);

        final item = state.items[index];
        final previous = index == 0 ? null : state.items[index - 1];
        final startsGroup = previous?.dueState != item.dueState;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            /// Cabeçalho apenas quando a faixa muda — o agrupamento acompanha
            /// a ordem recebida, nunca a reescreve.
            if (startsGroup)
              Padding(
                padding: EdgeInsets.only(
                  top: index == 0 ? 0 : OrbitSpacing.sm,
                  bottom: OrbitSpacing.xs,
                ),
                child: Text(
                  dueStateLabel(item.dueState),
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: OrbitColors.textSecondary,
                  ),
                ),
              ),
            WorkItemCard(
              key: ValueKey(item.id),
              item: item,
              currentUserId: currentUserId,
              onOpen: () => context.push(OrbitRoutes.workItemDetail(item.id)),
            ),
          ],
        );
      },
    );
  }
}

class _Footer extends ConsumerWidget {
  const _Footer({required this.state});

  final WorkQueueState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (state.error != null) {
      return Padding(
        padding: const EdgeInsets.only(top: OrbitSpacing.md),
        child: SectionError(
          error: state.error!,
          onRetry: () =>
              ref.read(workQueueControllerProvider.notifier).loadMore(),
        ),
      );
    }
    if (state.isLoadingMore) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: OrbitSpacing.lg),
        child: Center(
          child: SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }
    if (state.hasNextPage) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: OrbitSpacing.md),
        child: Center(
          child: TextButton(
            onPressed: () =>
                ref.read(workQueueControllerProvider.notifier).loadMore(),
            child: const Text('Carregar mais'),
          ),
        ),
      );
    }
    return const SizedBox(height: OrbitSpacing.lg);
  }
}

/// A fila veio do aparelho.
///
/// Dizer isso importa: uma lista sem aviso passa por atual, e um atendimento
/// cancelado há uma hora continuaria parecendo trabalho a fazer.
class _OfflineNotice extends StatelessWidget {
  const _OfflineNotice();

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: OrbitSpacing.sm),
    padding: const EdgeInsets.all(OrbitSpacing.sm),
    decoration: BoxDecoration(
      color: OrbitColors.warning.withValues(alpha: 0.12),
      borderRadius: OrbitRadius.card,
    ),
    child: Row(
      children: [
        const Icon(
          Icons.cloud_off_outlined,
          size: 16,
          color: OrbitColors.warning,
        ),
        const SizedBox(width: OrbitSpacing.sm),
        const Expanded(
          child: Text(
            'Sem conexão. Esta é a última lista recebida do servidor.',
            style: TextStyle(fontSize: 12, color: OrbitColors.warning),
          ),
        ),
      ],
    ),
  );
}
