/// Etiqueta de status da operação.
///
/// Um único lugar traduz o literal do backend em rótulo e cor.
library;

import 'package:flutter/material.dart';

import '../../../../core/contracts/operation_contracts.dart';
import '../../../../core/theme/orbit_theme.dart';

class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status});

  final String status;

  static Color colorFor(String status) => switch (status) {
    OperationStatus.inProgress => OrbitColors.warning,
    OperationStatus.completed => OrbitColors.success,
    OperationStatus.cancelled => OrbitColors.danger,
    OperationStatus.scheduled => OrbitColors.brandBright,
    _ => OrbitColors.textSecondary,
  };

  @override
  Widget build(BuildContext context) {
    final color = colorFor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: OrbitRadius.pill,
      ),
      child: Text(
        OperationStatus.label(status),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}
