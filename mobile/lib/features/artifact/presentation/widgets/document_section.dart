/// O documento de um atendimento.
///
/// Etapa separada da execução, e a tela diz isso: um atendimento concluído
/// aparece como concluído, e o documento como o que ele for — ainda não
/// emitido, em processamento, disponível ou falho. Nunca "concluído e
/// assinado" sem fato que sustente.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/contracts/mobile_field_artifact_contracts.dart';
import '../../../../core/presentation/field_registry.dart';
import '../../../../core/presentation/orbit_format.dart';
import '../../../../core/theme/orbit_theme.dart';
import '../../../../core/widgets/section_states.dart';
import '../../application/artifact_controller.dart';
import '../../application/artifact_providers.dart';

class DocumentSection extends ConsumerWidget {
  const DocumentSection({super.key, required this.source});

  final ArtifactSourceRef source;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(artifactControllerProvider(source));
    final controller = ref.read(artifactControllerProvider(source).notifier);

    return SectionCard(
      title: 'Documento',
      child: state.loading
          ? const SectionLoading(lines: 2)
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _Status(state: state),

                if (state.blockedReasons.isNotEmpty) ...[
                  const SizedBox(height: OrbitSpacing.sm),
                  _Blockers(reasons: state.blockedReasons),
                ],

                if (state.error case final Object error) ...[
                  const SizedBox(height: OrbitSpacing.sm),
                  SectionError(error: error, onRetry: controller.refresh),
                ],

                const SizedBox(height: OrbitSpacing.md),
                _Actions(state: state, controller: controller),
              ],
            ),
    );
  }
}

class _Status extends StatelessWidget {
  const _Status({required this.state});

  final ArtifactState state;

  @override
  Widget build(BuildContext context) {
    final label = documentStatusLabels[state.status.name]!;
    final artifact = state.artifact;

    final (icon, color) = switch (state.status) {
      FieldArtifactStatus.ready => (
        Icons.picture_as_pdf_outlined,
        OrbitColors.success,
      ),
      FieldArtifactStatus.failed => (Icons.error_outline, OrbitColors.danger),
      FieldArtifactStatus.pending || FieldArtifactStatus.rendering => (
        Icons.hourglass_top_outlined,
        OrbitColors.brandBright,
      ),
      _ => (Icons.description_outlined, OrbitColors.textSecondary),
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(width: OrbitSpacing.sm),
            Expanded(
              child: Text(
                label.label,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: OrbitColors.textPrimary,
                ),
              ),
            ),
            if (state.isTransient)
              const SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            label.description ?? '',
            style: const TextStyle(
              fontSize: 13,
              color: OrbitColors.textSecondary,
            ),
          ),
        ),

        /// Emitido em, não "congelado em": entre uma coisa e outra há uma
        /// fila, e os dois instantes são diferentes.
        if (artifact?.generatedAt case final at?)
          Padding(
            padding: const EdgeInsets.only(top: OrbitSpacing.sm),
            child: Text(
              'Emitido em ${OrbitFormat.dateHourOf(at)}',
              style: const TextStyle(
                fontSize: 12,
                color: OrbitColors.textSecondary,
              ),
            ),
          ),

        if (state.download.phase != DownloadPhase.idle)
          Padding(
            padding: const EdgeInsets.only(top: OrbitSpacing.sm),
            child: _DownloadStatus(download: state.download),
          ),
      ],
    );
  }
}

/// O que este aparelho conseguiu fazer com o arquivo.
///
/// Separado do estado do documento: o PDF pode estar pronto no servidor e o
/// download ter falhado aqui, e dizer "documento indisponível" nesse caso
/// seria culpar o servidor por um problema de rede local.
class _DownloadStatus extends StatelessWidget {
  const _DownloadStatus({required this.download});

  final DownloadState download;

  @override
  Widget build(BuildContext context) {
    final label = documentDownloadLabels[download.phase.name];
    if (label == null) return const SizedBox.shrink();

    final failed = download.phase == DownloadPhase.error;
    return Semantics(
      liveRegion: true,
      child: Row(
        children: [
          Icon(
            failed
                ? Icons.error_outline
                : download.phase == DownloadPhase.availableLocally
                ? Icons.check_circle_outline
                : Icons.downloading_outlined,
            size: 14,
            color: failed ? OrbitColors.danger : OrbitColors.textSecondary,
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: failed ? OrbitColors.danger : OrbitColors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// O que falta, em português.
class _Blockers extends StatelessWidget {
  const _Blockers({required this.reasons});

  final List<FieldArtifactBlockedReason> reasons;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(OrbitSpacing.sm),
    decoration: BoxDecoration(
      color: OrbitColors.warning.withValues(alpha: 0.12),
      borderRadius: OrbitRadius.card,
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final reason in reasons)
          Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: Text(
              documentBlockedLabel(reason.name),
              style: const TextStyle(fontSize: 12, color: OrbitColors.warning),
            ),
          ),
      ],
    ),
  );
}

/// As ações que o servidor publicou — e só elas.
class _Actions extends StatelessWidget {
  const _Actions({required this.state, required this.controller});

  final ArtifactState state;
  final ArtifactController controller;

  @override
  Widget build(BuildContext context) {
    final busy = state.mutating;

    return Wrap(
      spacing: OrbitSpacing.sm,
      runSpacing: OrbitSpacing.sm,
      children: [
        if (state.allows(FieldArtifactAllowedAction.prepareDocument))
          _Action(
            label: documentActionLabels['prepareDocument']!,
            icon: Icons.lock_outline,
            busy: busy,
            primary: true,
            onPressed: controller.prepare,
          ),

        if (state.allows(FieldArtifactAllowedAction.generateDocument))
          _Action(
            label: state.status == FieldArtifactStatus.failed
                ? 'Tentar novamente'
                : documentActionLabels['generateDocument']!,
            icon: Icons.description_outlined,
            busy: busy,
            primary: true,
            onPressed: controller.render,
          ),

        if (state.allows(FieldArtifactAllowedAction.viewDocument))
          _Action(
            label: documentActionLabels['viewDocument']!,
            icon: Icons.visibility_outlined,
            busy: state.download.isBusy,
            onPressed: () => controller.download(preview: true),
          ),

        if (state.allows(FieldArtifactAllowedAction.downloadDocument))
          _Action(
            label: documentActionLabels['downloadDocument']!,
            icon: Icons.download_outlined,
            busy: state.download.isBusy,
            onPressed: controller.download,
          ),

        /// Atualizar existe sempre: sem notificação de conclusão, é assim que
        /// a pessoa descobre que o documento ficou pronto.
        _Action(
          label: 'Atualizar',
          icon: Icons.refresh,
          busy: busy,
          onPressed: controller.refresh,
        ),
      ],
    );
  }
}

class _Action extends StatelessWidget {
  const _Action({
    required this.label,
    required this.icon,
    required this.busy,
    required this.onPressed,
    this.primary = false,
  });

  final String label;
  final IconData icon;
  final bool busy;
  final VoidCallback onPressed;
  final bool primary;

  @override
  Widget build(BuildContext context) {
    final child = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 18),
        const SizedBox(width: 6),

        /// `Flexible` porque com escala de texto grande o rótulo precisa
        /// quebrar em vez de estourar o botão.
        Flexible(child: Text(label)),
      ],
    );

    return Semantics(
      button: true,
      enabled: !busy,
      label: label,
      child: primary
          ? FilledButton(
              onPressed: busy ? null : onPressed,
              style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
              child: child,
            )
          : OutlinedButton(
              onPressed: busy ? null : onPressed,
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48)),
              child: child,
            ),
    );
  }
}
