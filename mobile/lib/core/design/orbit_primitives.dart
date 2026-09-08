/// Os primitivos da interface do Orbit Operator.
///
/// ## A regra, e por que ela mudou
///
/// A versão anterior deste arquivo defendia que *"caixa é para agrupamento
/// semântico real; o resto é linha"*. A intenção era boa — evitar caixa dentro
/// de caixa — mas o resultado foi uma tela em que tudo sangra até a borda, sem
/// contenção nenhuma, com o peso visual de uma tela de ajustes do sistema.
///
/// A regra agora é outra:
///
/// > **Conteúdo mora dentro de um cartão. O fundo da página nunca encosta no
/// > texto.**
///
/// O que evita o empilhamento não é proibir a caixa: é o cartão ser **um só
/// nível**. Linhas vivem dentro do cartão e não ganham caixa própria; seções
/// diferentes ganham cartões irmãos, nunca aninhados.
///
/// ## De onde vem a aparência
///
/// Cartão branco sobre fundo levemente frio, canto de 20, sombra em duas
/// camadas — uma colada, que faz a borda, e uma larga e difusa, que faz a
/// distância. Tipografia da marca: Space Grotesk no que precisa de presença,
/// Inter no que se lê em quantidade.
library;

import 'package:flutter/material.dart';

import '../theme/orbit_theme.dart';

/// O tom semântico de um estado. Cor **significa**; não decora.
enum OrbitTone { neutral, info, success, warning, danger, intelligence }

/// As cores de um tom, resolvidas contra a paleta.
({Color forte, Color suave}) _cores(OrbitPalette p, OrbitTone tone) =>
    switch (tone) {
      OrbitTone.neutral => (forte: p.inkMuted, suave: p.surfaceSunken),
      OrbitTone.info => (forte: p.accent, suave: p.accentSoft),
      OrbitTone.success => (forte: p.success, suave: p.successSoft),
      OrbitTone.warning => (forte: p.warning, suave: p.warningSoft),
      OrbitTone.danger => (forte: p.danger, suave: p.dangerSoft),
      OrbitTone.intelligence => (forte: p.intelligence, suave: p.intelligenceSoft),
    };

