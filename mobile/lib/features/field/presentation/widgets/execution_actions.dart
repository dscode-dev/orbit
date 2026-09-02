/// As ações de execução — exatamente as que o servidor publicou.
///
/// `primaryAction` decide o botão de baixo; `allowedActions` decide o resto.
/// Nada é habilitado por status, e nada é acrescentado "para facilitar".
library;

import 'package:flutter/material.dart';

import '../../../../core/contracts/field_operation_contracts.dart';
import '../../../../core/presentation/field_registry.dart';
import '../../../../core/theme/orbit_theme.dart';
import '../../../../core/widgets/section_states.dart';
import '../../application/execution_controller.dart';

const _codes = <FieldOperationAllowedAction, String>{
  FieldOperationAllowedAction.start: 'START',
  FieldOperationAllowedAction.resume: 'RESUME',
  FieldOperationAllowedAction.complete: 'COMPLETE',
  FieldOperationAllowedAction.updateChecklist: 'UPDATE_CHECKLIST',
  FieldOperationAllowedAction.addNote: 'ADD_NOTE',
  FieldOperationAllowedAction.registerMaterial: 'REGISTER_MATERIAL',
};

/// A ação principal, no alcance do polegar.
class ExecutionPrimaryAction extends StatelessWidget {
  const ExecutionPrimaryAction({
    super.key,
    required this.state,
    required this.controller,
  });

  final ExecutionState state;
  final ExecutionController controller;

  @override
  Widget build(BuildContext context) {
    final action = state.preparation?.primaryAction;

    /// Sem ação principal publicada não há botão. A tela não elege uma.
    if (action == null) return const SizedBox.shrink();

    final label = executionActionLabel(_codes[action] ?? '');
    if (label == null) return const SizedBox.shrink();

    final isPending = state.isBusy && state.pendingAction == action;
    final onPressed = switch (action) {
      FieldOperationAllowedAction.start ||
      FieldOperationAllowedAction.resume => () => controller.start(),
      FieldOperationAllowedAction.complete => () => _confirmCompletion(
        context,
        controller,
      ),
      _ => null,
    };

    return Semantics(
      button: true,
      enabled: !state.isBusy && onPressed != null,
      label: label.label,
      child: FilledButton(
        /// Enquanto o comando está em voo o botão não aceita outro toque —
        /// é o que impede o toque duplo virar dois comandos.
        onPressed: state.isBusy ? null : onPressed,
        style: FilledButton.styleFrom(minimumSize: const Size(0, 52)),
        child: isPending
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Text(label.label),
      ),
    );
  }
}

/// Concluir pede confirmação — proporcional, sem alarme.
Future<void> _confirmCompletion(
  BuildContext context,
  ExecutionController controller,
) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Concluir atendimento?'),
      content: const Text(
        'O atendimento será encerrado. O documento é emitido em separado.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('Concluir'),
        ),
      ],
    ),
  );
  if (confirmed ?? false) await controller.complete();
}

/// Observação e material, quando publicados.
class ExecutionSecondaryActions extends StatelessWidget {
  const ExecutionSecondaryActions({
    super.key,
    required this.state,
    required this.onNote,
    required this.onMaterial,
  });

  final ExecutionState state;
  final VoidCallback onNote;
  final VoidCallback onMaterial;

  @override
  Widget build(BuildContext context) {
    final entries = <(FieldOperationAllowedAction, VoidCallback)>[
      (FieldOperationAllowedAction.addNote, onNote),
      (FieldOperationAllowedAction.registerMaterial, onMaterial),
    ].where((entry) => state.allows(entry.$1)).toList();

    if (entries.isEmpty) return const SizedBox.shrink();

    return SectionCard(
      title: 'Registrar',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (action, onPressed) in entries)
            if (executionActionLabel(_codes[action] ?? '') case final label?)
              Padding(
                padding: const EdgeInsets.only(bottom: OrbitSpacing.sm),
                child: OutlinedButton(
                  onPressed: state.isBusy ? null : onPressed,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 48),
                  ),
                  child: Text(label.label),
                ),
              ),
        ],
      ),
    );
  }
}
