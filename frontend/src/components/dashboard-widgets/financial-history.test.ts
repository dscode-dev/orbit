import { describe, expect, it } from "vitest";

import { historyWindow, HISTORY_MONTHS } from "./financial-history";

const HOJE = new Date("2026-10-02T09:00:00.000Z");

describe("a janela da evolução", () => {
  it("são doze meses de calendário, terminando no fim do recorte", () => {
    /* A série é mensal, e o painel abre em trinta dias: um gráfico de linha com um
       ponto não desenha nada, e era por isso que ele não aparecia. */
    expect(historyWindow("2026-10-02", HOJE)).toEqual({
      from: "2025-11-01",
      to: "2026-10-02",
    });
  });

  it("começa no primeiro dia do mês, não no mesmo dia", () => {
    /* Meio mês no começo da série daria um ponto com metade do movimento, e a linha
       cairia no primeiro trecho por recorte, não por queda. */
    expect(historyWindow("2026-10-31", HOJE).from).toBe("2025-11-01");
  });

  it("atravessa a virada de ano", () => {
    expect(historyWindow("2026-02-15", HOJE)).toEqual({
      from: "2025-03-01",
      to: "2026-02-15",
    });
  });

  it("aceita instante e usa só o dia", () => {
    /* O recorte do painel chega como ISO completo. */
    expect(historyWindow("2026-10-02T23:59:59.000Z", HOJE).to).toBe(
      "2026-10-02",
    );
  });

  it("sem fim escolhido, termina hoje", () => {
    expect(historyWindow(undefined, HOJE)).toEqual({
      from: "2025-11-01",
      to: "2026-10-02",
    });
  });

  it("a janela cobre o número de meses declarado", () => {
    /* Doze meses contando o corrente: de novembro a outubro são doze rótulos. */
    const janela = historyWindow("2026-10-02", HOJE);
    const [anoInicio, mesInicio] = janela.from.split("-").map(Number);
    const [anoFim, mesFim] = janela.to.split("-").map(Number);
    const meses = (anoFim! - anoInicio!) * 12 + (mesFim! - mesInicio!) + 1;

    expect(meses).toBe(HISTORY_MONTHS);
  });
});
