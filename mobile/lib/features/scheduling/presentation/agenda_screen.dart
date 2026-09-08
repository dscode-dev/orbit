/// Agenda operacional.
///
/// `GET /scheduling/agenda` com `view=DAY`. A navegação entre dias muda a
/// consulta — o backend é quem recorta o período.
library;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../core/contracts/agenda_contracts.dart';
import '../../../core/time/civil_time.dart';
import '../../../core/presentation/field_registry.dart';
import '../../../core/presentation/orbit_format.dart';
import '../../../core/design/orbit_primitives.dart';
import '../../../core/theme/orbit_theme.dart';
import '../../../core/widgets/section_states.dart';
import '../../../core/routing/orbit_router.dart';
import '../../field/application/field_providers.dart';
import '../../operations/data/operations_repository.dart';

/// Dia visível na agenda.
///
/// `null` significa **hoje**, e é o servidor quem diz qual dia é esse — no
/// fuso da unidade. Só quando o usuário navega a tela passa a carregar uma
/// data civil escolhida.
final agendaDateProvider = StateProvider.autoDispose<CivilDate?>((ref) => null);

final agendaProvider = FutureProvider.autoDispose<CachedResult<Agenda>>((
  ref,
) async {
  final date = ref.watch(agendaDateProvider);
  final session = ref.watch(sessionProvider);
  return ref
      .watch(agendaRepositoryProvider)
      .load(view: 'DAY', date: date, businessUnitId: session?.businessUnitId);
});

class AgendaScreen extends ConsumerWidget {
  const AgendaScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final date = ref.watch(agendaDateProvider);
    final agenda = ref.watch(agendaProvider);
    final session = ref.watch(sessionProvider);

    /// Índice evento → item de campo. Vazio enquanto carrega ou quando a fila
    /// não tem nada correspondente; nesse caso o cartão fica sem toque.
    final workItems =
        ref.watch(agendaWorkItemIndexProvider).valueOrNull ??
        const <String, String>{};

