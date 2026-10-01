/**
 * Como os widgets se arrumam na página.
 *
 * ## O problema que isto resolve
 *
 * A grade era uma fila de doze colunas: cada widget declarava sua largura e o
 * navegador quebrava linha quando não cabia mais. Com larguras iguais e **alturas
 * diferentes**, o resultado é buraco — a linha fica com a altura do widget mais
 * alto, e quem é baixo deixa um vazio embaixo de si.
 *
 * A primeira correção foi organizar cada trecho em duas colunas que empilham
 * independentes — principal de oito, lateral de quatro. Isso resolveu o buraco
 * *entre* widgets e criou outro: a lateral recebia **um** widget e a principal
 * empilhava três ou quatro, então sobrava uma faixa de quatro colunas vazia ao
 * lado das últimas. Era espaço suficiente para um painel de métricas, e era
 * exatamente isso que faltava na tela.
 *
 * ## A arrumação de agora
 *
 * Um widget de largura total é uma **faixa**: ocupa a linha sozinho e separa o que
 * vem antes do que vem depois. Entre duas faixas existe um **bloco**, e o bloco se
 * resolve em linhas de verdade:
 *
 * ```text
 * ┌ par (4) ──────┐ ┌ par (8) ───────────────────┐
 * │ Radar         │ │ Indicadores Executivos     │   ← a primeira linha
 * └───────────────┘ └────────────────────────────┘
 * ┌ resto (12) ─────────────────────────────────┐
 * │ Central de Atenção                          │   ← largo sozinho ocupa tudo
 * └─────────────────────────────────────────────┘
 * ┌ resto (6) ─────────┐ ┌ resto (6) ───────────┐
 * │ Atividades         │ │ Próximos             │   ← estreitos se emparelham
 * └────────────────────┘ └──────────────────────┘
 * ```
 *
 * **A primeira linha emparelha** o primeiro widget estreito com o primeiro largo.
 * É o par que o painel real pede: um gráfico de proporção fixa ao lado de um painel
 * de números, com a mesma altura. Numa linha, os dois esticam juntos — e é isso que
 * faz "a altura de um acompanhar a do outro" sem ninguém medir conteúdo.
 *
 * **O resto ocupa o que tem.** Largo sozinho vai a doze colunas em vez de ficar com
 * quatro vazias ao lado; estreitos se emparelham de dois em dois. Nenhuma linha
 * termina com buraco.
 *
 * ## O que esta arrumação não faz
 *
 * Não reordena. A ordem é do servidor — `GET /dashboard` decide o que aparece, em
 * que ordem e com que largura — e aqui só se decide **onde** cada um cabe. E não
 * depende de altura: medir conteúdo exigiria render, e altura de widget depende dos
 * dados do dia.
 */
import type { ResolvedDashboardWidget } from "@/types/dashboard";

/** Ocupa a linha inteira e separa um bloco do seguinte. */
export interface FaixaInteira<T> {
  readonly tipo: "faixa";
  readonly widget: T;
}

/**
 * Um trecho entre faixas.
 *
 * `par` tem zero, um ou dois widgets: o primeiro estreito e o primeiro largo do
 * bloco, que dividem a primeira linha. Com um só, ele ocupa a linha inteira — um
 * widget sozinho numa linha de duas colunas deixaria metade vazia, que é o defeito
 * que esta arrumação existe para não cometer.
 */
export interface BlocoEmLinhas<T> {
  readonly tipo: "bloco";
  readonly par: readonly T[];
  readonly resto: readonly T[];
}

export type SecaoDoPainel<T> = FaixaInteira<T> | BlocoEmLinhas<T>;

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

    /*
     * O par é o primeiro estreito com o primeiro largo.
     *
     * Os dois índices são procurados separadamente porque a ordem do servidor
     * pode trazer o largo antes do estreito — e o par continua sendo o mesmo par,
     * na ordem em que vieram.
     */
    const indiceEstreito = pendentes.findIndex(ehEstreito);
    const indiceLargo = pendentes.findIndex(
      (widget) => !ehEstreito(widget) && !ehFaixaInteira(widget),
    );

    const noPar = [indiceEstreito, indiceLargo].filter(
      (indice) => indice >= 0,
    );
    const par = pendentes.filter((_, indice) => noPar.includes(indice));
    const resto = pendentes.filter((_, indice) => !noPar.includes(indice));

    secoes.push({ tipo: "bloco", par, resto });
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
