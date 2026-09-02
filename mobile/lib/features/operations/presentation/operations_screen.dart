/// Listagem de operações.
///
/// Paginação, busca e filtros são do servidor (`OperationQueryDto`). Nada é
/// filtrado localmente: com paginação no backend, filtrar a página atual daria
/// um resultado errado.
///
/// **Ordenação**: o DTO não aceita parâmetro de ordenação — o backend ordena
/// por agendamento e criação. O app não oferece o controle em vez de fingir
/// uma ordem que não existe.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/contracts/operation_contracts.dart';
import '../../../core/routing/orbit_router.dart';
import '../../../core/theme/orbit_theme.dart';
import '../../../core/widgets/section_states.dart';
import '../application/operations_providers.dart';
import 'widgets/operation_tile.dart';

class OperationsScreen extends ConsumerStatefulWidget {
  const OperationsScreen({super.key});

  @override
  ConsumerState<OperationsScreen> createState() => _OperationsScreenState();
}

class _OperationsScreenState extends ConsumerState<OperationsScreen> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(operationsFilterProvider);
    final filters = ref.read(operationsFilterProvider.notifier);
    final list = ref.watch(operationsListProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Operações'),
        actions: [
          if (query.hasFilters)
            TextButton(
              onPressed: () {
                _searchController.clear();
                filters.reset();
              },
              child: const Text('Limpar'),
            ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              OrbitSpacing.md,
              0,
              OrbitSpacing.md,
              OrbitSpacing.sm,
            ),
            child: TextField(
              key: const Key('operations.search'),
              controller: _searchController,
              textInputAction: TextInputAction.search,
              onSubmitted: filters.setSearch,
              decoration: InputDecoration(
                hintText: 'Código, título ou descrição',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchController.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () {
                          _searchController.clear();
                          filters.setSearch(null);
                        },
                      ),
              ),
            ),
          ),

          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: OrbitSpacing.md),
              children: [
                _FilterChip(
                  label: 'Todas',
                  selected: query.status == null,
                  onSelected: () => filters.setStatus(null),
                ),
                for (final status in OperationStatus.all)
                  _FilterChip(
                    label: OperationStatus.label(status),
                    selected: query.status == status,
                    onSelected: () => filters.setStatus(status),
                  ),
              ],
            ),
          ),

          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(operationsListProvider),
              child: list.when(
                loading: () => const Padding(
                  padding: EdgeInsets.all(OrbitSpacing.md),
                  child: SectionLoading(lines: 6),
                ),
                error: (error, _) => ListView(
                  padding: const EdgeInsets.all(OrbitSpacing.md),
                  children: [
                    SectionError(
                      error: error,
                      onRetry: () => ref.invalidate(operationsListProvider),
                    ),
                  ],
                ),
                data: (result) {
                  final page = result.value;
                  if (page.isEmpty) {
                    return ListView(
                      padding: const EdgeInsets.all(OrbitSpacing.md),
                      children: const [
                        SectionEmpty(
                          message:
                              'Nenhuma operação encontrada com estes filtros.',
                        ),
                      ],
                    );
                  }
                  return ListView(
                    padding: const EdgeInsets.all(OrbitSpacing.md),
                    children: [
                      if (result.cachedAt != null)
                        StaleDataBanner(cachedAt: result.cachedAt!),
                      Padding(
                        padding: const EdgeInsets.only(bottom: OrbitSpacing.sm),
                        child: Text(
                          '${page.total} operação(ões) · página ${page.page} de ${page.totalPages}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: OrbitColors.textSecondary,
                          ),
                        ),
                      ),
                      for (final operation in page.data)
                        Card(
                          margin: const EdgeInsets.only(
                            bottom: OrbitSpacing.sm,
                          ),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: OrbitSpacing.md,
                              vertical: OrbitSpacing.xs,
                            ),
                            child: OperationTile(
                              operation: operation,
                              onTap: () => context.push(
                                OrbitRoutes.operationDetail(operation.id),
                              ),
                            ),
                          ),
                        ),
                      if (page.totalPages > 1)
                        _Pagination(
                          page: page,
                          onPrevious: filters.previousPage,
                          onNext: filters.nextPage,
                        ),
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

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onSelected,
  });

  final String label;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: OrbitSpacing.sm),
      child: FilterChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onSelected(),
        showCheckmark: false,
        selectedColor: OrbitColors.brand.withValues(alpha: 0.24),
      ),
    );
  }
}

class _Pagination extends StatelessWidget {
  const _Pagination({
    required this.page,
    required this.onPrevious,
    required this.onNext,
  });

  final Paginated<Operation> page;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: OrbitSpacing.md),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          OutlinedButton(
            onPressed: page.hasPreviousPage ? onPrevious : null,
            child: const Text('Anterior'),
          ),
          const SizedBox(width: OrbitSpacing.sm),
          OutlinedButton(
            onPressed: page.hasNextPage ? onNext : null,
            child: const Text('Próxima'),
          ),
        ],
      ),
    );
  }
}