/// O contêiner. Tudo que é conteúdo mora dentro de um destes.
///
/// [tone] tinge a faixa da esquerda — o jeito de dizer "urgente" sem pintar o
/// cartão inteiro de vermelho, que cansa e rouba a atenção do que importa.
class OrbitCard extends StatelessWidget {
  const OrbitCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(OrbitSpacing.ml),
    this.tone,
    this.onTap,
    this.raised = false,
  });

  final Widget child;
  final EdgeInsets padding;

  /// Quando presente, desenha a faixa de severidade na borda esquerda.
  final OrbitTone? tone;
  final VoidCallback? onTap;

  /// Sombra mais aberta, para o cartão que precisa flutuar sobre os outros.
  final bool raised;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    final faixa = tone == null ? null : _cores(palette, tone!).forte;

    final conteudo = Padding(padding: padding, child: child);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: OrbitRadius.card,
        boxShadow: raised ? OrbitShadow.raised : OrbitShadow.card,
      ),
      child: ClipRRect(
        borderRadius: OrbitRadius.card,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,

            /// A faixa vai numa `Stack`, e não numa `Row` esticada: `Row` com
            /// `stretch` dentro de lista rolável recebe altura infinita e
            /// quebra o layout. A `Stack` mede pelo conteúdo, e a faixa se
            /// estica sobre a altura já resolvida.
            child: faixa == null
                ? conteudo
                : Stack(
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(left: 4),
                        child: conteudo,
                      ),
                      Positioned(
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 4,
                        child: ColoredBox(color: faixa),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

/// Uma métrica. O número primeiro, o rótulo embaixo.
///
/// O número usa a display em tabular: métricas ficam lado a lado, e dígito de
/// largura variável faz a linha dançar quando o valor muda.
class OrbitMetric extends StatelessWidget {
  const OrbitMetric({
    super.key,
    required this.value,
    required this.label,
    this.tone = OrbitTone.neutral,
    this.onTap,
  });

  final String value;
  final String label;
  final OrbitTone tone;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    final cor = tone == OrbitTone.neutral
        ? palette.ink
        : _cores(palette, tone).forte;

    return Semantics(
      button: onTap != null,
      label: '$label: $value',
      child: OrbitCard(
        onTap: onTap,
        padding: const EdgeInsets.symmetric(
          horizontal: OrbitSpacing.ms,
          vertical: OrbitSpacing.md,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(value, style: OrbitType.metric.copyWith(color: cor)),
            const SizedBox(height: OrbitSpacing.xs),

            /// Duas linhas: "Atrasados" não cabe em uma coluna de quatro num
            /// aparelho de 360 pixels, e reticências num rótulo de métrica
            /// deixa o número sem significado.
            Text(
              label,
              style: OrbitType.caption.copyWith(
                color: palette.inkSubtle,
                fontSize: 12,
                height: 1.25,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

/// Uma faixa de métricas: **um** cartão, com colunas divididas.
///
/// Quatro cartõezinhos lado a lado não cabem num aparelho de 360 pixels — o
/// rótulo quebra no meio da palavra e o número perde o significado. Um cartão
/// só, com filete entre as colunas, cabe, lê melhor e é o formato que os
/// painéis de produto usam há anos.
class OrbitMetricStrip extends StatelessWidget {
  const OrbitMetricStrip({super.key, required this.metrics});

  final List<OrbitMetricData> metrics;

  @override
  Widget build(BuildContext context) {
    if (metrics.isEmpty) return const SizedBox.shrink();
    final palette = context.orbit;

    return OrbitCard(
      padding: EdgeInsets.zero,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final (i, m) in metrics.indexed) ...[
              if (i > 0)
                VerticalDivider(
                  width: 1,
                  thickness: 1,
                  indent: OrbitSpacing.md,
                  endIndent: OrbitSpacing.md,
                  color: palette.border,
                ),
              Expanded(child: _Coluna(m)),
            ],
          ],
        ),
      ),
    );
  }
}

/// Os dados de uma métrica. Separado do widget porque a faixa precisa medir
/// as colunas antes de construí-las.
class OrbitMetricData {
  const OrbitMetricData({
    required this.value,
    required this.label,
    this.tone = OrbitTone.neutral,
    this.onTap,
  });

  final String value;
  final String label;
  final OrbitTone tone;
  final VoidCallback? onTap;
}

class _Coluna extends StatelessWidget {
  const _Coluna(this.dados);

  final OrbitMetricData dados;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    final cor = dados.tone == OrbitTone.neutral
        ? palette.ink
        : _cores(palette, dados.tone).forte;

    return Semantics(
      button: dados.onTap != null,
      label: '${dados.label}: ${dados.value}',
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: dados.onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: OrbitSpacing.sm,
              vertical: OrbitSpacing.md,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  dados.value,
                  style: OrbitType.metric.copyWith(color: cor),
                ),
                const SizedBox(height: 2),
                Text(
                  dados.label,
                  textAlign: TextAlign.center,
                  style: OrbitType.caption.copyWith(
                    color: palette.inkSubtle,
                    fontSize: 12,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// O cartão de destaque — o que a pessoa precisa fazer agora.
///
/// É o único elemento da tela pintado com a cor da marca. Um destaque por tela;
/// dois destaques não destacam nada.
class OrbitHeroCard extends StatelessWidget {
  const OrbitHeroCard({
    super.key,
    required this.eyebrow,
    required this.title,
    this.subtitle,
    this.meta,
    this.action,
    this.onTap,
  });

  final String eyebrow;
  final String title;
  final String? subtitle;
  final String? meta;
  final Widget? action;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    return DecoratedBox(
      decoration: const BoxDecoration(
        borderRadius: OrbitRadius.hero,
        boxShadow: OrbitShadow.brand,
      ),
      child: ClipRRect(
        borderRadius: OrbitRadius.hero,
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [palette.accent, palette.intelligence],
            ),
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onTap,
              child: Padding(
                padding: const EdgeInsets.all(OrbitSpacing.lg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      eyebrow.toUpperCase(),
                      style: OrbitType.eyebrow.copyWith(
                        color: Colors.white.withValues(alpha: 0.85),
                      ),
                    ),
                    const SizedBox(height: OrbitSpacing.ms),
                    Text(
                      title,
                      style: OrbitType.heroTitle.copyWith(color: Colors.white),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: OrbitSpacing.xs),
                      Text(
                        subtitle!,
                        style: OrbitType.body.copyWith(
                          color: Colors.white.withValues(alpha: 0.92),
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    if (meta != null) ...[
                      const SizedBox(height: OrbitSpacing.ms),
                      Text(
                        meta!,
                        style: OrbitType.caption.copyWith(
                          color: Colors.white.withValues(alpha: 0.78),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    if (action != null) ...[
                      const SizedBox(height: OrbitSpacing.ml),
                      SizedBox(width: double.infinity, child: action),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// O botão que vive dentro do cartão de destaque — branco sobre a marca.
class OrbitHeroButton extends StatelessWidget {
  const OrbitHeroButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    return FilledButton(
      onPressed: onPressed,
      style: FilledButton.styleFrom(
        backgroundColor: Colors.white,
        foregroundColor: palette.accentStrong,
        minimumSize: const Size.fromHeight(50),
        shape: const RoundedRectangleBorder(borderRadius: OrbitRadius.field),
        textStyle: OrbitType.label.copyWith(fontSize: 15.5),
      ),
      /// `Flexible` no rótulo: em escala de texto 2.0x, ou num aparelho
      /// estreito, "Retomar atendimento" passa da largura do cartão e o botão
      /// estoura. Reticência é feia; faixa listrada de overflow é pior.
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 19),
            const SizedBox(width: OrbitSpacing.sm),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}

/// Um título de seção com o conteúdo logo abaixo.
///
/// Por padrão o conteúdo vem dentro de um cartão: é o que dá a contenção que a
/// tela precisa. Quem já traz o próprio contêiner passa `boxed: false`.
class OrbitSection extends StatelessWidget {
  const OrbitSection({
    super.key,
    required this.title,
    required this.child,
    this.action,
    this.actionLabel,
    this.count,
    this.boxed = true,
    this.padding = EdgeInsets.zero,
  });

  final String title;
  final Widget child;
  final VoidCallback? action;
  final String? actionLabel;

  /// A contagem do servidor, quando maior que a lista mostrada.
  final int? count;
  final bool boxed;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(
            left: OrbitSpacing.xs,
            right: OrbitSpacing.xs,
            bottom: OrbitSpacing.ms,
          ),
          child: Row(
            children: [
              Expanded(
                child: Row(
                  children: [
                    Flexible(
                      /// A chave existe para o teste conseguir distinguir o
                      /// título da seção de um texto igual dentro dela — o
                      /// selo de prazo também diz "Hoje".
                      child: Text(
                        title,
                        key: const Key('orbit.section.title'),
                        style: OrbitType.sectionTitle.copyWith(
                          color: palette.ink,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (count != null) ...[
                      const SizedBox(width: OrbitSpacing.sm),
                      _Contagem(count!),
                    ],
                  ],
                ),
              ),
              if (action != null)
                TextButton(
                  onPressed: action,
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: OrbitSpacing.sm,
                    ),
                    minimumSize: const Size(0, 36),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(actionLabel ?? 'Ver tudo'),
                ),
            ],
          ),
        ),
        if (boxed)
          OrbitCard(padding: padding, child: child)
        else
          child,
      ],
    );
  }
}

/// A contagem ao lado do título — um selo, não um "· 6" perdido.
class _Contagem extends StatelessWidget {
  const _Contagem(this.valor);

  final int valor;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: palette.surfaceSunken,
        borderRadius: OrbitRadius.pill,
      ),
      child: Text(
        '$valor',
        style: OrbitType.numeric.copyWith(
          fontSize: 12.5,
          color: palette.inkSubtle,
        ),
      ),
    );
  }
}

/// Uma linha de lista, dentro de um cartão.
class OrbitListRow extends StatelessWidget {
  const OrbitListRow({
    super.key,
    this.leading,
    required this.title,
    this.subtitle,
    this.detail,
    this.trailing,
    this.onTap,
    this.emphasis = false,
    this.tone,
  });

  /// O dado de leitura rápida. Horário, na maioria das vezes.
  final String? leading;
  final String title;
  final String? subtitle;
  final String? detail;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool emphasis;

  /// Tinge o horário — o sinal de severidade mais barato que existe.
  final OrbitTone? tone;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    final corDoHorario = tone == null
        ? (emphasis ? palette.accent : palette.ink)
        : _cores(palette, tone!).forte;

    return Material(
      color: emphasis ? palette.accentSoft : Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: OrbitSpacing.ml,
            vertical: OrbitSpacing.md,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (leading != null) ...[
                SizedBox(
                  width: 50,
                  child: Text(
                    leading!,
                    style: OrbitType.numeric.copyWith(color: corDoHorario),
                  ),
                ),
                const SizedBox(width: OrbitSpacing.ms),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: OrbitType.itemTitle.copyWith(color: palette.ink),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 3),
                      Text(
                        subtitle!,
                        style: OrbitType.caption.copyWith(
                          color: palette.inkMuted,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],

                    /// O selo desce para cá em vez de ficar à direita do
                    /// título. À direita ele comia oitenta pixels da linha
                    /// mais importante da tela, e o nome do cliente quebrava
                    /// em duas linhas para caber no que sobrava.
                    if (detail != null || trailing != null) ...[
                      const SizedBox(height: OrbitSpacing.sm),
                      Row(
                        children: [
                          if (detail != null)
                            Expanded(
                              child: Text(
                                detail!,
                                style: OrbitType.caption.copyWith(
                                  color: palette.inkSubtle,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            )
                          else
                            const Spacer(),
                          if (trailing != null) ...[
                            const SizedBox(width: OrbitSpacing.sm),
                            trailing!,
                          ],
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              if (onTap != null) ...[
                const SizedBox(width: OrbitSpacing.sm),
                Icon(
                  Icons.chevron_right_rounded,
                  size: 20,
                  color: palette.inkDisabled,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Um selo de estado.
class OrbitStatusBadge extends StatelessWidget {
  const OrbitStatusBadge({
    super.key,
    required this.label,
    this.tone = OrbitTone.neutral,
  });

  final String label;
  final OrbitTone tone;

  @override
  Widget build(BuildContext context) {
    final c = _cores(context.orbit, tone);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: c.suave, borderRadius: OrbitRadius.pill),
      child: Text(
        label,
        style: OrbitType.label.copyWith(color: c.forte, fontSize: 12),
      ),
    );
  }
}

/// Um acesso rápido: ícone em medalhão sobre cartão branco.
class OrbitQuickAction extends StatelessWidget {
  const OrbitQuickAction({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.tone = OrbitTone.info,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final OrbitTone tone;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    final c = _cores(palette, tone);
    return Semantics(
      button: true,
      label: label,
      child: OrbitCard(
        onTap: onTap,
        padding: const EdgeInsets.symmetric(
          horizontal: OrbitSpacing.ms,
          vertical: OrbitSpacing.md,
        ),
        child: SizedBox(
          width: 80,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: c.suave,
                  borderRadius: OrbitRadius.chip,
                ),
                child: Icon(icon, size: 20, color: c.forte),
              ),
              const SizedBox(height: OrbitSpacing.sm),
              Text(
                label,
                textAlign: TextAlign.center,
                /// Uma linha: "Documentos" quebrando em "Documento/s" é pior
                /// que a reticência, e o ícone já carrega o significado.
                style: OrbitType.caption.copyWith(
                  color: palette.inkMuted,
                  fontSize: 11.5,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Uma caixa com tom. Continua existindo porque as telas a usam pelo nome;
/// hoje é um [OrbitCard] com faixa de severidade.
class OrbitPanel extends StatelessWidget {
  const OrbitPanel({
    super.key,
    required this.child,
    this.tone = OrbitTone.neutral,
    this.padding = const EdgeInsets.all(OrbitSpacing.ml),
  });

  final Widget child;
  final OrbitTone tone;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => OrbitCard(
    padding: padding,
    tone: tone == OrbitTone.neutral ? null : tone,
    child: child,
  );
}

/// Um vazio que orienta em vez de constatar.
class OrbitEmptyState extends StatelessWidget {
  const OrbitEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.description,
    this.action,
  });

  final IconData icon;
  final String title;
  final String? description;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: OrbitSpacing.lg,
        vertical: OrbitSpacing.xl,
      ),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: palette.surfaceMuted,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 28, color: palette.inkDisabled),
          ),
          const SizedBox(height: OrbitSpacing.md),
          Text(
            title,
            textAlign: TextAlign.center,
            style: OrbitType.itemTitle.copyWith(color: palette.ink),
          ),
          if (description != null) ...[
            const SizedBox(height: OrbitSpacing.xs),
            Text(
              description!,
              textAlign: TextAlign.center,
              style: OrbitType.body.copyWith(color: palette.inkSubtle),
            ),
          ],
          if (action != null) ...[
            const SizedBox(height: OrbitSpacing.ml),
            action!,
          ],
        ],
      ),
    );
  }
}

/// Separador entre linhas de lista, recuado para não cortar a coluna do
/// horário.
class OrbitRowDivider extends StatelessWidget {
  const OrbitRowDivider({super.key, this.indent = OrbitSpacing.ml});

  final double indent;

  @override
  Widget build(BuildContext context) => Divider(
    height: 1,
    indent: indent,
    endIndent: 0,
    color: context.orbit.border,
  );
}
