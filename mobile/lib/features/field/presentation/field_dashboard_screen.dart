/// Meu dia — a tela inicial de quem trabalha em campo.
///
/// ## A pergunta que ela responde
///
/// **"O que eu preciso fazer agora?"** — nessa ordem, de cima para baixo:
///
/// ```text
/// 1. quem é você, e que dia é hoje
/// 2. o que já começou           → o trabalho ao qual se volta
/// 3. o que dá para fazer daqui  → ações rápidas
/// 4. o que é de hoje            → a agenda, resumida
/// 5. o que vem depois           → os próximos
/// 6. o que ficou pronto         → documentos e compromissos recentes
/// ```
///
/// A versão anterior abria com quatro contadores. Contador informa; ele não
/// diz o que fazer. Aqui as contagens continuam existindo — mas como **rótulo
/// da seção**, ao lado do trabalho a que se referem, e não como cartaz.
///
/// ## Uma requisição
///
/// `GET /mobile/field/home` entrega painel, documentos recentes e compromissos
/// recentes juntos. Montar isso no aplicativo custaria uma chamada por
/// atendimento da fila — a cascata que a tela existia para evitar e voltava a
/// criar assim que ganhasse a terceira seção.
///
/// Nada é contado, classificado ou reordenado aqui: `counters`, `next`,
/// `inProgress`, `overdue`, `today` e o estado de cada documento vêm prontos.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../core/contracts/mobile_field_contracts.dart';
import '../../../core/design/orbit_primitives.dart';
import '../../../core/errors/orbit_public_copy.dart';
import '../../../core/presentation/orbit_format.dart';
import '../../../core/routing/orbit_router.dart';
import '../../../core/theme/orbit_theme.dart';
import '../../../core/widgets/section_states.dart';
import '../../authentication/domain/session.dart';
import '../../documents/presentation/documents_screen.dart' show documentStateBadge;
import '../../operations/data/operations_repository.dart' show CachedResult;
import '../application/field_providers.dart';
import 'widgets/work_item_row.dart';

class FieldDashboardScreen extends ConsumerWidget {
  const FieldDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final home = ref.watch(fieldHomeProvider);
    final session = ref.watch(sessionProvider);

    return Scaffold(
      backgroundColor: context.orbit.background,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () async => ref.invalidate(fieldHomeProvider),

          /// O que já está na tela sobrevive a um refresh que falha.
          ///
          /// `when` trocaria o dia inteiro de trabalho por uma tela de erro
          /// porque a rede caiu no meio de um gesto de puxar. Quem está em
          /// campo perderia a fila, os horários e o próximo atendimento — que
          /// continuam válidos, só não foram atualizados.
          ///
          /// Com dado em mãos, a falha vira um aviso. Sem dado, aí sim a tela
          /// é o erro: não há o que preservar.
          child: _corpo(ref, home, session),
        ),
      ),
    );
  }
}

/// O que mostrar, dado o estado da leitura.
///
/// A ordem das perguntas é o comportamento: **primeiro** se há dado. Só quando
/// não há é que a falha ocupa a tela.
Widget _corpo(
  WidgetRef ref,
  AsyncValue<CachedResult<MobileFieldHomeContract>> home,
  OrbitSession? session,
) {
  final dados = home.valueOrNull;
  if (dados != null) {
    return _Home(
      home: dados.value,
      cachedAt: dados.cachedAt,
      userName: session?.user.displayName,
      currentUserId: session?.user.id,
      refreshFailed: home.hasError,
    );
  }

  if (home.hasError) {
    /// A lista precisa rolar mesmo no erro: sem rolagem, o `RefreshIndicator`
    /// não tem gesto, e a única saída seria fechar o aplicativo.
    return ListView(
      padding: const EdgeInsets.all(OrbitSpacing.md),
      children: [
        SectionError(
          error: home.error!,
          onRetry: () => ref.invalidate(fieldHomeProvider),
        ),
      ],
    );
  }

  return const Padding(
    padding: EdgeInsets.all(OrbitSpacing.md),
    child: SectionLoading(lines: 6),
  );
}

