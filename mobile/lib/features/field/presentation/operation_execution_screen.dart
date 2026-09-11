/// Execução de um atendimento em campo.
///
/// Preparação, início, checklist, observações, materiais e conclusão — todos
/// pelos comandos semânticos do MB-02. A tela mostra o estado publicado e
/// envia intenções; ela não sabe o que é uma transição válida.
///
/// Abrir esta tela **não muda nada**: a preparação é um `GET`.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/contracts/field_operation_contracts.dart';
import '../../../core/design/orbit_primitives.dart';
import '../../../core/design/orbit_wizard.dart';
import '../../../core/presentation/field_registry.dart';
import '../../../core/presentation/orbit_format.dart';
import '../../../core/theme/orbit_theme.dart';
import '../../../core/widgets/section_states.dart';
import '../../../core/contracts/mobile_evidence_contracts.dart';
import '../../../core/contracts/mobile_offline_sync_contracts.dart';
import '../../../core/routing/orbit_router.dart';
import '../../evidence/presentation/widgets/evidence_section.dart';
import '../../sync/data/command_journal.dart';
import '../../sync/presentation/widgets/pending_badge.dart';
import '../application/execution_controller.dart';
import 'widgets/execution_actions.dart';
import 'widgets/execution_checklist.dart';
import 'widgets/execution_signing.dart';
import 'widgets/material_sheet.dart';
import 'widgets/note_sheet.dart';

class OperationExecutionScreen extends ConsumerWidget {
  const OperationExecutionScreen({super.key, required this.operationId});

  final String operationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(executionControllerProvider(operationId));
    final controller = ref.read(
      executionControllerProvider(operationId).notifier,
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Atendimento')),
      body: switch (state.phase) {
        ExecutionPhase.loading => const Padding(
          padding: EdgeInsets.all(OrbitSpacing.gutter),
          child: SectionLoading(lines: 6),
        ),
        ExecutionPhase.error when state.preparation == null => ListView(
          padding: const EdgeInsets.all(OrbitSpacing.gutter),
          children: [
            SectionError(error: state.error!, onRetry: controller.load),
          ],
        ),
        _ => _Body(
          state: state,
          controller: controller,
          operationId: operationId,
        ),
      },

      /// A ação principal fica ao alcance do polegar, acima da área de gestos.
      bottomNavigationBar: state.preparation == null
          ? null
          : SafeArea(
              minimum: const EdgeInsets.all(OrbitSpacing.gutter),
              child: ExecutionPrimaryAction(
                state: state,
                controller: controller,
              ),
            ),
    );
  }
}

/// O corpo da execução, em etapas.
///
/// ## O que mudou, e por quê
///
/// Eram sete seções empilhadas numa rolagem só. Quem executa em campo está de
/// pé, de luva, com o celular numa mão — rolava para achar o checklist, rolava
/// de volta para a evidência, e não tinha como saber o que ainda faltava antes
/// de tentar concluir. O roteiro responde **onde estou** e **o que falta**.
///
/// ## O que continua igual
///
/// Tudo o que é domínio. Cada etapa continua mostrando exatamente o que o
/// servidor publicou: `allowedActions` decide o que vira botão, `blockers`
/// dizem por que ainda não dá, `version` viaja em todo comando, e o journal
/// offline continua sendo o mesmo. Mudar de etapa **não envia comando nenhum**
/// — é navegação, e sair no meio não perde o que já foi registrado.
///
/// Nenhuma etapa é marcada como cumprida por dedução da tela: "cumprida" vem
/// de `eligible` e do `progress` que o servidor calcula.
class _Body extends StatelessWidget {
  const _Body({
    required this.state,
    required this.controller,
    required this.operationId,
  });

  final ExecutionState state;
  final ExecutionController controller;
  final String operationId;

