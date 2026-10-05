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
/// Nada de domínio. O roteiro não sabe se o atendimento pode ser concluído nem o
/// que torna uma etapa completa: quem chama declara [OrbitWizardStep.complete] e
/// [OrbitWizardStep.lockedReason] a partir do que o **servidor** publicou —
/// `allowedActions`, `blockers`, `eligible`. Uma regra escrita aqui viraria a
/// segunda máquina de estados, a que diverge da do backend na primeira mudança.
///
/// ## Nenhuma etapa é pulada
///
/// Havia um `enabled` que decidia se a etapa era **alcançável**, e avançar saltava
/// por cima das desabilitadas. O efeito em campo: um atendimento sem checklist pulava
/// a etapa 2 — de Preparação para Evidências —, e quem executava via "Etapa 1 de 6"
/// virar "Etapa 3 de 6" sem nunca saber o que havia na 2. Nos dois roteiros do app
/// isso acontecia por omissão, porque a condição mais comum em campo é justamente a
/// que desabilitava: sem checklist previsto, sem execução aberta ainda.
///
/// Pior: as etapas já traziam a explicação pronta no próprio conteúdo — "Sem checklist
/// previsto" — e ela nunca aparecia, porque a etapa era inalcançável.
///
/// Agora toda etapa é alcançável, e o que antes a desabilitava virou
/// [OrbitWizardStep.lockedReason]: a etapa abre, e no lugar do conteúdo mostra **por
/// que** ainda não há o que fazer ali. O tipo é `String?` e não `bool` de propósito —
/// não há como travar uma etapa sem dizer o motivo.
///
/// Avançar e voltar são **navegação**, não transição de domínio: nenhum comando
/// é enviado ao mudar de etapa, e sair no meio não perde nada — o que foi
/// registrado já foi registrado, pelo journal de comandos.
library;

import 'package:flutter/material.dart';

import '../theme/orbit_theme.dart';
import 'orbit_primitives.dart';

/// Uma etapa do roteiro.
class OrbitWizardStep {
  const OrbitWizardStep({
    required this.title,
    required this.child,
    this.hint,
    this.complete = false,
    this.lockedReason,
  });

  /// O nome da etapa, como a pessoa a chamaria.
  final String title;

  /// Uma linha dizendo o que se faz aqui. Some quando não há o que dizer.
  final String? hint;

  final Widget child;

  /// Se a etapa já foi cumprida. **Declarado por quem chama**, a partir do
  /// que o servidor publicou.
  final bool complete;

  /// Por que ainda não há o que fazer nesta etapa, quando é o caso.
  ///
  /// `null` é a etapa normal. Preenchido, a etapa continua **alcançável** e mostra
  /// esta frase no lugar do conteúdo: o conteúdo pode ser interativo, e deixá-lo
  /// operável antes da hora é o que o travamento existe para evitar.
  ///
  /// A frase é lida por quem está em campo, então diz o que falta acontecer — "abra o
  /// atendimento para registrar o roteiro" —, e não o estado interno que faltou.
  final String? lockedReason;

