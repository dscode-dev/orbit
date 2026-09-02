/// O contexto de um item de trabalho.
///
/// Uma requisição (`GET /mobile/field/work-items/:id`) traz tudo: o item,
/// o pedido do cliente, os procedimentos, os documentos e a equipe. Montar
/// isso a partir de várias APIs reconstruiria no aparelho o recorte que o
/// servidor já fez — e cada pedaço chegaria de um instante diferente.
///
/// ## As ações são as publicadas
///
/// `allowedActions` decide o que aparece; `primaryAction` decide o que é
/// destaque. Nada é habilitado por status, e nada é inventado.
///
/// Execução de campo — iniciar, concluir, evidência, assinatura — é da FL-03.
/// Enquanto não existe, as ações correspondentes aparecem descritas e
/// desabilitadas, dizendo onde acontecem. Botão que promete e não cumpre é
/// pior que botão ausente.
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
import 'widgets/work_item_card.dart';

class WorkItemDetailScreen extends ConsumerWidget {
  const WorkItemDetailScreen({super.key, required this.workItemId});

  final String workItemId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final context$ = ref.watch(fieldWorkItemProvider(workItemId));
    final session = ref.watch(sessionProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Item de trabalho')),
      body: RefreshIndicator(
        onRefresh: () async =>
            ref.invalidate(fieldWorkItemProvider(workItemId)),
        child: context$.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(OrbitSpacing.md),
            child: SectionLoading(lines: 6),
          ),
          error: (error, _) => ListView(
            padding: const EdgeInsets.all(OrbitSpacing.md),
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
                  padding: const EdgeInsets.all(OrbitSpacing.md),
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
      padding: const EdgeInsets.all(OrbitSpacing.md),
      children: [
        _Header(item: item, assignment: assignment),

        if (context$.requestDescription case final String description
            when description.trim().isNotEmpty)
          SectionCard(
            title: 'O que foi pedido',
            child: Text(
              description,
              style: const TextStyle(
                fontSize: 14,
                color: OrbitColors.textPrimary,
              ),
            ),
          ),

        if (item.customer case final MobileCustomerSummaryContract customer)
          SectionCard(
            title: 'Cliente',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  customer.name,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: OrbitColors.textPrimary,
                  ),
                ),
                if (locationText(item) case final String place)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      place,
                      style: const TextStyle(
                        fontSize: 13,
                        color: OrbitColors.textSecondary,
                      ),
                    ),
                  ),
                if (customer.contact?.name case final String contact)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      'Contato: $contact',
                      style: const TextStyle(
                        fontSize: 13,
                        color: OrbitColors.textSecondary,
                      ),
                    ),
                  ),
              ],
            ),
          ),

        if (item.equipmentSummary.isNotEmpty)
          SectionCard(
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
          SectionCard(
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
          SectionCard(
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

class _Header extends StatelessWidget {
  const _Header({required this.item, required this.assignment});

  final MobileWorkItemContract item;
  final FieldAssignment assignment;

  @override
  Widget build(BuildContext context) {
    final status = operationalStatusLabel(item.operationalStatus);

    return SectionCard(
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
          const SizedBox(height: OrbitSpacing.sm),
          Text(
            item.scheduledFor == null
                ? 'Sem data programada'
                : OrbitFormat.dateHourOf(item.scheduledFor),
            style: const TextStyle(
              fontSize: 13,
              color: OrbitColors.textSecondary,
            ),
          ),
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

    return SectionCard(
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

/// As ações que o servidor permitiu — nem uma a mais.
class _Actions extends ConsumerWidget {
  const _Actions({required this.item});

  final MobileWorkItemContract item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    /// Ordena só para destacar a principal; as demais mantêm a ordem recebida.
    final actions = [
      if (item.primaryAction != null) item.primaryAction!,
      ...item.allowedActions.where((action) => action != item.primaryAction),
    ];
    if (actions.isEmpty) return const SizedBox.shrink();

    return SectionCard(
      title: 'Ações',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final action in actions)
            if (fieldActionLabel(action) case final FieldLabel label)
              Padding(
                padding: const EdgeInsets.only(bottom: OrbitSpacing.sm),
                child: _ActionButton(
                  label: label,
                  isPrimary: action == item.primaryAction,
                  destination: fieldActionDestination(action),

                  /// Atendimento é o único tipo com execução implementada
                  /// (FL-03). PMOC e visita técnica seguem em leitura até as
                  /// PRs delas — oferecer o botão aqui prometeria o que a tela
                  /// não faz.
                  onExecute:
                      item.kind == MobileWorkItemKind.serviceOperation &&
                          _executable.contains(action)
                      ? () => context.push(
                          OrbitRoutes.operationExecution(
                            item.navigationContext.sourceId,
                          ),
                        )
                      : null,
                ),
              ),
        ],
      ),
    );
  }
}

/// Ações que levam à execução de campo, quando o item é um atendimento.
const _executable = <MobileFieldAction>{
  MobileFieldAction.start,
  MobileFieldAction.resume,
  MobileFieldAction.complete,
  MobileFieldAction.addEvidence,
};

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.label,
    required this.isPrimary,
    required this.destination,
    this.onExecute,
  });

  final FieldLabel label;
  final bool isPrimary;
  final FieldActionDestination destination;

  /// Quando presente, a ação abre a execução em vez de ficar desabilitada.
  final VoidCallback? onExecute;

  @override
  Widget build(BuildContext context) {
    /// Ação de execução ainda não implementada fica visível e desabilitada,
    /// com o motivo — para que a lista continue sendo a do servidor.
    final deferred =
        destination == FieldActionDestination.deferred && onExecute == null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          button: true,
          enabled: !deferred,
          label: label.label,
          child: isPrimary
              ? FilledButton(
                  onPressed: deferred ? null : onExecute,
                  style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
                  child: Text(label.label),
                )
              : OutlinedButton(
                  onPressed: deferred ? null : onExecute,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 48),
                  ),
                  child: Text(label.label),
                ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            deferred
                ? 'Disponível no aplicativo de campo, na execução da visita.'
                : (label.description ?? ''),
            style: const TextStyle(
              fontSize: 11,
              color: OrbitColors.textSecondary,
            ),
          ),
        ),
      ],
    );
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