class _Home extends StatelessWidget {
  const _Home({
    required this.home,
    required this.cachedAt,
    required this.userName,
    required this.currentUserId,
    this.refreshFailed = false,
  });

  final MobileFieldHomeContract home;
  final DateTime? cachedAt;
  final String? userName;
  final String? currentUserId;

  /// A última atualização não veio. Os dados abaixo continuam sendo os
  /// últimos que o servidor confirmou.
  final bool refreshFailed;

  @override
  Widget build(BuildContext context) {
    final dashboard = home.dashboard;

    /// O próximo só aparece se ainda não estiver em andamento — repeti-lo
    /// ocuparia a tela com o mesmo atendimento duas vezes.
    final proximo = dashboard.next;
    final proximoInedito =
        proximo != null &&
        !dashboard.inProgress.any((item) => item.id == proximo.id);

    /// "Não há nada" é diferente de "não há nada nesta seção". Só quando
    /// **todas** estão vazias a tela diz que o dia está livre.
    final vazio =
        dashboard.inProgress.isEmpty &&
        dashboard.overdue.isEmpty &&
        dashboard.today.isEmpty &&
        proximo == null &&
        home.recentDocuments.isEmpty &&
        home.recentAppointments.isEmpty;

    return ListView(
      padding: const EdgeInsets.only(bottom: OrbitSpacing.xl),
      children: [
        _Header(userName: userName),

        if (cachedAt != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(
              OrbitSpacing.md,
              0,
              OrbitSpacing.md,
              OrbitSpacing.sm,
            ),
            child: StaleDataBanner(cachedAt: cachedAt!),
          ),

        /// Aviso discreto, não substituição.
        if (refreshFailed) const _RefreshFailedNotice(),

        /// Em andamento primeiro, e em destaque: é o trabalho que já começou,
        /// e é para ele que a pessoa volta ao abrir o aplicativo.
        if (dashboard.inProgress.isNotEmpty)
          _ItemSection(
            title: 'Em andamento',
            items: dashboard.inProgress,
            currentUserId: currentUserId,
            emphasisFirst: true,
          ),

        _QuickActions(dashboard: dashboard),

        if (vazio)
          const OrbitEmptyState(
            icon: Icons.event_available_outlined,
            title: 'Nenhum atendimento programado',
            description:
                'Quando houver trabalho atribuído a você, ele aparece aqui.',
          ),

        if (dashboard.overdue.isNotEmpty)
          _ItemSection(
            title: 'Atrasados',
            count: dashboard.counters.overdue,
            items: dashboard.overdue,
            currentUserId: currentUserId,
            onSeeAll: () => context.go(OrbitRoutes.workQueue),
          ),

        if (dashboard.today.isNotEmpty)
          _ItemSection(
            title: 'Hoje',
            count: dashboard.counters.today,
            items: dashboard.today,
            currentUserId: currentUserId,
            onSeeAll: () => context.go(OrbitRoutes.agenda),
            seeAllLabel: 'Ver agenda',
          ),

        if (proximoInedito)
          _ItemSection(
            title: 'Próximo atendimento',
            items: [proximo],
            currentUserId: currentUserId,
          ),

        if (home.recentDocuments.isNotEmpty)
          OrbitSection(
            title: 'Documentos recentes',
            actionLabel: 'Ver todos',
            action: () => context.go(OrbitRoutes.documents),
            child: _Rows(
              children: [
                for (final documento in home.recentDocuments)
                  _DocumentRow(document: documento),
              ],
            ),
          ),

        if (home.recentAppointments.isNotEmpty)
          OrbitSection(
            title: 'Agendamentos recentes',
            actionLabel: 'Ver agenda',
            action: () => context.go(OrbitRoutes.agenda),
            child: _Rows(
              children: [
                for (final compromisso in home.recentAppointments)
                  _AppointmentRow(appointment: compromisso),
              ],
            ),
          ),

        const SizedBox(height: OrbitSpacing.lg),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: OrbitSpacing.md),
          child: OutlinedButton.icon(
            onPressed: () => context.go(OrbitRoutes.workQueue),
            icon: const Icon(Icons.checklist_rtl, size: 18),
            label: const Text('Ver toda a fila'),
            style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48)),
          ),
        ),
      ],
    );
  }
}

