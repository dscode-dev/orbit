/// O contexto de um item de trabalho.
///
/// Uma requisição (`GET /mobile/field/work-items/:id`) traz tudo: o item,
/// o pedido do cliente, os procedimentos, os documentos e a equipe. Montar
/// isso a partir de várias APIs reconstruiria no aparelho o recorte que o
/// servidor já fez — e cada pedaço chegaria de um instante diferente.
///
/// ## Duas ações, não a lista inteira
///
/// A tela desenhava um botão para **cada** item de `allowedActions`. O resultado
/// era uma pilha de botões soltos — "Abrir", "Registrar evidência", "Ler
/// etiqueta" — alguns desabilitados, nenhum em destaque, e o único que
/// importava perdido no meio. Quem chega aqui quer fazer uma de duas coisas:
/// começar o atendimento, ou avisar que não dá para fazê-lo.
///
/// `allowedActions` continua mandando — é ele que diz se iniciar e se pedir o
/// cancelamento estão liberados. O que mudou é que a tela deixou de tratar a
/// lista como um menu: as outras ações têm lugar próprio no roteiro de execução,
/// que é onde fazem sentido.
///
/// ## Antes de agir, o contexto inteiro
///
/// Para quem, onde — com complemento e ponto de referência —, telefone, tipo,
/// quem está escalado, quando e, se o responsável liberou, quanto vale. Faltando
/// isso, o técnico ligava para o escritório para perguntar o que a tela já
/// poderia ter dito.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../core/contracts/mobile_field_contracts.dart';
import '../../../core/presentation/field_registry.dart';
import '../../../core/presentation/orbit_format.dart';
import '../../../core/routing/orbit_router.dart';
import '../../../core/theme/orbit_theme.dart';
import '../../../core/widgets/section_states.dart';
import '../application/field_providers.dart';
import 'widgets/cancellation_sheet.dart';
import 'widgets/work_item_row.dart';

class WorkItemDetailScreen extends ConsumerWidget {
  const WorkItemDetailScreen({super.key, required this.workItemId});

  final String workItemId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final context$ = ref.watch(fieldWorkItemProvider(workItemId));
    final session = ref.watch(sessionProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Atendimento')),
      body: RefreshIndicator(
        onRefresh: () async =>
            ref.invalidate(fieldWorkItemProvider(workItemId)),
        child: context$.when(
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
                    ref.invalidate(fieldWorkItemProvider(workItemId)),
              ),
            ],
          ),
          data: (value) => value == null
              ? ListView(
                  padding: const EdgeInsets.all(OrbitSpacing.gutter),
                  children: const [
                    SectionEmpty(
                      icon: Icons.search_off,
                      message: 'Este item não está mais disponível.',
                    ),
                  ],
                )
              : _Detail(context$: value, currentUserId: session?.user.id),
        ),
      ),
    );
  }
}

class _Detail extends StatelessWidget {
  const _Detail({required this.context$, required this.currentUserId});

  final MobileFieldContextContract context$;
  final String? currentUserId;

  @override
  Widget build(BuildContext context) {
    final item = context$.workItem;
    final assignment = assignmentOf(item, currentUserId);

    return ListView(
      padding: const EdgeInsets.all(OrbitSpacing.gutter),
      children: [
        _Header(item: item, assignment: assignment),

        if (item.pendingCancellation
            case final MobilePendingCancellationContract pedido)
          _PedidoEnviado(pedido: pedido),

        _Agendamento(item: item),

        if (item.customer case final MobileCustomerSummaryContract cliente)
          _Cliente(cliente: cliente, item: item),

        if (context$.financialSummary
            case final MobileFinancialSummaryContract financeiro)
          _Valor(financeiro: financeiro),

        if (context$.requestDescription case final String descricao
            when descricao.trim().isNotEmpty)
          SectionBlock(
            inset: 0,
            title: 'O que foi pedido',
            child: Text(
              descricao,
              style: const TextStyle(
                fontSize: 14,
                color: OrbitColors.textPrimary,
              ),
            ),
          ),

        if (item.equipmentSummary.isNotEmpty)
          SectionBlock(
            inset: 0,
            title: 'Equipamento',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final equipment in item.equipmentSummary)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          equipment.name,
                          style: const TextStyle(
                            fontSize: 14,
                            color: OrbitColors.textPrimary,
                          ),
                        ),
                        Text(
                          [equipment.code, equipment.type, equipment.sector]
                              .whereType<String>()
                              .where((v) => v.isNotEmpty)
                              .join(' · '),
                          style: const TextStyle(
                            fontSize: 12,
                            color: OrbitColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),

        _Team(item: item),

        if (context$.procedures.isNotEmpty)
          SectionBlock(
            inset: 0,
            title: 'Procedimentos',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final procedure in context$.procedures)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(
                      procedure.title,
                      style: const TextStyle(
                        fontSize: 13,
                        color: OrbitColors.textPrimary,
                      ),
                    ),
                  ),
              ],
            ),
          ),

        if (context$.documentContext.isNotEmpty)
          SectionBlock(
            inset: 0,
            title: 'Documentos',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final document in context$.documentContext)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(
                      document.type,
                      style: const TextStyle(
                        fontSize: 13,
                        color: OrbitColors.textSecondary,
                      ),
                    ),
                  ),
              ],
            ),
          ),

        _Actions(item: item),
      ],
    );
  }
}