  @override
  Widget build(BuildContext context) {
    final preparation = state.preparation!;
    final checklists = preparation.checklist;

    /// Progresso do checklist é **do servidor**. A tela não conta itens
    /// respondidos para chegar a um número próprio.
    final checklistCumprido =
        checklists.isNotEmpty &&
        checklists.every((lista) => lista.progress >= 100);

    final etapas = <OrbitWizardStep>[
      OrbitWizardStep(
        title: 'Preparação',
        hint: 'Confira para quem, onde e o quê antes de começar.',
        complete: preparation.eligible,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _Summary(preparation: preparation),

            /// O que foi registrado e ainda não chegou ao servidor.
            ///
            /// Fica **acima** das ações e separado do estado confirmado: um
            /// atendimento com início pendente não é um atendimento em
            /// andamento, e a tela não pode sugerir que é.
            if (state.pendingCommands.isNotEmpty)
              _PendingIntentions(
                commands: state.pendingCommands,
                onOpenSyncCenter: () => context.push(OrbitRoutes.syncCenter),
              ),

            if (!preparation.eligible && preparation.blockers.isNotEmpty)
              _Blockers(blockers: preparation.blockers),
          ],
        ),
      ),

      OrbitWizardStep(
        title: 'Execução',
        hint: 'Responda o checklist previsto para este atendimento.',

        /// Sem checklist a etapa não some do trilho — fica desabilitada. Some
        /// faria a contagem de etapas mudar de atendimento para atendimento, e
        /// "etapa 3 de 5" deixaria de significar a mesma coisa.
        enabled: checklists.isNotEmpty,
        complete: checklistCumprido,
        child: checklists.isEmpty
            ? const OrbitEmptyState(
                icon: Icons.checklist_outlined,
                title: 'Sem checklist previsto',
                description: 'Este atendimento não tem itens a responder.',
              )
            : ExecutionChecklist(
                checklists: checklists,
                enabled:
                    state.allows(FieldOperationAllowedAction.updateChecklist) &&
                    !state.isBusy,
                onAnswer: (checklistId, itemId, answer) =>
                    controller.answerChecklistItem(
                      checklistId: checklistId,
                      itemId: itemId,
                      answer: answer,
                    ),
              ),
      ),

      OrbitWizardStep(
        title: 'Evidências',
        hint: 'Registre o que comprova o serviço feito.',

        /// A seção só oferece captura quando o servidor publica
        /// `ADD_EVIDENCE`. Quem pode anexar é decisão dele — o app mostra o
        /// que foi autorizado.
        child: EvidenceSection(
          target: FieldEvidenceTargetRef(
            type: FieldEvidenceTarget.operation,
            id: operationId,
          ),
          canCapture: state.allows(FieldOperationAllowedAction.addEvidence),
        ),
      ),

      OrbitWizardStep(
        title: 'Materiais',
        hint: 'Materiais aplicados e observações do atendimento.',
        enabled:
            preparation.materialPolicy.enabled ||
            state.allows(FieldOperationAllowedAction.addNote),
        child: ExecutionSecondaryActions(
          state: state,
          onNote: () => showNoteSheet(context, controller),
          onMaterial: () => showMaterialSheet(context, controller),
        ),
      ),

      OrbitWizardStep(
        title: 'Confirmação',
        hint: 'Assinatura profissional, aceite do cliente e documento.',
        child: ExecutionSigningSections(
          operationId: operationId,
          preparation: preparation,
        ),
      ),

      OrbitWizardStep(
        title: 'Finalização',
        hint: 'Encerre o atendimento e veja o que foi registrado.',
        complete: preparation.operation.completedAt != null,
        child: _Timeline(operationId: operationId),
      ),
    ];

    return RefreshIndicator(
      /// Não recarrega por cima de um comando em voo: o resultado dele é que
      /// define o estado seguinte.
      onRefresh: () async => state.isBusy ? null : controller.load(),
      child: ListView(
        padding: const EdgeInsets.only(bottom: OrbitSpacing.xl),
        children: [
          if (state.phase == ExecutionPhase.conflict)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                OrbitSpacing.md,
                OrbitSpacing.md,
                OrbitSpacing.md,
                0,
              ),
              child: _ConflictBanner(
                onRefresh: controller.refreshAfterConflict,
              ),
            ),

          if (state.phase == ExecutionPhase.error && state.error != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                OrbitSpacing.md,
                OrbitSpacing.md,
                OrbitSpacing.md,
                0,
              ),
              child: SectionError(
                error: state.error!,
                onRetry: controller.load,
              ),
            ),

          OrbitWizard(steps: etapas),
        ],
      ),
    );
  }
}