/// Quem está lendo, e que dia é hoje.
///
/// O primeiro nome basta: a pessoa sabe o próprio sobrenome, e "Bom dia,
/// Ricardo" cabe em 320 pixels onde o nome completo não caberia.
class _Header extends StatelessWidget {
  const _Header({required this.userName});

  final String? userName;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    final agora = DateTime.now();
    final primeiroNome = userName?.trim().split(' ').first;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        OrbitSpacing.md,
        OrbitSpacing.lg,
        OrbitSpacing.md,
        OrbitSpacing.md,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            greetingFor(agora.hour, primeiroNome),
            style: OrbitType.screenTitle.copyWith(color: palette.ink),
          ),
          const SizedBox(height: 2),
          Text(
            todayLabel(agora),
            style: OrbitType.body.copyWith(color: palette.inkMuted),
          ),
        ],
      ),
    );
  }
}

/// A saudação do relógio do aparelho.
///
/// É o único lugar da tela onde a hora local decide alguma coisa — e decide
/// só a palavra. Prazo, "hoje" e atraso continuam vindo do servidor, no fuso
/// da unidade, porque quem viaja atravessa fusos e a operação não.
String greetingFor(int hour, String? name) {
  final saudacao = switch (hour) {
    >= 5 && < 12 => 'Bom dia',
    >= 12 && < 18 => 'Boa tarde',
    _ => 'Boa noite',
  };
  return name == null || name.isEmpty ? saudacao : '$saudacao, $name';
}

/// `Sexta-feira, 06 de setembro` — com inicial maiúscula.
String todayLabel(DateTime now) {
  final texto = OrbitFormat.weekdayAndDay(now);
  return texto.isEmpty ? texto : texto[0].toUpperCase() + texto.substring(1);
}

