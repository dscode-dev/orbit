/// Workspace da operação.
///
/// Cada seção resolve o próprio estado: uma falha na timeline não impede o
/// detalhe de aparecer, e um 403 em histórico vira "sem acesso" em vez de erro.
///
/// A leitura principal (`GET /operations/:id`) já traz cliente, ativo, equipe,
/// anexos e o resumo dos checklists — essas seções compartilham a mesma
/// consulta em vez de repetir requisições.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/contracts/operation_contracts.dart';
import '../../../core/errors/orbit_exception.dart';
import '../../../core/routing/guards.dart';
import '../../../core/theme/orbit_theme.dart';
import '../../../core/widgets/section_states.dart';
import '../../../app/providers.dart';
import '../application/operations_providers.dart';
import 'widgets/status_badge.dart';

class OperationDetailScreen extends ConsumerWidget {
  const OperationDetailScreen({super.key, required this.operationId});

  final String operationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(operationDetailProvider(operationId));

    return Scaffold(
      appBar: AppBar(
        title: Text(detail.valueOrNull?.value.code ?? 'Operação'),
        actions: [
          IconButton(
            tooltip: 'Atualizar',
            icon: const Icon(Icons.refresh),
            onPressed: () => invalidateOperation(ref, operationId),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => invalidateOperation(ref, operationId),
        child: ListView(
          padding: const EdgeInsets.all(OrbitSpacing.md),
          children: [
            detail.when(
              loading: () => const SectionCard(
                title: 'Detalhes',
                child: SectionLoading(lines: 4),
              ),
              error: (error, _) => SectionCard(
                title: 'Detalhes',
                child: SectionError(
                  error: error,
                  onRetry: () =>
                      ref.invalidate(operationDetailProvider(operationId)),
                ),
              ),
              data: (result) => Column(
                children: [
                  if (result.cachedAt != null)
                    StaleDataBanner(cachedAt: result.cachedAt!),
                  _DetailsSection(operation: result.value),
                  const SizedBox(height: OrbitSpacing.md),
                  _StatusSection(
                    operationId: operationId,
                    operation: result.value,
                  ),
                  const SizedBox(height: OrbitSpacing.md),
                  _RelationsSection(operation: result.value),
                  const SizedBox(height: OrbitSpacing.md),
                  _ScheduleSection(operation: result.value),
                  const SizedBox(height: OrbitSpacing.md),
                  _TeamSection(operation: result.value),
                  const SizedBox(height: OrbitSpacing.md),
                  _AttachmentsSection(operation: result.value),
                ],
              ),
            ),
            const SizedBox(height: OrbitSpacing.md),
            _ChecklistsSection(operationId: operationId),
            const SizedBox(height: OrbitSpacing.md),
            _TimelineSection(operationId: operationId),
            const SizedBox(height: OrbitSpacing.md),
            _HistorySection(operationId: operationId),
            const SizedBox(height: OrbitSpacing.xl),
          ],
        ),
      ),
    );
  }
}

class _DetailsSection extends StatelessWidget {
  const _DetailsSection({required this.operation});

  final Operation operation;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: operation.title,
      subtitle: operation.code,
      trailing: StatusBadge(status: operation.status),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Field(label: 'Tipo', value: OperationKind.label(operation.kind)),
          _Field(
            label: 'Prioridade',
            value: OperationPriority.label(operation.priority),
          ),
          if (operation.businessUnit != null)
            _Field(label: 'Unidade', value: operation.businessUnit!.name),
          if (operation.description != null &&
              operation.description!.isNotEmpty) ...[
            const Divider(height: OrbitSpacing.lg),
            Text(
              operation.description!,
              style: const TextStyle(fontSize: 13, height: 1.5),
            ),
          ],
        ],
      ),
    );
  }
}

/// Mudança de status.
///
/// A máquina de estados é do backend (`OperationService.transitions`). O app
/// **não** a replica: oferece os status e apresenta a recusa quando ela vem.
/// Duplicar a regra aqui criaria duas fontes de verdade.
class _StatusSection extends ConsumerStatefulWidget {
  const _StatusSection({required this.operationId, required this.operation});

  final String operationId;
  final Operation operation;

  @override
  ConsumerState<_StatusSection> createState() => _StatusSectionState();
}

