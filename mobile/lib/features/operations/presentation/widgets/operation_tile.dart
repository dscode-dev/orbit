/// Linha de operação.
///
/// Usada na Home e na listagem — um único lugar define como uma operação é
/// resumida.
library;

import 'package:flutter/material.dart';

import '../../../../core/contracts/operation_contracts.dart';
import '../../../../core/theme/orbit_theme.dart';
import 'status_badge.dart';

class OperationTile extends StatelessWidget {
  const OperationTile({super.key, required this.operation, this.onTap});

  final Operation operation;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final schedule = operation.scheduledStart;
    return InkWell(
      onTap: onTap,
      borderRadius: OrbitRadius.field,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: OrbitSpacing.sm),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    operation.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    [
                      operation.code,
                      OperationKind.label(operation.kind),
                      if (schedule != null) _formatDate(schedule),
                    ].join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      color: OrbitColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: OrbitSpacing.sm),
            StatusBadge(status: operation.status),
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
