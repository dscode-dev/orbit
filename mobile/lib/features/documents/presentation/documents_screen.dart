/// Documentos — o que já foi emitido.
///
/// ## Por que a tela existe
///
/// O documento só era alcançável por dentro do atendimento que o gerou. "Cadê
/// a OS de ontem?" é pergunta de todo dia em campo, e a resposta custava
/// lembrar o cliente, achar o atendimento na fila, abrir, rolar até a seção do
/// documento. Quatro toques e uma memória.
///
/// ## O que ela não decide
///
/// Nada. O rótulo do tipo, a ordem, e se o arquivo está disponível ou ainda
/// sendo preparado vêm do servidor. Tocar num documento em preparo não oferece
/// botão nenhum — oferecer e recusar seria pior do que não oferecer.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/contracts/mobile_field_contracts.dart';
import '../../../core/design/orbit_primitives.dart';
import '../../../core/presentation/orbit_format.dart';
import '../../../core/theme/orbit_theme.dart';
import '../../../core/widgets/section_states.dart';
import '../application/documents_providers.dart';
import '../data/documents_repository.dart';
import 'document_open_sheet.dart';

class DocumentsScreen extends ConsumerStatefulWidget {
  const DocumentsScreen({super.key});

  @override
  ConsumerState<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends ConsumerState<DocumentsScreen> {
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  /// Pede a próxima página antes do fim, não no fim: quem chega ao último
  /// pixel e espera vê uma lista que trava.
  void _onScroll() {
    if (!_scroll.hasClients) return;
    final faltam = _scroll.position.maxScrollExtent - _scroll.position.pixels;
    if (faltam < 400) {
      ref.read(documentsControllerProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(documentsControllerProvider);
    final filter = ref.watch(documentFilterProvider);

    return Scaffold(
      backgroundColor: context.orbit.background,
      appBar: AppBar(title: const Text('Documentos')),
      body: Column(
        children: [
          _Filters(
            selected: filter,
            onSelect: (escolhido) =>
                ref.read(documentFilterProvider.notifier).state = escolhido,
          ),
          const OrbitRowDivider(indent: 0),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () =>
                  ref.read(documentsControllerProvider.notifier).load(),
              child: state.when(
                loading: () => const Padding(
                  padding: EdgeInsets.all(OrbitSpacing.gutter),
                  child: SectionLoading(lines: 6),
                ),
                error: (error, _) => ListView(
                  padding: const EdgeInsets.all(OrbitSpacing.gutter),
                  children: [
                    SectionError(
                      error: error,
                      onRetry: () =>
                          ref.read(documentsControllerProvider.notifier).load(),
                    ),
                  ],
                ),
                data: (data) => _List(scroll: _scroll, state: data),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Os recortes. Um só de cada vez — filtro que acumula vira pergunta.
class _Filters extends StatelessWidget {
  const _Filters({required this.selected, required this.onSelect});

  final DocumentFilter selected;
  final ValueChanged<DocumentFilter> onSelect;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 52,
    child: ListView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: OrbitSpacing.gutter),
      children: [
        for (final opcao in DocumentFilter.values)
          Padding(
            padding: const EdgeInsets.only(right: OrbitSpacing.sm),
            child: Center(
              child: ChoiceChip(
                label: Text(documentFilterLabels[opcao]!),
                selected: opcao == selected,
                onSelected: (_) => onSelect(opcao),
              ),
            ),
          ),
      ],
    ),
  );
}

class _List extends StatelessWidget {
  const _List({required this.scroll, required this.state});

  final ScrollController scroll;
  final DocumentsState state;

  @override
  Widget build(BuildContext context) {
    if (state.items.isEmpty) {
      /// Rolável mesmo vazia: sem rolagem o pull-to-refresh não tem gesto.
      return ListView(
        children: const [
          OrbitEmptyState(
            icon: Icons.description_outlined,
            title: 'Nenhum documento neste recorte',
            description:
                'Ordens de serviço, PMOC e RVT aparecem aqui assim que são '
                'emitidos.',
          ),
        ],
      );
    }

    return ListView.separated(
      controller: scroll,
      itemCount: state.items.length + (state.hasNextPage ? 1 : 0),
      separatorBuilder: (_, __) => const OrbitRowDivider(),
      itemBuilder: (context, index) {
        if (index >= state.items.length) {
          return Padding(
            padding: const EdgeInsets.all(OrbitSpacing.gutter),
            child: state.error == null
                ? const Center(
                    child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )

                /// A falha de uma página não apaga o que já está na tela.
                : SectionError(error: state.error!),
          );
        }
        return DocumentRow(document: state.items[index]);
      },
    );
  }
}

/// O selo de um documento.
///
/// Três casos, e a diferença entre os dois últimos importa para quem espera:
/// "preparando" resolve sozinho, "falhou" não resolve. Chamar os dois de
/// preparando deixaria a pessoa esperando um documento que nunca chega.
Widget documentStateBadge(MobileRecentDocumentContract document) =>
    switch (document.state) {
      MobileDocumentState.available => const Icon(
        Icons.picture_as_pdf_outlined,
        size: 20,
      ),
      MobileDocumentState.preparing => const OrbitStatusBadge(
        label: 'Preparando',
        tone: OrbitTone.warning,
      ),
      MobileDocumentState.failed => const OrbitStatusBadge(
        label: 'Falhou',
        tone: OrbitTone.danger,
      ),
    };

/// Uma linha de documento.
class DocumentRow extends StatelessWidget {
  const DocumentRow({super.key, required this.document});

  final MobileRecentDocumentContract document;

  @override
  Widget build(BuildContext context) => OrbitListRow(
    title: document.customerName ?? document.label,
    subtitle: document.customerName == null ? null : document.label,
    detail: OrbitFormat.dateHourOf(document.createdAt),
    trailing: documentStateBadge(document),

    /// Só o que está pronto abre. Um toque que leva a "ainda não está pronto"
    /// gasta a atenção de quem está de pé numa casa de máquinas.
    onTap: document.isAvailable
        ? () => showDocumentOpenSheet(context, document)
        : null,
  );
}