class _StatusSectionState extends ConsumerState<_StatusSection> {
  bool _submitting = false;

  Future<void> _change(String status) async {
    setState(() => _submitting = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref
          .read(operationsRepositoryProvider)
          .changeStatus(id: widget.operationId, status: status);
      if (!mounted) return;
      invalidateOperation(ref, widget.operationId);
      messenger.showSnackBar(
        const SnackBar(content: Text('Status atualizado.')),
      );
    } on OrbitException catch (error) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: 'Status',
      subtitle: 'A transição é validada pelo servidor',
      child: PermissionGate(
        permission: 'operations.status.update',
        fallback: const SectionEmpty(
          icon: Icons.lock_outline,
          message: 'Sua conta não pode alterar o status desta operação.',
        ),
        child: _submitting
            ? const SectionLoading(lines: 1)
            : Wrap(
                spacing: OrbitSpacing.sm,
                runSpacing: OrbitSpacing.sm,
                children: [
                  for (final status in OperationStatus.all)
                    if (status != widget.operation.status)
                      OutlinedButton(
                        onPressed: () => _change(status),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(0, 44),
                          foregroundColor: StatusBadge.colorFor(status),
                        ),
                        child: Text(OperationStatus.label(status)),
                      ),
                ],
              ),
      ),
    );
  }
}

class _RelationsSection extends StatelessWidget {
  const _RelationsSection({required this.operation});

  final Operation operation;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: 'Cliente e ativo',
      child: Column(
        children: [
          _Field(
            label: 'Cliente',
            value: operation.customer?.name ?? 'Não vinculado',
          ),
          _Field(
            label: 'Ativo',
            value: operation.asset == null
                ? 'Não vinculado'
                : [
                    operation.asset!.name,
                    if (operation.asset!.detail != null)
                      operation.asset!.detail!,
                  ].join(' · '),
          ),
        ],
      ),
    );
  }
}

class _ScheduleSection extends StatelessWidget {
  const _ScheduleSection({required this.operation});

  final Operation operation;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: 'Agendamento',
      child: Column(
        children: [
          _Field(
            label: 'Início previsto',
            value: _format(operation.scheduledStart),
          ),
          _Field(
            label: 'Término previsto',
            value: _format(operation.scheduledEnd),
          ),
          _Field(label: 'Início real', value: _format(operation.startedAt)),
          _Field(label: 'Conclusão', value: _format(operation.completedAt)),
        ],
      ),
    );
  }

  static String _format(DateTime? value) {
    if (value == null) return '—';
    final local = value.toLocal();
    return '${local.day.toString().padLeft(2, '0')}/'
        '${local.month.toString().padLeft(2, '0')} '
        '${local.hour.toString().padLeft(2, '0')}:'
        '${local.minute.toString().padLeft(2, '0')}';
  }
}

class _TeamSection extends StatelessWidget {
  const _TeamSection({required this.operation});

