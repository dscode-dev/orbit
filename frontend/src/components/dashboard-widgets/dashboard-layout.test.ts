import { describe, expect, it } from "vitest";

import { organizarPainel } from "./dashboard-layout";

type W = { id: string; size: "SMALL" | "MEDIUM" | "LARGE" | "FULL" };
const w = (id: string, size: W["size"]): W => ({ id, size });

/** Só os ids, para as asserções ficarem legíveis. */
const ids = (lista: readonly W[]) => lista.map((item) => item.id);

describe("organizarPainel", () => {
  it("um widget de largura total vira faixa e separa blocos", () => {
    const secoes = organizarPainel([
      w("radar", "MEDIUM"),
      w("atencao", "LARGE"),
      w("kpis", "FULL"),
      w("financeiro", "LARGE"),
    ]);

    expect(secoes.map((s) => s.tipo)).toEqual(["bloco", "faixa", "bloco"]);
  });

  it("o painel real deixa de ter a coluna baixa ao lado da alta", () => {
    /**
     * Este é o arranjo que o servidor manda hoje. O que se prova: "Saúde
     * Financeira", "Atividades Recentes" e "Próximos Eventos" ficam na mesma
     * coluna, embaixo uma da outra — e "Índice de Saúde", que é o widget
     * alto, fica na lateral. Antes os três primeiros estavam em linhas
     * diferentes, separados pelo vazio que a altura do "Índice" abria.
     */
    const secoes = organizarPainel([
      w("radar", "MEDIUM"),
      w("atencao", "LARGE"),
      w("kpis", "FULL"),
      w("financeiro", "LARGE"),
      w("indice", "MEDIUM"),
      w("atividades", "MEDIUM"),
      w("proximos", "MEDIUM"),
      w("pmoc", "MEDIUM"),
      w("clima", "LARGE"),
    ]);

    expect(secoes).toHaveLength(3);

    const primeiro = secoes[0];
    if (primeiro?.tipo !== "bloco") throw new Error("esperava bloco");
    expect(ids(primeiro.lateral)).toEqual(["radar"]);
    expect(ids(primeiro.principal)).toEqual(["atencao"]);

    const ultimo = secoes[2];
    if (ultimo?.tipo !== "bloco") throw new Error("esperava bloco");
    expect(ids(ultimo.lateral)).toEqual(["indice"]);
    expect(ids(ultimo.principal)).toEqual([
      "financeiro",
      "atividades",
      "proximos",
      "pmoc",
      "clima",
    ]);
  });

  it("a ordem do servidor é preservada dentro de cada coluna", () => {
    /// O painel não reordena: decide onde colocar, nunca o que vem antes.
    const secoes = organizarPainel([
      w("a", "LARGE"),
      w("b", "MEDIUM"),
      w("c", "MEDIUM"),
      w("d", "LARGE"),
    ]);
    const bloco = secoes[0];
    if (bloco?.tipo !== "bloco") throw new Error("esperava bloco");
    expect(ids(bloco.principal)).toEqual(["a", "c", "d"]);
  });

  it("bloco sem nenhum widget estreito não inventa lateral", () => {
    const secoes = organizarPainel([w("a", "LARGE"), w("b", "LARGE")]);
    const bloco = secoes[0];
    if (bloco?.tipo !== "bloco") throw new Error("esperava bloco");
    expect(bloco.lateral).toEqual([]);
    expect(ids(bloco.principal)).toEqual(["a", "b"]);
  });

  it("lista vazia não produz seção nenhuma", () => {
    expect(organizarPainel([])).toEqual([]);
  });

  it("faixas seguidas não criam blocos vazios entre elas", () => {
    const secoes = organizarPainel([w("a", "FULL"), w("b", "FULL")]);
    expect(secoes.map((s) => s.tipo)).toEqual(["faixa", "faixa"]);
  });
});