/// O relato já enviado, esperando decisão.
///
/// Ocupa o lugar do botão de cancelar. Sem isto o técnico pediria de novo a cada
/// vez que abrisse o atendimento, sem sinal de que o primeiro chegou.
class _PedidoEnviado extends StatelessWidget {
  const _PedidoEnviado({required this.pedido});

  final MobilePendingCancellationContract pedido;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;

    return SectionBlock(
      inset: 0,
      title: 'Cancelamento pedido',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Enviado em ${OrbitFormat.dateHourOf(pedido.requestedAt)}. '
            'O responsável decide se remarca, troca o técnico ou cancela.',
            style: OrbitType.body.copyWith(color: palette.inkMuted),
          ),
          if (pedido.reason.isNotEmpty) ...[
            const SizedBox(height: OrbitSpacing.sm),
            Text(
              pedido.reason,
              style: OrbitType.body.copyWith(color: palette.ink),
            ),
          ],
        ],
      ),
    );
  }
}

/// Quando, e de que tipo.
class _Agendamento extends StatelessWidget {
  const _Agendamento({required this.item});

  final MobileWorkItemContract item;

  @override
  Widget build(BuildContext context) => SectionBlock(
    inset: 0,
    title: 'Agendamento',
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Linha(
          icone: Icons.event_outlined,
          rotulo: 'Data e hora',
          valor: item.scheduledFor == null
              ? 'Sem data programada'
              : OrbitFormat.dateHourOf(item.scheduledFor),
        ),
        if (item.serviceType case final String tipo) ...[
          const SizedBox(height: OrbitSpacing.sm),
          _Linha(
            icone: Icons.handyman_outlined,
            rotulo: 'Tipo de atendimento',
            valor: tipo,
          ),
        ],
      ],
    ),
  );
}

/// Para quem, onde e por qual telefone.
///
/// O endereço sai em partes: logradouro numa linha, complemento e ponto de
/// referência nas suas. Tudo junto, quem procura a portaria lê o CEP primeiro.
class _Cliente extends StatelessWidget {
  const _Cliente({required this.cliente, required this.item});

  final MobileCustomerSummaryContract cliente;
  final MobileWorkItemContract item;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    final endereco = item.serviceAddress;
    final telefone = cliente.contact?.phone;

    return SectionBlock(
      inset: 0,
      title: 'Cliente',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            cliente.name,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: OrbitColors.textPrimary,
            ),
          ),

          if (cliente.contact?.name case final String contato) ...[
            const SizedBox(height: 2),
            Text(
              'Falar com $contato',
              style: OrbitType.caption.copyWith(color: palette.inkMuted),
            ),
          ],

          const SizedBox(height: OrbitSpacing.sm),

          if (endereco != null) ...[
            _Linha(
              icone: Icons.place_outlined,
              rotulo: endereco.label ?? 'Endereço',
              valor: endereco.linha,
            ),
            /* Complemento e referência em linha própria — é o que decide se a
               pessoa acha a portaria, e some no meio do logradouro. */
            if (endereco.complement case final String complemento) ...[
              const SizedBox(height: OrbitSpacing.xs),
              _Linha(
                icone: Icons.meeting_room_outlined,
                rotulo: 'Complemento',
                valor: complemento,
              ),
            ],
            if (endereco.sector case final String setor) ...[
              const SizedBox(height: OrbitSpacing.xs),
              _Linha(
                icone: Icons.door_front_door_outlined,
                rotulo: 'Local no endereço',
                valor: setor,
              ),
            ],
            if (endereco.reference case final String referencia) ...[
              const SizedBox(height: OrbitSpacing.xs),
              _Linha(
                icone: Icons.info_outline,
                rotulo: 'Ponto de referência',
                valor: referencia,
              ),
            ],
          ] else if (locationText(item) case final String lugar) ...[
            _Linha(
              icone: Icons.place_outlined,
              rotulo: 'Endereço',
              valor: lugar,
            ),
          ],

          if (telefone != null && telefone.isNotEmpty) ...[
            const SizedBox(height: OrbitSpacing.xs),
            _Linha(
              icone: Icons.phone_outlined,
              rotulo: 'Telefone',
              valor: telefone,
            ),
          ],
        ],
      ),
    );
  }
}

