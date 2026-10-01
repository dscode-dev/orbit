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

  /**
   * O arranjo que o servidor manda hoje, e o que ele tem de produzir.
   *
   * O painel real tinha uma faixa de quatro colunas vazia ao lado dos últimos
   * widgets de cada bloco: a lateral recebia **um** widget e a coluna principal
   * empilhava três ou quatro. Era espaço suficiente para um painel de métricas, e
   * era justamente um painel de métricas que estava numa faixa própria embaixo.
   *
   * O que se prova aqui: o estreito e o primeiro largo dividem a primeira linha —
   * é o par que estica junto — e o resto ocupa a largura que tem, sem deixar
   * coluna vazia ao lado.
   */
  it("o painel real emparelha a primeira linha e não deixa coluna vazia", () => {
    const secoes = organizarPainel([
      w("radar", "MEDIUM"),
      w("kpis", "LARGE"),
      w("atencao", "LARGE"),
      w("financeiro", "LARGE"),
      w("indice", "MEDIUM"),
      w("atividades", "MEDIUM"),
      w("proximos", "MEDIUM"),
      w("clima", "FULL"),
    ]);

    expect(secoes.map((s) => s.tipo)).toEqual(["bloco", "faixa"]);

    const bloco = secoes[0];
    if (bloco?.tipo !== "bloco") throw new Error("esperava bloco");

    /* A primeira linha: o gráfico de proporção fixa ao lado do painel de números,
       com a mesma altura. */
    expect(ids(bloco.par)).toEqual(["radar", "kpis"]);

    /* O resto, na ordem do servidor. Nada foi reordenado. */
    expect(ids(bloco.resto)).toEqual([
      "atencao",
      "financeiro",
      "indice",
      "atividades",
      "proximos",
    ]);
  });

  it("o par respeita a ordem em que os dois vieram", () => {
    /* O servidor pode mandar o largo antes do estreito, e o par continua sendo o
       mesmo par — invertê-lo colocaria o gráfico à direita num painel em que ele
       sempre esteve à esquerda. */
    const secoes = organizarPainel([
      w("largo", "LARGE"),
      w("estreito", "MEDIUM"),
    ]);
    const bloco = secoes[0];
    if (bloco?.tipo !== "bloco") throw new Error("esperava bloco");

    expect(ids(bloco.par)).toEqual(["largo", "estreito"]);
    expect(bloco.resto).toEqual([]);
  });

  it("bloco sem widget estreito emparelha só o largo", () => {
    /* Um largo sozinho na primeira linha ocupa a linha inteira; a renderização
       cuida disso. O que não pode acontecer é ele cair no resto e a primeira linha
       nascer vazia. */
    const secoes = organizarPainel([w("a", "LARGE"), w("b", "LARGE")]);
    const bloco = secoes[0];
    if (bloco?.tipo !== "bloco") throw new Error("esperava bloco");

    expect(ids(bloco.par)).toEqual(["a"]);
    expect(ids(bloco.resto)).toEqual(["b"]);
  });

  it("bloco só de estreitos emparelha o primeiro e deixa o resto se emparelhar", () => {
    const secoes = organizarPainel([
      w("a", "MEDIUM"),
      w("b", "MEDIUM"),
      w("c", "SMALL"),
    ]);
    const bloco = secoes[0];
    if (bloco?.tipo !== "bloco") throw new Error("esperava bloco");

    expect(ids(bloco.par)).toEqual(["a"]);
    expect(ids(bloco.resto)).toEqual(["b", "c"]);
  });

  it("a ordem do servidor é preservada no resto", () => {
    /* O painel não reordena: decide onde colocar, nunca o que vem antes. */
    const secoes = organizarPainel([
      w("a", "LARGE"),
      w("b", "MEDIUM"),
      w("c", "MEDIUM"),
      w("d", "LARGE"),
    ]);
    const bloco = secoes[0];
    if (bloco?.tipo !== "bloco") throw new Error("esperava bloco");

    expect(ids(bloco.par)).toEqual(["a", "b"]);
    expect(ids(bloco.resto)).toEqual(["c", "d"]);
  });

  it("lista vazia não produz seção nenhuma", () => {
    expect(organizarPainel([])).toEqual([]);
  });

  it("faixas seguidas não criam blocos vazios entre elas", () => {
    const secoes = organizarPainel([w("a", "FULL"), w("b", "FULL")]);
    expect(secoes.map((s) => s.tipo)).toEqual(["faixa", "faixa"]);
  });
});