/// O que dá para fazer daqui, sem procurar.
///
/// Só entram ações que a sessão realmente permite: `canScanEquipment` e
/// `canCreateAdHocRvt` vêm do servidor. Botão que existe e recusa é pior do
/// que botão que não existe.
class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.dashboard});

  final MobileFieldDashboardContract dashboard;

  @override
  Widget build(BuildContext context) {
    final acoes = <Widget>[
      OrbitQuickAction(
        icon: Icons.checklist_rtl_outlined,
        label: 'Minha fila',
        onTap: () => context.go(OrbitRoutes.workQueue),
      ),
      OrbitQuickAction(
        icon: Icons.calendar_today_outlined,
        label: 'Agenda',
        onTap: () => context.go(OrbitRoutes.agenda),
      ),
      OrbitQuickAction(
        icon: Icons.description_outlined,
        label: 'Documentos',
        onTap: () => context.go(OrbitRoutes.documents),
      ),
      if (dashboard.canScanEquipment)
        OrbitQuickAction(
          icon: Icons.qr_code_scanner,
          label: 'Ler etiqueta',
          onTap: () => context.push(OrbitRoutes.scanner),
        ),
      OrbitQuickAction(
        icon: Icons.sync_outlined,
        label: 'Sincronização',
        onTap: () => context.push(OrbitRoutes.syncCenter),
      ),
    ];

    return OrbitSection(
      title: 'Ações rápidas',
      dense: true,

      /// Rola na horizontal em vez de quebrar linha: em 320 pixels o `Wrap`
      /// viraria duas fileiras e empurraria o trabalho para fora da tela.
      ///
      /// Sem altura fixa, de propósito. Com o texto do sistema ampliado o
      /// rótulo cresce, e uma caixa de 84 pixels o cortava — a fileira tem a
      /// altura do que está dentro dela.
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: OrbitSpacing.md),
        /// `IntrinsicHeight` para que todos os blocos tenham a altura do mais
        /// alto — sem ele, "Sincronização" (duas linhas) e "Agenda" (uma)
        /// ficariam desalinhados. Dentro de uma rolagem horizontal, `stretch`
        /// sozinho pediria altura infinita.
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final (indice, acao) in acoes.indexed) ...[
                if (indice > 0) const SizedBox(width: OrbitSpacing.sm),
                acao,
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Uma seção de itens de trabalho, como lista.
class _ItemSection extends StatelessWidget {
  const _ItemSection({
    required this.title,
    required this.items,
    required this.currentUserId,
    this.count,
    this.onSeeAll,
    this.seeAllLabel,
    this.emphasisFirst = false,
  });

  final String title;
  final int? count;
  final List<MobileWorkItemContract> items;
  final String? currentUserId;
  final VoidCallback? onSeeAll;
  final String? seeAllLabel;
  final bool emphasisFirst;

  @override
  Widget build(BuildContext context) {
    /// A contagem do servidor pode ser maior do que a lista: o painel entrega
    /// no máximo cinco por recorte. Dizer "Hoje · 12" com cinco linhas é
    /// honesto; inventar doze linhas não seria.
    final rotulo = count == null || count == items.length
        ? title
        : '$title · $count';

    return OrbitSection(
      title: rotulo,
      action: onSeeAll,
      actionLabel: seeAllLabel,
      child: _Rows(
        children: [
          for (final (indice, item) in items.indexed)
            WorkItemRow(
              key: ValueKey(item.id),
              item: item,
              currentUserId: currentUserId,
              emphasis: emphasisFirst && indice == 0,
              onOpen: () => context.push(OrbitRoutes.workItemDetail(item.id)),
            ),
        ],
      ),
    );
  }
}

/// Linhas com separador entre elas — nunca depois da última.
class _Rows extends StatelessWidget {
  const _Rows({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      for (final (indice, filho) in children.indexed) ...[
        if (indice > 0) const OrbitRowDivider(),
        filho,
      ],
    ],
  );
}

class _DocumentRow extends StatelessWidget {
  const _DocumentRow({required this.document});

  final MobileRecentDocumentContract document;

  @override
  Widget build(BuildContext context) => OrbitListRow(
    title: document.customerName ?? document.label,
    subtitle: document.customerName == null ? null : document.label,
    detail: OrbitFormat.dateHourOf(document.createdAt),
    trailing: documentStateBadge(document),
    onTap: () => context.go(OrbitRoutes.documents),
  );
}

class _AppointmentRow extends StatelessWidget {
  const _AppointmentRow({required this.appointment});

  final MobileRecentAppointmentContract appointment;

  @override
  Widget build(BuildContext context) => OrbitListRow(
    leading: OrbitFormat.hourOf(appointment.startsAt),
    title: appointment.customerName ?? appointment.title,
    subtitle: appointment.customerName == null ? null : appointment.title,
    detail: OrbitFormat.dateHourOf(appointment.startsAt),
    onTap: () => context.go(OrbitRoutes.agenda),
  );
}


/// A atualização que não veio.
///
/// Uma linha, no topo, acima do trabalho — e não uma tela por cima dele. O que
/// está abaixo continua sendo o que o servidor disse por último, e continua
/// servindo para trabalhar.
class _RefreshFailedNotice extends StatelessWidget {
  const _RefreshFailedNotice();

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        OrbitSpacing.md,
        0,
        OrbitSpacing.md,
        OrbitSpacing.sm,
      ),
      child: Semantics(
        liveRegion: true,
        child: Row(
          children: [
            Icon(Icons.cloud_off_outlined, size: 16, color: palette.warning),
            const SizedBox(width: OrbitSpacing.sm),
            Expanded(
              child: Text(
                OrbitPublicCopy.refreshFailed,
                style: OrbitType.caption.copyWith(color: palette.inkMuted),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