  final Operation operation;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: 'Equipe',
      trailing: Text(
        '${operation.assignees.length}',
        style: const TextStyle(color: OrbitColors.textSecondary),
      ),
      child: operation.assignees.isEmpty
          ? const SectionEmpty(
              icon: Icons.person_outline,
              message: 'Nenhum técnico atribuído.',
            )
          : Column(
              children: [
                for (final assignee in operation.assignees)
                  Padding(
                    padding: const EdgeInsets.only(bottom: OrbitSpacing.sm),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 16,
                          backgroundColor: OrbitColors.brand.withValues(
                            alpha: 0.2,
                          ),
                          child: Text(
                            _initials(assignee.displayName),
                            style: const TextStyle(fontSize: 12),
                          ),
                        ),
                        const SizedBox(width: OrbitSpacing.sm),
                        Expanded(
                          child: Text(
                            assignee.displayName,
                            style: const TextStyle(fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }
}

/// Anexos.
///
/// Lista o que o backend devolve no detalhe. O envio de evidências pelo app
/// depende de captura de câmera e upload multipart — fora do escopo desta PR,
/// registrado na documentação.
class _AttachmentsSection extends StatelessWidget {
  const _AttachmentsSection({required this.operation});

  final Operation operation;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: 'Anexos',
      trailing: Text(
        '${operation.attachments.length}',
        style: const TextStyle(color: OrbitColors.textSecondary),
      ),
      child: operation.attachments.isEmpty
          ? const SectionEmpty(
              icon: Icons.attach_file,
              message: 'Nenhum anexo nesta operação.',
            )
          : Column(
              children: [
                for (final attachment in operation.attachments)
                  Padding(
                    padding: const EdgeInsets.only(bottom: OrbitSpacing.sm),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.insert_drive_file_outlined,
                          size: 18,
                          color: OrbitColors.textSecondary,
                        ),
                        const SizedBox(width: OrbitSpacing.sm),
                        Expanded(
                          child: Text(
                            attachment.fileName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 13),
                          ),
                        ),
                        Text(
                          _size(attachment.size),
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
    );
  }

  static String _size(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).round()} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}

class _ChecklistsSection extends ConsumerWidget {
  const _ChecklistsSection({required this.operationId});

  final String operationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final checklists = ref.watch(operationChecklistsProvider(operationId));

    return SectionCard(
      title: 'Checklists',
      child: checklists.when(
        loading: () => const SectionLoading(lines: 2),
        error: (error, _) => SectionError(
          error: error,
          onRetry: () =>
              ref.invalidate(operationChecklistsProvider(operationId)),
        ),
        data: (page) => page.isEmpty
            ? const SectionEmpty(
                icon: Icons.checklist_rtl,
                message: 'Nenhum checklist iniciado para esta operação.',
              )
            : Column(
                children: [
                  for (final checklist in page.data)
                    Padding(
                      padding: const EdgeInsets.only(bottom: OrbitSpacing.md),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  checklist.templateName ?? 'Checklist',
                                  style: const TextStyle(fontSize: 13),
                                ),
                              ),
                              Text(
                                '${checklist.progress}%',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: OrbitColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: OrbitSpacing.xs),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: checklist.progress / 100,
                              minHeight: 6,
                              backgroundColor: OrbitColors.surface,
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

class _TimelineSection extends ConsumerWidget {
  const _TimelineSection({required this.operationId});

  final String operationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final timeline = ref.watch(operationTimelineProvider(operationId));

    return SectionCard(
      title: 'Linha do tempo',
      child: timeline.when(
        loading: () => const SectionLoading(),
        error: (error, _) => SectionError(
          error: error,
          onRetry: () => ref.invalidate(operationTimelineProvider(operationId)),
        ),
        data: (data) => data.events.isEmpty
            ? const SectionEmpty(message: 'Nenhum evento registrado.')
            : Column(
                children: [
                  for (final event in data.events.take(12))
                    _TimelineRow(entry: event),
                ],
              ),
      ),
    );
  }
}

class _HistorySection extends ConsumerWidget {
  const _HistorySection({required this.operationId});

  final String operationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(operationHistoryProvider(operationId));

    return SectionCard(
      title: 'Histórico',
      subtitle: 'Registro de auditoria',
      child: history.when(
        loading: () => const SectionLoading(lines: 2),
        error: (error, _) => SectionError(
          error: error,
          onRetry: () => ref.invalidate(operationHistoryProvider(operationId)),
        ),
        data: (entries) => entries.isEmpty
            ? const SectionEmpty(message: 'Nenhuma alteração registrada.')
            : Column(
                children: [
                  for (final entry in entries.take(10))
                    _TimelineRow(entry: entry),
                ],
              ),
      ),
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({required this.entry});

  final OperationHistoryEntry entry;

  @override
  Widget build(BuildContext context) {
    final at = entry.createdAt?.toLocal();
    return Padding(
      padding: const EdgeInsets.only(bottom: OrbitSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 5),
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              color: OrbitColors.brand,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: OrbitSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(entry.label, style: const TextStyle(fontSize: 13)),
                Text(
                  [
                    entry.actorName ?? 'Sistema',
                    if (at != null)
                      '${at.day.toString().padLeft(2, '0')}/'
                          '${at.month.toString().padLeft(2, '0')} '
                          '${at.hour.toString().padLeft(2, '0')}:'
                          '${at.minute.toString().padLeft(2, '0')}',
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
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: OrbitSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                color: OrbitColors.textSecondary,
              ),
            ),
          ),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 13))),
        ],
      ),
    );
  }
}