  bool get isLocked => lockedReason != null;
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
    setState(() => _atual = destino);
    widget.onStepChanged?.call(destino);
  }

  /// A etapa seguinte, ou `null` na última.
  ///
  /// Sempre a vizinha — nenhuma busca por "a próxima alcançável". Era essa busca que
  /// pulava etapas, e com ela "Avançar" deixava de significar "a próxima".
  int? get _proxima => _atual + 1 < widget.steps.length ? _atual + 1 : null;

  int? get _anterior => _atual > 0 ? _atual - 1 : null;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    final etapa = widget.steps[_atual];
    final proxima = _proxima;
    final anterior = _anterior;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        /// Trilho, barra de progresso e cabeçalho da etapa numa superfície
        /// elevada só.
        ///
        /// Os três descreviam a mesma coisa — onde estou — e estavam soltos
        /// sobre o fundo, em três alturas diferentes. Juntos e com sombra,
        /// lê-se um bloco de orientação, e o que rola por baixo é o trabalho.
        DecoratedBox(
          decoration: BoxDecoration(
            color: palette.surface,
            boxShadow: OrbitShadow.card,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _Trilho(steps: widget.steps, current: _atual, onSelect: _ir),
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: OrbitSpacing.gutter,
                ),
                child: ClipRRect(
                  borderRadius: OrbitRadius.pill,
                  child: LinearProgressIndicator(
                    value: (_atual + 1) / widget.steps.length,
                    minHeight: 4,
                    backgroundColor: palette.surfaceMuted,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  OrbitSpacing.gutter,
                  OrbitSpacing.ms,
                  OrbitSpacing.gutter,
                  OrbitSpacing.md,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Etapa ${_atual + 1} de ${widget.steps.length}',
                      style: OrbitType.eyebrow.copyWith(
                        color: palette.inkSubtle,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      etapa.title,
                      style: OrbitType.sectionTitle.copyWith(
                        color: palette.ink,
                      ),
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
            ],
          ),
        ),

        const SizedBox(height: OrbitSpacing.md),

        /// Travada mostra o motivo; não o conteúdo.
        ///
        /// Trocar e não apenas avisar: o conteúdo é interativo — checklist, captura de
        /// evidência, campo de observação —, e deixá-lo operável antes da hora é o que
        /// o travamento existe para evitar. Antes essa proteção vinha de a etapa ser
        /// inalcançável, ao custo de ninguém nunca ler o motivo.
        if (etapa.lockedReason case final String motivo)
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: OrbitSpacing.gutter,
            ),
            child: OrbitEmptyState(
              icon: Icons.lock_clock_outlined,
              title: 'Ainda não é a hora desta etapa',
              description: motivo,
            ),
          )
        else
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
                  /// Tonal, e não `OutlinedButton` com o estilo de
                  /// `FilledButton`: era o que estava aqui, e como o estilo
                  /// de um tipo de botão não se aplica a outro, o resultado
                  /// era uma caixa vazia com texto no meio, indistinguível
                  /// de um campo desabilitado.
                  ///
                  /// Tonal também é o peso certo: a ação primária do
                  /// atendimento mora na barra fixa embaixo, e avançar de
                  /// etapa não pode competir com ela.
                  child: FilledButton(
                    onPressed: () => _ir(proxima),

                    /// As cores vão **explícitas**.
                    ///
                    /// `FilledButton.tonal` pega o tom da variante nos
                    /// defaults do Material, e o tema do Orbit define
                    /// `filledButtonTheme` — que vence a variante e devolve o
                    /// azul cheio da ação primária. Duas ações primárias na
                    /// mesma tela é uma a mais: a do atendimento mora na
                    /// barra fixa embaixo.
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 48),
                      backgroundColor: palette.accentSoft,
                      foregroundColor: palette.accentStrong,
                      elevation: 0,
                    ),

                    /// "Avançar", nunca "Salvar": mudar de etapa não envia
                    /// comando nenhum, e prometer gravação seria mentir.
                    child: Text(
                      'Avançar · ${widget.steps[proxima].title}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
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
              onTap: () => onSelect(indice),
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
      step.isLocked,
    )) {
      (true, _, _) => (palette.accentSoft, palette.accentStrong),
      (_, true, _) => (palette.successSoft, palette.success),
      /* Travada: silenciada no trilho, mas continua um alvo — tocar nela abre a
         etapa e mostra o motivo, que é a única forma de a pessoa descobri-lo. */
      (_, _, true) => (palette.surfaceMuted, palette.inkDisabled),
      _ => (palette.surfaceMuted, palette.inkMuted),
    };

    return Semantics(
      button: true,
      selected: current,
      label:
          '${step.title}, etapa ${index + 1} de $total'
          '${step.complete ? ', concluída' : ''}'
          '${step.isLocked ? ', aguardando' : ''}',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: OrbitRadius.pill,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: OrbitSpacing.ms,
            vertical: 6,
          ),
          decoration: BoxDecoration(
            color: fundo,
            borderRadius: OrbitRadius.pill,
          ),
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
