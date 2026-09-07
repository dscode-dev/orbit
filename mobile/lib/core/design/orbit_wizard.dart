/// Um roteiro de etapas.
///
/// ## Por que etapas, e não um rolo
///
/// A execução de um atendimento era uma tela só, com sete seções empilhadas.
/// Quem está de pé numa casa de máquinas, de luva, com o celular numa mão,
/// rolava para achar o checklist, rolava de volta para a evidência, e não tinha
/// como saber se faltava alguma coisa antes de concluir. O roteiro responde
/// duas perguntas que o rolo não respondia: **onde eu estou** e **o que falta**.
///
/// ## O que ele não decide
///
/// Nada de domínio. O roteiro não sabe se uma etapa pode ser pulada, se o
/// atendimento pode ser concluído, nem o que torna uma etapa completa: quem
/// chama declara [OrbitWizardStep.complete] e [OrbitWizardStep.enabled] a
/// partir do que o **servidor** publicou — `allowedActions`, `blockers`,
/// `eligible`. Uma regra escrita aqui viraria a segunda máquina de estados, a
/// que diverge da do backend na primeira mudança.
///
/// Avançar e voltar são **navegação**, não transição de domínio: nenhum comando
/// é enviado ao mudar de etapa, e sair no meio não perde nada — o que foi
/// registrado já foi registrado, pelo journal de comandos.
library;

import 'package:flutter/material.dart';

import '../theme/orbit_theme.dart';

/// Uma etapa do roteiro.
class OrbitWizardStep {
  const OrbitWizardStep({
    required this.title,
    required this.child,
    this.hint,
    this.complete = false,
    this.enabled = true,
  });

  /// O nome da etapa, como a pessoa a chamaria.
  final String title;

  /// Uma linha dizendo o que se faz aqui. Some quando não há o que dizer.
  final String? hint;

  final Widget child;

  /// Se a etapa já foi cumprida. **Declarado por quem chama**, a partir do
  /// que o servidor publicou.
  final bool complete;

  /// Se a etapa é alcançável. Uma etapa desabilitada continua visível no
  /// trilho — esconder faria a pessoa perder a conta de quantas são.
  final bool enabled;
}

class OrbitWizard extends StatefulWidget {
  const OrbitWizard({
    super.key,
    required this.steps,
    this.initialStep = 0,
    this.onStepChanged,
    this.footer,
  });

  final List<OrbitWizardStep> steps;
  final int initialStep;
  final ValueChanged<int>? onStepChanged;

  /// O que fica abaixo do conteúdo, dentro da rolagem — a ação principal do
  /// domínio, quando a etapa é a última.
  final Widget? footer;

  @override
  State<OrbitWizard> createState() => OrbitWizardState();
}

class OrbitWizardState extends State<OrbitWizard> {
  late int _atual = widget.initialStep.clamp(0, widget.steps.length - 1);

  @override
  void didUpdateWidget(OrbitWizard oldWidget) {
    super.didUpdateWidget(oldWidget);

    /// A lista de etapas pode encolher entre reconstruções — uma etapa que
    /// deixou de existir não pode deixar o índice apontando para o vazio.
    if (_atual >= widget.steps.length) {
      _atual = widget.steps.length - 1;
    }
  }

  void _ir(int destino) {
    if (destino < 0 || destino >= widget.steps.length) return;
    if (!widget.steps[destino].enabled) return;
    setState(() => _atual = destino);
    widget.onStepChanged?.call(destino);
  }

  /// A próxima etapa alcançável, ou `null` quando não há.
  int? get _proxima {
    for (var i = _atual + 1; i < widget.steps.length; i++) {
      if (widget.steps[i].enabled) return i;
    }
    return null;
  }

