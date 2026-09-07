/// Abrir um documento a partir da lista.
///
/// A sequência é a do [DocumentDownloader] — pedir acesso, baixar, conferir os
/// bytes, gravar — e cada etapa vira texto. "Pedindo acesso" e "baixando" são
/// situações diferentes, e um indicador genérico esconderia qual delas travou
/// no elevador do prédio.
///
/// O arquivo é **temporário**: o documento é do servidor, e uma cópia
/// permanente no aparelho envelheceria sozinha e sobreviveria à revogação do
/// acesso de quem a baixou.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/contracts/mobile_field_contracts.dart';
import '../../../core/design/orbit_primitives.dart';
import '../../../core/presentation/field_registry.dart';
import '../../../core/presentation/orbit_format.dart';
import '../../../core/theme/orbit_theme.dart';
import '../../../core/widgets/section_states.dart';
import '../../artifact/application/artifact_providers.dart';
import '../../artifact/application/document_downloader.dart';

Future<void> showDocumentOpenSheet(
  BuildContext context,
  MobileRecentDocumentContract document,
) => showModalBottomSheet<void>(
  context: context,
  isScrollControlled: true,
  builder: (_) => DocumentOpenSheet(document: document),
);

class DocumentOpenSheet extends ConsumerStatefulWidget {
  const DocumentOpenSheet({super.key, required this.document});

  final MobileRecentDocumentContract document;

  @override
  ConsumerState<DocumentOpenSheet> createState() => _DocumentOpenSheetState();
}

class _DocumentOpenSheetState extends ConsumerState<DocumentOpenSheet> {
  DownloadState _state = const DownloadState();

  Future<void> _baixar() async {
    if (_state.isBusy) return;
    final downloader = DocumentDownloader(
      repository: ref.read(artifactRepositoryProvider),
      files: ref.read(documentFileStoreProvider),
    );
    final stream = downloader.fetch(
      artifactId: widget.document.artifactId,
      fileName: _nomeDeArquivo(),

      /// Visualização, não download: é o que a lista oferece, e o servidor
      /// distingue as duas na assinatura da URL.
      preview: true,
    );
    await for (final etapa in stream) {
      if (!mounted) return;
      setState(() => _state = etapa);
    }
  }

  /// O nome vem do rótulo e do cliente — nunca do `artifactId`, que é opaco e
  /// inútil para quem for abrir o arquivo depois.
  String _nomeDeArquivo() {
    final partes = [
      widget.document.label,
      if (widget.document.customerName case final String cliente) cliente,
    ].join('-');
    final limpo = partes
        .replaceAll(RegExp(r'[^A-Za-z0-9._-]+'), '-')
        .replaceAll(RegExp(r'-+'), '-')
        .replaceAll(RegExp(r'^[-.]+|[-.]+$'), '')
        .toLowerCase();
    return '${limpo.isEmpty ? 'documento' : limpo}.pdf';
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    final documento = widget.document;
    final rotulo = documentDownloadLabels[_state.phase.name];

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(OrbitSpacing.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              documento.customerName ?? documento.label,
              style: OrbitType.sectionTitle.copyWith(color: palette.ink),
            ),
            const SizedBox(height: 2),
            Text(
              '${documento.label} · '
              '${OrbitFormat.dateHourOf(documento.createdAt)}',
              style: OrbitType.caption.copyWith(color: palette.inkMuted),
            ),
            const SizedBox(height: OrbitSpacing.md),

            if (_state.phase == DownloadPhase.availableLocally)
              OrbitPanel(
                tone: OrbitTone.info,
                child: Row(
                  children: [
                    Icon(
                      Icons.check_circle_outline,
                      size: 18,
                      color: palette.success,
                    ),
                    const SizedBox(width: OrbitSpacing.sm),
                    Expanded(
                      child: Text(
                        'Documento disponível neste aparelho.',
                        style: OrbitType.body.copyWith(color: palette.ink),
                      ),
                    ),
                  ],
                ),
              )
            else if (_state.phase == DownloadPhase.error)
              SectionError(error: _state.error!, onRetry: _baixar)
            else if (rotulo != null)
              Semantics(
                liveRegion: true,
                child: Row(
                  children: [
                    const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                    const SizedBox(width: OrbitSpacing.sm),
                    Expanded(
                      child: Text(
                        rotulo,
                        style: OrbitType.body.copyWith(color: palette.inkMuted),
                      ),
                    ),
                  ],
                ),
              ),

            if (_state.phase == DownloadPhase.idle) ...[
              FilledButton.icon(
                onPressed: _baixar,
                icon: const Icon(Icons.visibility_outlined, size: 18),
                label: const Text('Abrir documento'),
                style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