/// Contexto do atendimento: quem, onde, o quê, e quem executou.
class _Summary extends StatelessWidget {
  const _Summary({required this.preparation});

  final FieldOperationExecutionPreparationContract preparation;

  @override
  Widget build(BuildContext context) {
    final operation = preparation.operation;
    final status = operationalStatusLabel(operation.status);

    final palette = context.orbit;

    /// Cartão, e não bloco solto: é a ficha do atendimento — código, título,
    /// situação, cliente, equipamento e quem é responsável — e tudo isso se
    /// lê junto ou não se lê.
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: OrbitSpacing.gutter),
      child: OrbitCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              operation.code,
              style: OrbitType.eyebrow.copyWith(color: palette.inkSubtle),
            ),
            const SizedBox(height: 4),
            Text(
              operation.title,
              style: OrbitType.sectionTitle.copyWith(color: palette.ink),
            ),
            const SizedBox(height: OrbitSpacing.sm),

            /// Situação em português. Código sem tradução simplesmente não
            /// vira texto — decifrar o sistema não é tarefa de quem está em
            /// campo.
            if (status != null)
              OrbitStatusBadge(label: status, tone: OrbitTone.info),

            if (preparation.customer case final customer?) ...[
              const SizedBox(height: OrbitSpacing.sm),
              _Line(label: 'Cliente', value: customer.name),
            ],

            for (final equipment in preparation.equipment)
              _Line(label: 'Equipamento', value: equipment.name),

            if (operation.scheduledFor != null)
              _Line(
                label: 'Programado',
                value: OrbitFormat.dateHourOf(operation.scheduledFor),
              ),

            if (preparation.responsibleFieldTechnician != null ||
                preparation.auxiliaryTechnicians.isNotEmpty ||
                operation.startedBy != null ||
                operation.completedBy != null) ...[
              const SizedBox(height: OrbitSpacing.ms),
              Divider(height: 1, color: palette.border),
              const SizedBox(height: OrbitSpacing.xs),
            ],

            if (preparation.responsibleFieldTechnician case final responsible?)
              _Line(label: 'Técnico em Campo', value: responsible.name),
            if (preparation.auxiliaryTechnicians.isNotEmpty)
              _Line(
                label: auxiliaryTechniciansLabel,
                value: preparation.auxiliaryTechnicians
                    .map((person) => person.name)
                    .join(', '),
              ),

            /// Quem executou é **histórico** e nunca substitui a escala: pode
            /// ser outra pessoa, e trocar um pelo outro apagaria o fato.
            if (operation.startedBy case final startedBy?)
              _Line(
                label: 'Iniciado por',
                value:
                    '${startedBy.name}'
                    '${operation.startedAt == null ? '' : ' · ${OrbitFormat.dateHourOf(operation.startedAt)}'}',
              ),
            if (operation.completedBy case final completedBy?)
              _Line(
                label: 'Concluído por',
                value:
                    '${completedBy.name}'
                    '${operation.completedAt == null ? '' : ' · ${OrbitFormat.dateHourOf(operation.completedAt)}'}',
              ),
          ],
        ),
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 4),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: OrbitType.caption.copyWith(color: context.orbit.inkSubtle),
        ),
        Text(value, style: OrbitType.body.copyWith(color: context.orbit.ink)),
      ],
    ),
  );
}

/// O que impede executar, na frase do servidor.
class _Blockers extends StatelessWidget {
  const _Blockers({required this.blockers});

  final List<String> blockers;

  @override
  Widget build(BuildContext context) => SectionBlock(
    title: 'Ainda não é possível iniciar',
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final blocker in blockers)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(
              executionBlockerLabel(blocker),
              style: const TextStyle(fontSize: 13, color: OrbitColors.warning),
            ),
          ),
      ],
    ),
  );
}