/// Quanto vale — só quando o responsável liberou para o campo.
///
/// A seção **não existe** quando não há liberação, em vez de mostrar traço ou
/// zero: ausência é a única forma de não afirmar nada sobre o valor.
class _Valor extends StatelessWidget {
  const _Valor({required this.financeiro});

  final MobileFinancialSummaryContract financeiro;

  @override
  Widget build(BuildContext context) {
    final valor = double.tryParse(financeiro.approvedAmount ?? '');
    if (valor == null) return const SizedBox.shrink();

    return SectionBlock(
      inset: 0,
      title: 'Valor do atendimento',
      child: _Linha(
        icone: Icons.payments_outlined,
        rotulo: 'Orçamento aprovado',
        valor: OrbitFormat.currency(valor),
      ),
    );
  }
}

/// Uma linha rotulada: ícone, rótulo pequeno, valor legível.
class _Linha extends StatelessWidget {
  const _Linha({
    required this.icone,
    required this.rotulo,
    required this.valor,
  });

  final IconData icone;
  final String rotulo;
  final String valor;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Icon(icone, size: 16, color: palette.inkSubtle),
        ),
        const SizedBox(width: OrbitSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                rotulo,
                style: OrbitType.caption.copyWith(color: palette.inkMuted),
              ),
              Text(
                valor,
                style: OrbitType.body.copyWith(color: palette.ink),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.item, required this.assignment});

  final MobileWorkItemContract item;
  final FieldAssignment assignment;

  @override
  Widget build(BuildContext context) {
    final status = operationalStatusLabel(item.operationalStatus);

    return SectionBlock(
      inset: 0,
      title: workItemKindLabel(item.kind),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            item.title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: OrbitColors.textPrimary,
            ),
          ),
          const SizedBox(height: OrbitSpacing.sm),
          Wrap(
            spacing: OrbitSpacing.sm,
            runSpacing: 6,
            children: [
              _Tag(label: dueStateLabel(item.dueState)),
              if (status != null) _Tag(label: status),
              if (assignment != FieldAssignment.none)
                _Tag(label: assignmentLabel(assignment)),
            ],
          ),
          /* A data saiu daqui: a seção Agendamento logo abaixo a mostra com
             rótulo e ao lado do tipo do atendimento. Duas vezes na mesma tela
             era ruído, e a de cima era a que dizia menos. */
        ],
      ),
    );
  }
}

/// Responsável e auxiliares, com os termos do domínio.
class _Team extends StatelessWidget {
  const _Team({required this.item});

  final MobileWorkItemContract item;