    // A agenda depende do módulo de scheduling no plano.
    if (session != null && !session.hasCapability('scheduling.read')) {
      return Scaffold(
        appBar: AppBar(title: const Text('Agenda')),
        body: const Padding(
          padding: EdgeInsets.all(OrbitSpacing.lg),
          child: SectionEmpty(
            icon: Icons.lock_outline,
            message:
                'O plano da organização não inclui o módulo de agendamento.',
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Agenda'),
        actions: [
          IconButton(tooltip: 'Escolher data', icon: const Icon(Icons.calendar_month_outlined),
            onPressed: agenda.valueOrNull?.value.civilDate == null ? null : () async {
              final anchor = date ?? agenda.valueOrNull!.value.civilDate!;
              final chosen = await showDatePicker(context: context,
                initialDate: DateTime(anchor.year, anchor.month, anchor.day),
                firstDate: DateTime(anchor.year - 5), lastDate: DateTime(anchor.year + 5, 12, 31));
              if (chosen != null && context.mounted) ref.read(agendaDateProvider.notifier).state = CivilDate(chosen.year, chosen.month, chosen.day);
            }),
          IconButton(
            tooltip: 'Hoje',
            icon: const Icon(Icons.today),

            /// Voltar para "hoje" é **esquecer** a data escolhida, não
            /// calcular uma nova: quem sabe que dia é hoje na unidade é o
            /// servidor.
            onPressed: () => ref.read(agendaDateProvider.notifier).state = null,
          ),
        ],
      ),
      body: Column(
        children: [
          _DayNavigator(
            selected: date,
            shown: agenda.valueOrNull?.value.civilDate,
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(agendaProvider),
              child: agenda.when(
                loading: () => const Padding(
                  padding: EdgeInsets.all(OrbitSpacing.gutter),
                  child: SectionLoading(lines: 5),
                ),
                error: (error, _) => ListView(
                  padding: const EdgeInsets.all(OrbitSpacing.gutter),
                  children: [
                    SectionError(
                      error: error,
                      onRetry: () => ref.invalidate(agendaProvider),
                    ),
                  ],
                ),
                data: (result) {
                  final events = result.value.events;
                  return ListView.builder(
                    padding: const EdgeInsets.all(OrbitSpacing.gutter),
                    itemCount: events.length + 1,
                    itemBuilder: (context, index) {
                      if (index == 0) return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        if (result.cachedAt != null) StaleDataBanner(cachedAt: result.cachedAt!),
                        if (events.isEmpty)
                          const SectionEmpty(icon: Icons.event_available_outlined, message: 'Nenhum compromisso neste dia.')
                        else Padding(padding: const EdgeInsets.only(bottom: 12),
                          child: Text(result.value.total == 1 ? '1 compromisso' : '${result.value.total} compromissos',
                            style: OrbitType.caption.copyWith(color: context.orbit.inkSubtle))),
                      ]);
                      final event = events[index - 1];
                      return Column(children: [
                        if (index > 1) const OrbitRowDivider(indent: 0),
                        _EventRow(event: event, workItemId: workItems[event.eventId]),
                      ]);
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Navegação por dia.
///
/// O rótulo e o ponto de partida vêm do **servidor**: `shown` é a data civil
/// que ele resolveu no fuso da unidade. Enquanto ela não chega, as setas ficam
/// desabilitadas — avançar a partir de um palpite do aparelho é justamente
/// como se erra o dia.
class _DayNavigator extends ConsumerWidget {
  const _DayNavigator({required this.selected, required this.shown});

  /// O dia escolhido pelo usuário; `null` enquanto ele estiver vendo "hoje".
  final CivilDate? selected;

  /// O dia que o servidor devolveu nesta resposta.
  final CivilDate? shown;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final anchor = selected ?? shown;

    void shift(int days) {
      if (anchor == null) return;
      ref.read(agendaDateProvider.notifier).state = anchor.addDays(days);
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: OrbitSpacing.gutter),
      child: Column(
        children: [
          Row(
            children: [
              IconButton(
                onPressed: anchor == null ? null : () => shift(-1),
                icon: const Icon(Icons.chevron_left),
                tooltip: 'Dia anterior',
              ),
              Expanded(
                child: Text(
              anchor == null ? 'Hoje' : DateFormat('MMM yyyy', 'pt_BR').format(DateTime.utc(anchor.year, anchor.month, anchor.day)),
                  textAlign: TextAlign.center,
                  style: OrbitType.caption,
                ),
              ),
              IconButton(
                onPressed: anchor == null ? null : () => shift(1),
                icon: const Icon(Icons.chevron_right),
                tooltip: 'Próximo dia',
              ),
            ],
          ),
          if (anchor != null)
            Row(
              children: [
                for (var offset = -2; offset <= 2; offset++)
                  Expanded(
                    child: _DayButton(
                      day: anchor.addDays(offset),
                      selected: offset == 0,
                      onTap: () => ref.read(agendaDateProvider.notifier).state =
                          anchor.addDays(offset),
                    ),
                  ),
              ],
            ),
        ],
      ),
    );
  }
}

/// Um compromisso do dia.
///
/// Quando o evento corresponde a um item de campo, tocar abre **o item** — não
/// uma tela paralela de agenda. O item de trabalho é o ponto de entrada
/// operacional; a agenda é a projeção temporal dele.
///
/// É linha, não cartão: a agenda é uma sequência de horários, e o que a torna
/// legível é a coluna da esquerda alinhada de cima a baixo — que a moldura de
/// um cartão por evento desfazia.
class _EventRow extends StatelessWidget {
  const _EventRow({required this.event, this.workItemId});

  final AgendaEvent event;

  /// `null` quando o evento não é trabalho de campo desta pessoa.
  final String? workItemId;

  @override
  Widget build(BuildContext context) {
    /// Nada de código cru na tela. `SERVICE · SCHEDULED` era o que esta linha
    /// mostrava; quem lê quer "Atendimento · Programado", e o que não tem
    /// tradução simplesmente não aparece.
    final natureza = agendaEventTypeLabel(event.type);
    final situacao = operationalStatusLabel(event.status);
    final prioridade = agendaPriorityLabel(event.priority);

    final contexto = [
      if (natureza != null) natureza,
      if (situacao != null) situacao,
    ].join(' · ');

    return OrbitListRow(
      leading: OrbitFormat.hourOf(event.startsAt),
      title: event.title,
      subtitle: contexto.isEmpty ? null : contexto,
      detail: 'até ${OrbitFormat.hourOf(event.endsAt)}',
      tone: prioridade == null ? null : OrbitTone.warning,

      /// A seta é da própria linha; aqui o espaço da direita fica para o selo
      /// de prioridade, que só existe quando muda o que a pessoa faz.
      onTap: workItemId == null
          ? null
          : () => context.push(OrbitRoutes.workItemDetail(workItemId!)),
      trailing: prioridade == null
          ? null
          : OrbitStatusBadge(
              label: prioridade,
              tone: event.priority == 'HIGH'
                  ? OrbitTone.warning
                  : OrbitTone.danger,
            ),
    );
  }
}

class _DayButton extends StatelessWidget {
  const _DayButton({
    required this.day,
    required this.selected,
    required this.onTap,
  });
  final CivilDate day;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final p = context.orbit;
    return Semantics(
      selected: selected,
      button: true,
      label: OrbitFormat.fullDate(day),
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: OrbitRadius.field,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            children: [
              Text(
                DateFormat('EEE', 'pt_BR')
                    .format(DateTime.utc(day.year, day.month, day.day))
                    .replaceAll('.', '')
                    .toUpperCase(),
                style: OrbitType.eyebrow.copyWith(color: p.inkSubtle),
              ),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: selected ? p.accentSoft : p.surface,
                  borderRadius: OrbitRadius.field,
                ),
                child: Text(
                  '${day.day}',
                  style: OrbitType.sectionTitle.copyWith(
                    color: selected ? p.accent : p.ink,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