  int? get _anterior {
    for (var i = _atual - 1; i >= 0; i--) {
      if (widget.steps[i].enabled) return i;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    final etapa = widget.steps[_atual];
    final proxima = _proxima;
    final anterior = _anterior;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Trilho(steps: widget.steps, current: _atual, onSelect: _ir),

        Padding(
          padding: const EdgeInsets.fromLTRB(
            OrbitSpacing.md,
            OrbitSpacing.md,
            OrbitSpacing.md,
            OrbitSpacing.sm,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Etapa ${_atual + 1} de ${widget.steps.length}',
                style: OrbitType.label.copyWith(color: palette.inkSubtle),
              ),
              const SizedBox(height: 2),
              Text(
                etapa.title,
                style: OrbitType.screenTitle.copyWith(color: palette.ink),
              ),
              if (etapa.hint case final String dica) ...[
                const SizedBox(height: 4),
                Text(
                  dica,
                  style: OrbitType.body.copyWith(color: palette.inkMuted),
                ),
              ],
            ],
          ),
        ),

        etapa.child,

        if (widget.footer case final Widget rodape) ...[
          const SizedBox(height: OrbitSpacing.md),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: OrbitSpacing.md),
            child: rodape,
          ),
        ],

        const SizedBox(height: OrbitSpacing.lg),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: OrbitSpacing.md),
          child: Row(
            children: [
              if (anterior != null)
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _ir(anterior),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 48),
                    ),
                    child: const Text('Voltar'),
                  ),
                ),
              if (anterior != null && proxima != null)
                const SizedBox(width: OrbitSpacing.sm),
              if (proxima != null)
                Expanded(
                  child: FilledButton(
                    onPressed: () => _ir(proxima),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 48),
                    ),

                    /// "Avançar", nunca "Salvar": mudar de etapa não envia
                    /// comando nenhum, e prometer gravação seria mentir.
                    child: Text('Avançar · ${widget.steps[proxima].title}'),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// O trilho de etapas — onde estou, o que já cumpri, quantas faltam.
class _Trilho extends StatelessWidget {
  const _Trilho({
    required this.steps,
    required this.current,
    required this.onSelect,
  });

  final List<OrbitWizardStep> steps;
  final int current;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    /// Sem altura fixa: com o texto do sistema ampliado o rótulo da etapa
    /// cresce, e uma faixa de altura fixa o cortaria.
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(
        horizontal: OrbitSpacing.md,
        vertical: OrbitSpacing.sm,
      ),
      child: Row(
        children: [
          for (final (indice, etapa) in steps.indexed) ...[
            if (indice > 0) const SizedBox(width: OrbitSpacing.sm),
            _Marca(
              step: etapa,
              index: indice,
              total: steps.length,
              current: indice == current,
              onTap: etapa.enabled ? () => onSelect(indice) : null,
            ),
          ],
        ],
      ),
    );
  }
}

/// Uma etapa no trilho.
class _Marca extends StatelessWidget {
  const _Marca({
    required this.step,
    required this.index,
    required this.total,
    required this.current,
    required this.onTap,
  });

  final OrbitWizardStep step;
  final int index;
  final int total;
  final bool current;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    final (Color fundo, Color tinta) = switch ((
      current,
      step.complete,
      step.enabled,
    )) {
      (true, _, _) => (palette.accentSoft, palette.accentStrong),
      (_, true, _) => (palette.successSoft, palette.success),
      (_, _, false) => (palette.surfaceMuted, palette.inkDisabled),
      _ => (palette.surfaceMuted, palette.inkMuted),
    };

    return Semantics(
      button: step.enabled,
      selected: current,
      label:
          '${step.title}, etapa ${index + 1} de $total'
          '${step.complete ? ', concluída' : ''}',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: OrbitRadius.pill,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: OrbitSpacing.ms,
            vertical: 6,
          ),
          decoration: BoxDecoration(color: fundo, borderRadius: OrbitRadius.pill),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (step.complete && !current) ...[
                Icon(Icons.check, size: 13, color: tinta),
                const SizedBox(width: 4),
              ],
              Text(step.title, style: OrbitType.label.copyWith(color: tinta)),
            ],
          ),
        ),
      ),
    );
  }
}