  @override
  Widget build(BuildContext context) {
    final responsible = item.responsibleFieldTechnician;
    final auxiliaries = item.auxiliaryTechnicians;
    if (responsible == null && auxiliaries.isEmpty) {
      return const SizedBox.shrink();
    }

    return SectionBlock(
      inset: 0,
      title: 'Equipe',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (responsible != null) ...[
            const Text(
              'Técnico em Campo',
              style: TextStyle(fontSize: 12, color: OrbitColors.textSecondary),
            ),
            Text(
              responsible.name,
              style: const TextStyle(
                fontSize: 14,
                color: OrbitColors.textPrimary,
              ),
            ),
          ],
          if (auxiliaries.isNotEmpty) ...[
            const SizedBox(height: OrbitSpacing.sm),
            const Text(
              auxiliaryTechniciansLabel,
              style: TextStyle(fontSize: 12, color: OrbitColors.textSecondary),
            ),
            Text(
              auxiliaries.map((person) => person.name).join(', '),
              style: const TextStyle(
                fontSize: 14,
                color: OrbitColors.textPrimary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// As duas ações do atendimento: começar, ou avisar que não dá.
///
/// ## Por que duas, e não a lista publicada
///
/// Esta seção desenhava um botão por item de `allowedActions`. Dava uma pilha de
/// botões soltos — "Abrir", "Registrar evidência", "Ler etiqueta" —, parte deles
/// desabilitada com um aviso, nenhum em destaque. As outras ações têm lugar
/// próprio no roteiro de execução, que é onde elas fazem sentido; aqui só cabem
/// as duas decisões que se toma antes de entrar.
///
/// O servidor continua mandando: `START`/`RESUME` e `REQUEST_CANCELLATION` são
/// publicados por ele, e sem a ação na lista o botão não aparece.
class _Actions extends ConsumerWidget {
  const _Actions({required this.item});

  final MobileWorkItemContract item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final iniciar = _iniciar(context, item);
    final podePedirCancelamento =
        item.allowedActions.contains(MobileFieldAction.requestCancellation) &&
        item.pendingCancellation == null;

    if (iniciar == null && !podePedirCancelamento) {
      return const SizedBox.shrink();
    }

    final retomando = item.allowedActions.contains(MobileFieldAction.resume);

    return SectionBlock(
      inset: 0,
      title: 'Ações',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (iniciar != null)
            FilledButton(
              onPressed: iniciar,
              style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
              child: Text(
                retomando ? 'Retomar o Atendimento' : 'Iniciar o Atendimento',
              ),
            ),

          if (iniciar != null && podePedirCancelamento)
            const SizedBox(height: OrbitSpacing.sm),

          if (podePedirCancelamento)
            OutlinedButton(
              onPressed: () => _pedirCancelamento(context, ref),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(0, 48),
                foregroundColor: context.orbit.danger,
              ),
              child: const Text('Cancelar o Atendimento'),
            ),

          if (podePedirCancelamento)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Avisa o responsável. Ele decide se remarca, troca o técnico '
                'ou cancela de fato.',
                style: OrbitType.caption.copyWith(
                  color: context.orbit.inkSubtle,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _pedirCancelamento(BuildContext context, WidgetRef ref) async {
    /* Só atendimento avulso tem operação a cancelar; PMOC e visita não
       publicam a ação, e esta guarda é a que mantém a promessa. */
    if (item.kind != MobileWorkItemKind.serviceOperation) return;

    final enviado = await showCancellationSheet(
      context,
      operationId: item.navigationContext.sourceId,
    );
    if (!enviado) return;

    /* Recarrega para a tela trocar o botão pelo relato enviado — é o sinal de
       que o pedido chegou. */
    ref.invalidate(fieldWorkItemProvider(item.id));
  }
}

/// Para onde este item começa, se começa.
///
/// Atendimento avulso vai para a execução da operação; PMOC vai para o
/// atendimento **do equipamento** naquele ciclo — rotas diferentes porque são
/// domínios diferentes, com contagem, documento e autoridade próprios.
///
/// Visita técnica continua em leitura: a PR dela ainda não existe, e devolver
/// `null` tira o botão em vez de prometer o que não cumpre.
VoidCallback? _iniciar(BuildContext context, MobileWorkItemContract item) {
  final comecar =
      item.allowedActions.contains(MobileFieldAction.start) ||
      item.allowedActions.contains(MobileFieldAction.resume);
  if (!comecar) return null;

  final navegacao = item.navigationContext;

  switch (item.kind) {
    case MobileWorkItemKind.serviceOperation:
      return () =>
          context.push(OrbitRoutes.operationExecution(navegacao.sourceId));

    case MobileWorkItemKind.pmoc:
      /* Os três identificadores ou nenhum: a rota de atendimento é escopada por
         plano, ciclo e equipamento, e montá-la com um vazio levaria a uma tela
         que só sabe dizer "não encontrado". */
      final planId = navegacao.planId;
      final cycleId = navegacao.cycleId;
      final assetId = navegacao.equipmentId;
      if (planId == null || cycleId == null || assetId == null) return null;
      return () => context.push(
        OrbitRoutes.pmocAttendance(
          planId: planId,
          cycleId: cycleId,
          assetId: assetId,
        ),
      );

    case MobileWorkItemKind.rvt:
      return null;
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: OrbitColors.surface,
      borderRadius: OrbitRadius.pill,
    ),
    child: Text(
      label,
      style: const TextStyle(fontSize: 11, color: OrbitColors.textSecondary),
    ),
  );
}
