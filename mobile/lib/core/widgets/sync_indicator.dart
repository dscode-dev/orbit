/// Indicador de sincronização.
///
/// Responde a uma pergunta que quem está em campo faz o tempo todo: "o que eu
/// registrei já subiu?". Fica visível no shell, acima da barra de navegação,
/// e só aparece quando há algo a dizer.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../theme/orbit_theme.dart';
import '../uploads/upload_task.dart';

class SyncIndicator extends ConsumerWidget {
  const SyncIndicator({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasks = ref.watch(uploadTasksProvider).valueOrNull ?? const [];

    final uploading = tasks
        .where((task) => task.status == UploadStatus.uploading)
        .toList();
    final waiting = tasks
        .where(
          (task) =>
              task.status == UploadStatus.pending ||
              task.status == UploadStatus.retrying,
        )
        .length;
    final failed = tasks
        .where((task) => task.status == UploadStatus.failed)
        .length;

    if (uploading.isEmpty && waiting == 0 && failed == 0) {
      return const SizedBox.shrink();
    }

    final (icon, color, label) = switch ((uploading.isNotEmpty, failed > 0)) {
      (true, _) => (
        Icons.cloud_upload_outlined,
        OrbitColors.brandBright,
        'Enviando evidência… ${(uploading.first.progress * 100).round()}%',
      ),
      (false, true) => (
        Icons.error_outline,
        OrbitColors.danger,
        '$failed envio(s) com falha — toque em Operações para revisar',
      ),
      _ => (
        Icons.cloud_queue,
        OrbitColors.warning,
        '$waiting evidência(s) aguardando conexão',
      ),
    };

    return Material(
      color: color.withValues(alpha: 0.14),
      child: SafeArea(
        top: false,
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: OrbitSpacing.md,
            vertical: OrbitSpacing.sm,
          ),
          child: Row(
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: OrbitSpacing.sm),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(fontSize: 12, color: color),
                ),
              ),
              if (uploading.isNotEmpty)
                SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    value: uploading.first.progress > 0
                        ? uploading.first.progress
                        : null,
                    valueColor: AlwaysStoppedAnimation(color),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
