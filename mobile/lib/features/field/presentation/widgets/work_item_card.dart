/// O cartão de um item de trabalho.
///
/// É a peça mais lida do app: o profissional passa os olhos e precisa saber,
/// nessa ordem, **quando**, **para quem**, **onde**, **o quê** e **o que fazer
/// agora**. Tudo o mais é ruído em pé de escada.
///
/// Nada aqui é calculado. O selo de prazo vem de `dueState`, decidido no fuso
/// da unidade; a ação principal vem de `primaryAction`; e a posição na lista é
/// a que o servidor deu.
library;

import 'package:flutter/material.dart';

import '../../../../core/contracts/mobile_field_contracts.dart';
import '../../../../core/presentation/field_registry.dart';
import '../../../../core/presentation/orbit_format.dart';
import '../../../../core/theme/orbit_theme.dart';

/// Cores do selo de prazo.
///
/// Atrasado é crítico, mas sem alarme: quem está em campo já sabe que atrasou,
/// e uma tela gritando não ajuda a chegar mais rápido.
const _dueTone = <MobileDueState, Color>{
  MobileDueState.inProgress: OrbitColors.brandBright,
  MobileDueState.overdue: OrbitColors.danger,
  MobileDueState.dueToday: OrbitColors.warning,
  MobileDueState.upcoming: OrbitColors.textSecondary,
  MobileDueState.unscheduled: OrbitColors.textSecondary,
};

class WorkItemCard extends StatelessWidget {
  const WorkItemCard({
    super.key,
    required this.item,
    required this.onOpen,
    this.currentUserId,
  });

  final MobileWorkItemContract item;
  final VoidCallback onOpen;

  /// Para dizer qual é a função de quem está lendo, quando houver.
  final String? currentUserId;

  @override
  Widget build(BuildContext context) {
    final due = _dueTone[item.dueState] ?? OrbitColors.textSecondary;
    final assignment = assignmentOf(item, currentUserId);
    final equipment = item.equipmentSummary;

    return Semantics(
      button: true,
      label: semanticLabel(item),
      child: Card(
        margin: const EdgeInsets.only(bottom: OrbitSpacing.sm),
        child: InkWell(
          onTap: onOpen,
          borderRadius: OrbitRadius.card,
          child: Padding(
            padding: const EdgeInsets.all(OrbitSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                /// Linha 1 — quando e em que situação.
                ///
                /// `Wrap`, não `Row`: com fonte ampliada ou tela estreita os
                /// selos passam para a linha de baixo em vez de estourar. Em
                /// campo o aparelho é do técnico, com as configurações dele.
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: OrbitSpacing.sm,
                  runSpacing: 6,
                  children: [
                    Text(
                      scheduleText(item),
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: due,
                      ),
                    ),
                    _Chip(label: dueStateLabel(item.dueState), color: due),
                    _Chip(
                      label: workItemKindLabel(item.kind),
                      color: OrbitColors.textSecondary,
                    ),
                  ],
                ),
                const SizedBox(height: OrbitSpacing.sm),

                /// Linha 2 — para quem.
                Text(
                  item.customer?.name ?? item.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: OrbitColors.textPrimary,
                  ),
                ),

                /// Linha 3 — onde.
                if (locationText(item) case final String place)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.place_outlined,
                          size: 14,
                          color: OrbitColors.textSecondary,
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            place,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 13,
                              color: OrbitColors.textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                /// Linha 4 — o quê, quando o item aponta para equipamento.
                if (equipment.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      equipmentText(equipment),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        color: OrbitColors.textSecondary,
                      ),
                    ),
                  ),

                if (assignment != FieldAssignment.none) ...[
                  const SizedBox(height: OrbitSpacing.sm),
                  _Chip(
                    label: assignmentLabel(assignment),
                    color: OrbitColors.brand,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Horário do item — instante, exibido no relógio de quem lê.
///
/// Sem data agendada não se inventa uma: "Sem data" é a informação correta, e
/// o servidor já disse isso em `dueState`.
String scheduleText(MobileWorkItemContract item) => item.scheduledFor == null
    ? 'Sem data'
    : OrbitFormat.hourOf(item.scheduledFor);

/// A função de quem está lendo, derivada dos campos publicados.
FieldAssignment assignmentOf(
  MobileWorkItemContract item,
  String? currentUserId,
) {
  if (currentUserId == null) return FieldAssignment.none;
  if (item.responsibleFieldTechnician?.id == currentUserId) {
    return FieldAssignment.responsible;
  }
  if (item.auxiliaryTechnicians.any((person) => person.id == currentUserId)) {
    return FieldAssignment.auxiliary;
  }
  return FieldAssignment.none;
}

/// Local legível a partir do JSON livre de `location`, com o setor do
/// equipamento como segunda melhor resposta.
String? locationText(MobileWorkItemContract item) {
  final location = item.location;
  for (final key in ['label', 'address', 'street', 'city', 'name']) {
    final value = location?[key];
    if (value is String && value.trim().isNotEmpty) return value.trim();
  }
  final sector = item.equipmentSummary
      .map((equipment) => equipment.sector)
      .whereType<String>()
      .where((value) => value.trim().isNotEmpty)
      .firstOrNull;
  return sector;
}

/// Um equipamento pelo nome; vários, pela contagem.
String equipmentText(List<MobileEquipmentSummaryContract> equipment) =>
    equipment.length == 1
    ? equipment.first.name
    : '${equipment.length} equipamentos';

/// O que um leitor de tela anuncia.
String semanticLabel(MobileWorkItemContract item) => [
  workItemKindLabel(item.kind),
  dueStateLabel(item.dueState),
  scheduleText(item),
  item.customer?.name ?? item.title,
].where((part) => part.isNotEmpty).join(', ');

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    if (label.isEmpty) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: OrbitRadius.pill,
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}
