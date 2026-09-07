/// Os primitivos da interface do Orbit Operator.
///
/// ## Por que eles existem
///
/// O aplicativo tinha 65 usos de `Card`: cada informação virava uma caixa, e
/// caixas dentro de caixas. Numa tela de celular isso não organiza — divide o
/// olhar em dezenas de retângulos com a mesma importância, e nada tem
/// destaque.
///
/// A regra que estes primitivos aplicam é uma só:
///
/// > caixa é para **agrupamento semântico real**; o resto é linha.
///
/// Uma lista de atendimentos é uma lista, com separadores. Um bloco que junta
/// coisas de naturezas diferentes — o atendimento em andamento, com dados,
/// estado e ação — é uma caixa. Isso é tudo.
library;

import 'package:flutter/material.dart';

import '../theme/orbit_theme.dart';

/// Um título de seção — o organizador principal da tela.
///
/// Não é caixa: é um rótulo com espaço em volta. Seções separam por hierarquia
/// tipográfica e respiro, que é como uma página organiza sem desenhar bordas.
class OrbitSection extends StatelessWidget {
  const OrbitSection({
    super.key,
    required this.title,
    this.action,
    this.actionLabel,
    required this.child,
    this.dense = false,
  });

  final String title;
  final VoidCallback? action;
  final String? actionLabel;
  final Widget child;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(
            OrbitSpacing.md,
            dense ? OrbitSpacing.ms : OrbitSpacing.lg,
            OrbitSpacing.sm,
            OrbitSpacing.sm,
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  title.toUpperCase(),
                  style: OrbitType.sectionTitle.copyWith(
                    color: palette.inkSubtle,
                  ),
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
        child,
      ],
    );
  }
}

/// Uma linha de lista.
///
/// Substitui o cartão por item. Tem uma coluna à esquerda para o dado que se lê
/// de relance — o horário, quase sempre —, título, apoio e um selo opcional.
/// Toda a linha é tocável, com alvo confortável para quem usa luva.
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
  });

  /// O dado de leitura rápida. Horário, na maioria das vezes.
  final String? leading;
  final String title;
  final String? subtitle;
  final String? detail;
  final Widget? trailing;
  final VoidCallback? onTap;

  /// Destaque discreto — usado quando a linha é a mais importante da lista.
  final bool emphasis;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    return Material(
      color: emphasis ? palette.accentSoft : palette.surface,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: OrbitSpacing.md,
            vertical: OrbitSpacing.ms,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (leading != null) ...[
                SizedBox(
                  width: 46,
                  child: Text(
                    leading!,
                    style: OrbitType.numeric.copyWith(
                      color: emphasis ? palette.accentStrong : palette.ink,
                    ),
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
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        style: OrbitType.caption.copyWith(
                          color: palette.inkMuted,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    if (detail != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        detail!,
                        style: OrbitType.caption.copyWith(
                          color: palette.inkSubtle,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
              if (trailing != null) ...[
                const SizedBox(width: OrbitSpacing.sm),
                trailing!,
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// O tom semântico de um estado. Cor **significa**; não decora.
enum OrbitTone { neutral, info, success, warning, danger, intelligence }

/// Um selo de estado, pequeno e legível.
class OrbitStatusBadge extends StatelessWidget {
  const OrbitStatusBadge({super.key, required this.label, this.tone = OrbitTone.neutral});

  final String label;
  final OrbitTone tone;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    final (Color fundo, Color tinta) = switch (tone) {
      OrbitTone.neutral => (palette.surfaceSunken, palette.inkMuted),
      OrbitTone.info => (palette.accentSoft, palette.accentStrong),
      OrbitTone.success => (palette.successSoft, palette.success),
      OrbitTone.warning => (palette.warningSoft, palette.warning),
      OrbitTone.danger => (palette.dangerSoft, palette.danger),
      OrbitTone.intelligence => (palette.intelligenceSoft, palette.intelligence),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: fundo, borderRadius: OrbitRadius.pill),
      child: Text(
        label,
        style: OrbitType.label.copyWith(color: tinta),
      ),
    );
  }
}

/// Um acesso rápido. Compacto de propósito: seis desses cabem sem ocupar a
/// tela, e é o que se quer logo abaixo do cabeçalho.
class OrbitQuickAction extends StatelessWidget {
  const OrbitQuickAction({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    return Semantics(
      button: true,
      label: label,
      child: InkWell(
        onTap: onTap,
        borderRadius: OrbitRadius.field,
        child: Container(
          width: 84,
          padding: const EdgeInsets.symmetric(vertical: OrbitSpacing.ms),
          decoration: BoxDecoration(
            color: palette.surfaceMuted,
            borderRadius: OrbitRadius.field,
            border: Border.all(color: palette.border),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 22, color: palette.accent),
              const SizedBox(height: OrbitSpacing.sm),
              Text(
                label,
                textAlign: TextAlign.center,
                style: OrbitType.caption.copyWith(color: palette.inkMuted),
                maxLines: 2,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Uma caixa — usada **só** quando há agrupamento semântico real.
class OrbitPanel extends StatelessWidget {
  const OrbitPanel({
    super.key,
    required this.child,
    this.tone = OrbitTone.neutral,
    this.padding = const EdgeInsets.all(OrbitSpacing.md),
  });

  final Widget child;
  final OrbitTone tone;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    final borda = switch (tone) {
      OrbitTone.info => palette.accent.withValues(alpha: 0.35),
      OrbitTone.warning => palette.warning.withValues(alpha: 0.35),
      OrbitTone.danger => palette.danger.withValues(alpha: 0.35),
      _ => palette.border,
    };
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: OrbitRadius.card,
        border: Border.all(color: borda),
      ),
      child: child,
    );
  }
}

/// Um vazio que orienta em vez de constatar.
class OrbitEmptyState extends StatelessWidget {
  const OrbitEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.description,
  });

  final IconData icon;
  final String title;
  final String? description;

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
          Icon(icon, size: 30, color: palette.inkDisabled),
          const SizedBox(height: OrbitSpacing.ms),
          Text(
            title,
            textAlign: TextAlign.center,
            style: OrbitType.itemTitle.copyWith(color: palette.inkMuted),
          ),
          if (description != null) ...[
            const SizedBox(height: OrbitSpacing.xs),
            Text(
              description!,
              textAlign: TextAlign.center,
              style: OrbitType.caption.copyWith(color: palette.inkSubtle),
            ),
          ],
        ],
      ),
    );
  }
}

/// Separador entre linhas de lista, recuado para não cortar a coluna do
/// horário.
class OrbitRowDivider extends StatelessWidget {
  const OrbitRowDivider({super.key, this.indent = OrbitSpacing.md});

  final double indent;

  @override
  Widget build(BuildContext context) =>
      Divider(height: 1, indent: indent, endIndent: 0, color: context.orbit.border);
}
