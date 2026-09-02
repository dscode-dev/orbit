/// Sincronização.
///
/// A tela responde três perguntas, nessa ordem: o que ainda não foi enviado,
/// o que travou, e quando foi a última vez que deu certo. Nada de
/// `commandId`, versão ou chave de idempotência — isso é vocabulário do
/// protocolo, e quem abre esta tela quer saber se o trabalho da manhã chegou.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/contracts/mobile_offline_sync_contracts.dart';
import '../../../core/presentation/field_registry.dart';
import '../../../core/presentation/orbit_format.dart';
import '../../../core/theme/orbit_theme.dart';
import '../../../core/widgets/section_states.dart';
import '../application/sync_controller.dart';
import '../application/sync_providers.dart';
import '../data/command_journal.dart';

class SyncCenterScreen extends ConsumerWidget {
  const SyncCenterScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sync = ref.watch(syncControllerProvider);
    final commands = ref.watch(pendingCommandsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Sincronização')),
      body: RefreshIndicator(
        onRefresh: () =>
            ref.read(syncControllerProvider.notifier).sync(manual: true),
        child: ListView(
          padding: const EdgeInsets.all(OrbitSpacing.md),
          children: [
            _Status(state: sync),
            const SizedBox(height: OrbitSpacing.md),
            commands.when(
              loading: () => const SectionLoading(lines: 3),
              error: (error, _) => SectionError(error: error),
              data: (value) => _Queue(commands: value),
            ),
          ],
        ),
      ),
    );
  }
}

class _Status extends ConsumerWidget {
  const _Status({required this.state});

  final SyncState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SectionCard(
      title: 'Situação',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            syncPhaseLabels[state.phase.name] ?? 'Sincronização',
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          Text(
            switch (state) {
              _ when state.needsAttention =>
                'Algumas ações precisam da sua atenção antes de serem enviadas.',
              _ when state.pending > 0 =>
                '${state.pending} ação(ões) aguardando envio.',
              _ => 'Nenhuma ação pendente neste aparelho.',
            },
            style: const TextStyle(
              fontSize: 13,
              color: OrbitColors.textSecondary,
            ),
          ),

          if (state.lastSyncedAt case final at?)
            Padding(
              padding: const EdgeInsets.only(top: OrbitSpacing.sm),
              child: Text(
                'Última sincronização em ${OrbitFormat.dateHourOf(at)}',
                style: const TextStyle(
                  fontSize: 12,
                  color: OrbitColors.textSecondary,
                ),
              ),
            ),

          const SizedBox(height: OrbitSpacing.md),
          FilledButton.icon(
            onPressed: state.isSyncing
                ? null
                : () => ref
                      .read(syncControllerProvider.notifier)
                      .sync(manual: true),
            icon: const Icon(Icons.sync),
            style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
            label: Text(
              state.isSyncing ? 'Sincronizando…' : 'Sincronizar agora',
            ),
          ),
        ],
      ),
    );
  }
}

class _Queue extends StatelessWidget {
  const _Queue({required this.commands});

  final List<PendingCommand> commands;

  @override
  Widget build(BuildContext context) {
    if (commands.isEmpty) {
      return const SectionEmpty(
        icon: Icons.cloud_done_outlined,
        message: 'Tudo o que você registrou já chegou ao servidor.',
      );
    }

    /// O que travou vem primeiro: é o que precisa de alguém.
    final ordered = [
      ...commands.where((value) => value.isBlocking),
      ...commands.where((value) => !value.isBlocking),
    ];

    return Column(
      children: [for (final command in ordered) _CommandTile(command: command)],
    );
  }
}

class _CommandTile extends ConsumerWidget {
  const _CommandTile({required this.command});

  final PendingCommand command;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final blocked = command.isBlocking;
    final title = pendingCommandLabel(
      offlineCommandTypeWire(command.envelope.commandType),
    );

    return Card(
      margin: const EdgeInsets.only(bottom: OrbitSpacing.sm),
      child: Padding(
        padding: const EdgeInsets.all(OrbitSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  blocked ? Icons.error_outline : Icons.schedule_outlined,
                  size: 18,
                  color: blocked ? OrbitColors.danger : OrbitColors.warning,
                ),
                const SizedBox(width: OrbitSpacing.sm),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              blocked
                  ? syncBlockedLabel(
                      conflictCode: switch (command.receipt?.conflict?.code) {
                        final code? => offlineConflictCodeWire(code),
                        null => null,
                      },
                      errorCode: command.receipt?.error?.code,
                    )
                  : 'Registrado em ${OrbitFormat.dateHourOf(command.enqueuedAt)}. '
                        'Será enviado quando houver conexão.',
              style: const TextStyle(
                fontSize: 13,
                color: OrbitColors.textSecondary,
              ),
            ),

            /// Descartar só aparece para o que o servidor **não** aplicou.
            /// Uma intenção ainda pendente pode estar em voo neste instante.
            if (blocked) ...[
              const SizedBox(height: OrbitSpacing.sm),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => _confirmDiscard(context, ref),
                  icon: const Icon(Icons.delete_outline, size: 18),
                  label: const Text('Descartar esta ação'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _confirmDiscard(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Descartar esta ação?'),
        content: const Text(
          'A ação não foi aplicada no servidor e será removida deste '
          'aparelho. Se ainda for necessária, registre-a de novo.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Manter'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Descartar'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await ref
        .read(syncControllerProvider.notifier)
        .discard(command.envelope.commandId);
  }
}
