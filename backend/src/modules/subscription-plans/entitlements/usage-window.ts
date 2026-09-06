/**
 * A janela mensal de uso — sempre mensal, nunca do calendário.
 *
 * Cota é mensal qualquer que venha a ser a periodicidade da cobrança (§5):
 * assinar por ano não adianta doze meses de uso de uma vez. E o mês é o do
 * inquilino, contado a partir da âncora da assinatura — quem assinou dia 17
 * tem janelas que começam dia 17, não dia 1º (§7, §78).
 *
 * A âncora chega de fora. Hoje vem da organização; na PR-PL-02 virá da
 * assinatura, e nada aqui muda.
 */
export interface UsageWindow {
  readonly start: Date;
  readonly end: Date;
}

/** A janela mensal, ancorada, que contém `at`. */
export function monthlyWindow(anchor: Date, at: Date): UsageWindow {
  const decorridos = mesesEntre(anchor, at);
  let indice = decorridos;
  while (adicionarMeses(anchor, indice) > at) indice -= 1;
  while (adicionarMeses(anchor, indice + 1) <= at) indice += 1;
  return {
    start: adicionarMeses(anchor, indice),
    end: adicionarMeses(anchor, indice + 1),
  };
}

/**
 * Soma meses preservando a hora e prendendo o dia ao fim do mês curto.
 *
 * Âncora em 31 de janeiro passa por 28 de fevereiro e volta a 31 de março —
 * porque cada janela é calculada da âncora original, e não da anterior. Somar
 * de janela em janela derraparia para o dia 28 para sempre.
 */
function adicionarMeses(anchor: Date, meses: number): Date {
  const alvo = new Date(
    Date.UTC(
      anchor.getUTCFullYear(),
      anchor.getUTCMonth() + meses,
      1,
      anchor.getUTCHours(),
      anchor.getUTCMinutes(),
      anchor.getUTCSeconds(),
      anchor.getUTCMilliseconds(),
    ),
  );
  const ultimoDia = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0),
  ).getUTCDate();
  alvo.setUTCDate(Math.min(anchor.getUTCDate(), ultimoDia));
  return alvo;
}

function mesesEntre(anchor: Date, at: Date): number {
  return (
    (at.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    (at.getUTCMonth() - anchor.getUTCMonth())
  );
}
