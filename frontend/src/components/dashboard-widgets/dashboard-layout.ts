/**
 * Como os widgets se arrumam na página.
 *
 * ## O problema que isto resolve
 *
 * A grade era uma fila de doze colunas: cada widget declarava sua largura e
 * o navegador quebrava linha quando não cabia mais. Com larguras iguais e
 * **alturas diferentes**, o resultado é buraco — a linha fica com a altura do
 * widget mais alto, e quem é baixo deixa um vazio embaixo de si.
 *
 * No painel real isso ficou grosseiro: "Índice de Saúde" é alto, "Saúde
 * Financeira" ao lado dele é baixo, e sobrava uma faixa de várias centenas de
 * pixels em branco. "Atividades Recentes" e "Próximos Eventos" apareciam
 * depois desse vazio, parecendo largados no fim da página.
 *
 * ## A arrumação
 *
 * Um widget de largura total é uma **faixa**: ele separa o que vem antes do
 * que vem depois, e ocupa a linha sozinho. Entre duas faixas existe um
 * **bloco**, e um bloco tem duas colunas que rolam independentes:
 *
 * ```text
 * ┌ principal (8) ─────────────┐ ┌ lateral (4) ┐
 * │ Saúde Financeira           │ │ Índice de   │
 * ├─────────────┬──────────────┤ │ Saúde       │
 * │ Atividades  │ Próximos     │ │             │
 * └─────────────┴──────────────┘ └─────────────┘
 * ```
 *
 * Como cada coluna empilha por conta própria, a altura de uma não abre buraco
 * na outra — que era a causa do vazio.
 *
 * ## A regra da lateral
 *
 * A lateral recebe **o primeiro widget estreito do bloco**, e só ele. O resto
 * vai para a principal, onde os estreitos se emparelham de dois em dois.
 *
 * É deliberadamente simples: qualquer regra que dependesse de altura exigiria
 * medir o conteúdo, e altura de widget depende dos dados do dia. Esta regra é
 * previsível — quem olha o registry sabe onde cada coisa vai cair — e produz
 * a arrumação certa para o painel que existe.
 */
import type { ResolvedDashboardWidget } from "@/types/dashboard";

/** Ocupa a linha inteira e separa um bloco do seguinte. */
export interface FaixaInteira<T> {
  readonly tipo: "faixa";
  readonly widget: T;
}

/** Duas colunas que empilham sem se esperar. */
export interface BlocoDuasColunas<T> {
  readonly tipo: "bloco";
  readonly principal: readonly T[];
  readonly lateral: readonly T[];
}

export type SecaoDoPainel<T> = FaixaInteira<T> | BlocoDuasColunas<T>;

type ComTamanho = Pick<ResolvedDashboardWidget, "size">;

/** Ocupa a linha inteira sozinho. */
export function ehFaixaInteira(widget: ComTamanho): boolean {
  return widget.size === "FULL";
}

/** Cabe ao lado de outro. */
export function ehEstreito(widget: ComTamanho): boolean {
  return widget.size === "SMALL" || widget.size === "MEDIUM";
}

/**
 * Divide a lista em faixas e blocos, **preservando a ordem** que o servidor
 * mandou. Nada é reordenado: o que muda é onde cada widget é colocado.
 */
export function organizarPainel<T extends ComTamanho>(
  widgets: readonly T[],
): readonly SecaoDoPainel<T>[] {
  const secoes: SecaoDoPainel<T>[] = [];
  let pendentes: T[] = [];

  const fecharBloco = () => {
    if (pendentes.length === 0) return;

    /// O primeiro estreito vai para a lateral; o resto desce para a
    /// principal, na ordem em que veio.
    const indiceDoPrimeiroEstreito = pendentes.findIndex(ehEstreito);
    const lateral =
      indiceDoPrimeiroEstreito >= 0
        ? [pendentes[indiceDoPrimeiroEstreito]!]
        : [];
    const principal = pendentes.filter(
      (_, indice) => indice !== indiceDoPrimeiroEstreito,
    );

    secoes.push({ tipo: "bloco", principal, lateral });
    pendentes = [];
  };

  for (const widget of widgets) {
    if (ehFaixaInteira(widget)) {
      fecharBloco();
      secoes.push({ tipo: "faixa", widget });
      continue;
    }
    pendentes.push(widget);
  }
  fecharBloco();

  return secoes;
}