class _ConflictBanner extends StatelessWidget {
  const _ConflictBanner({required this.onRefresh});

  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: OrbitSpacing.sm),
    padding: const EdgeInsets.all(OrbitSpacing.gutter),
    decoration: BoxDecoration(
      color: OrbitColors.warning.withValues(alpha: 0.12),
      borderRadius: OrbitRadius.field,
    ),
    child: Row(
      children: [
        const Expanded(
          child: Text(
            'Os dados foram alterados. Atualize e tente novamente.',
            style: TextStyle(fontSize: 13, color: OrbitColors.textPrimary),
          ),
        ),
        TextButton(onPressed: onRefresh, child: const Text('Atualizar')),
      ],
    ),
  );
}

class _Timeline extends ConsumerWidget {
  const _Timeline({required this.operationId});

  final String operationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final timeline = ref.watch(executionTimelineProvider(operationId));

    return SectionBlock(
      title: 'Histórico',
      child: timeline.when(
        loading: () => const SectionLoading(lines: 3),
        error: (error, _) => SectionError(
          error: error,
          onRetry: () => ref.invalidate(executionTimelineProvider(operationId)),
        ),
        data: (page) => page.data.isEmpty
            ? const Text(
                'Nada registrado ainda.',
                style: TextStyle(
                  fontSize: 13,
                  color: OrbitColors.textSecondary,
                ),
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  /// Na ordem publicada, com a frase que o servidor escreveu.
                  for (final entry in page.data)
                    Padding(
                      padding: const EdgeInsets.only(bottom: OrbitSpacing.sm),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            entry.message,
                            style: const TextStyle(
                              fontSize: 13,
                              color: OrbitColors.textPrimary,
                            ),
                          ),
                          Text(
                            [
                              OrbitFormat.dateHourOf(entry.occurredAt),
                              if (entry.actor case final actor?) actor.name,
                            ].join(' · '),
                            style: const TextStyle(
                              fontSize: 11,
                              color: OrbitColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
      ),
    );
  }
}

/// As intenções deste atendimento que o servidor ainda não confirmou.
///
/// Cada uma aparece pelo que é, em português, e nunca como conclusão. O ponto
/// da faixa é justamente impedir que "registrei" seja lido como "está feito".
class _PendingIntentions extends StatelessWidget {
  const _PendingIntentions({
    required this.commands,
    required this.onOpenSyncCenter,
  });

  final List<PendingCommand> commands;
  final VoidCallback onOpenSyncCenter;

  @override
  Widget build(BuildContext context) {
    final blocked = commands.where((value) => value.isBlocking).toList();
    final waiting = commands.where((value) => !value.isBlocking).toList();

    return SectionBlock(
      title: 'Registrado neste aparelho',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final command in waiting)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),

              /// `Wrap` e não `Row`: com escala de texto grande, rótulo e selo
              /// não cabem lado a lado e precisam quebrar em vez de estourar.
              child: Wrap(
                spacing: OrbitSpacing.sm,
                runSpacing: 4,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    pendingCommandLabel(
                      offlineCommandTypeWire(command.envelope.commandType),
                    ),
                    style: const TextStyle(fontSize: 13),
                  ),
                  const PendingBadge(),
                ],
              ),
            ),

          for (final command in blocked)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: OrbitSpacing.sm,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        pendingCommandLabel(
                          offlineCommandTypeWire(command.envelope.commandType),
                        ),
                        style: const TextStyle(fontSize: 13),
                      ),
                      const BlockedBadge(label: 'Não sincronizou'),
                    ],
                  ),
                  Text(
                    syncBlockedLabel(
                      conflictCode: switch (command.receipt?.conflict?.code) {
                        final code? => offlineConflictCodeWire(code),
                        null => null,
                      },
                      errorCode: command.receipt?.error?.code,
                    ),
                    style: const TextStyle(
                      fontSize: 12,
                      color: OrbitColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),

          const SizedBox(height: OrbitSpacing.sm),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: onOpenSyncCenter,
              child: const Text('Ver sincronização'),
            ),
          ),
        ],
      ),
    );
  }
}
