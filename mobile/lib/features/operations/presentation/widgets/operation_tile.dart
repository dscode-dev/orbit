/// Linha de operação.
///
/// Usada na Home e na listagem — um único lugar define como uma operação é
/// resumida.
library;

import 'package:flutter/material.dart';

import '../../../../core/contracts/operation_contracts.dart';
import '../../../../core/design/orbit_primitives.dart';
import '../../../../core/theme/orbit_theme.dart';
import 'status_badge.dart';

class OperationTile extends StatelessWidget {
  const OperationTile({super.key, required this.operation, this.onTap});

  final Operation operation;
  final VoidCallback? onTap;

  /// Prioridade alta é sinal, não decoração: vira a faixa do tom, e some
  /// quando o serviço é de rotina — senão toda linha grita igual.
  static OrbitTone? _tomDaPrioridade(String priority) => switch (priority) {
    'CRITICAL' || 'URGENT' => OrbitTone.danger,
    'HIGH' => OrbitTone.warning,
    _ => null,
  };

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    final schedule = operation.scheduledStart;
    final tom = _tomDaPrioridade(operation.priority);

    /// O cliente é a primeira coisa que se procura numa fila de serviços, e
    /// esta linha não o mostrava — estava no contrato e nunca chegava à tela.
    final cliente = operation.customer?.name;

    final contexto = [
      operation.code,
      OperationKind.label(operation.kind),
      if (schedule != null) _formatDate(schedule),
      if (tom != null) OperationPriority.label(operation.priority),
    ].join(' · ');

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: OrbitSpacing.ml,
          vertical: OrbitSpacing.md,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (tom != null) ...[
              Container(
                width: 3,
                height: 38,
                margin: const EdgeInsets.only(right: OrbitSpacing.ms),
                decoration: BoxDecoration(
                  color: tom == OrbitTone.danger
                      ? palette.danger
                      : palette.warning,
                  borderRadius: OrbitRadius.pill,
                ),
              ),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  /// O selo fica na linha do título, não na de contexto: a
                  /// linha de contexto carrega quatro campos e, dividida com
                  /// o selo, truncava todos eles.
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          cliente ?? operation.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: OrbitType.itemTitle.copyWith(
                            color: palette.ink,
                          ),
                        ),
                      ),
                      const SizedBox(width: OrbitSpacing.sm),
                      StatusBadge(status: operation.status),
                    ],
                  ),
                  if (cliente != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      operation.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: OrbitType.caption.copyWith(
                        color: palette.inkMuted,
                      ),
                    ),
                  ],
                  const SizedBox(height: OrbitSpacing.sm),
                  Text(
                    contexto,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: OrbitType.caption.copyWith(
                      color: palette.inkSubtle,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: OrbitSpacing.sm),
            Icon(
              Icons.chevron_right_rounded,
              size: 20,
              color: palette.inkDisabled,
            ),
          ],
        ),
      ),
    );
  }

  static String _formatDate(DateTime value) {
    final local = value.toLocal();
    final day = local.day.toString().padLeft(2, '0');
    final month = local.month.toString().padLeft(2, '0');
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    return '$day/$month $hour:$minute';
  }
}
