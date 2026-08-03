/**
 * Janelas de comparação mês a mês.
 *
 * Aritmética de calendário, não cálculo de indicador: o que sai daqui são
 * dois pares `from`/`to` que viram duas consultas ao `/analytics`. Quem conta,
 * divide e classifica é o backend — este arquivo só decide **qual período**
 * perguntar.
 *
 * ## Mês corrente contra o mesmo trecho do mês anterior
 *
 * Comparar 1–17 de agosto com julho inteiro faria agosto parecer sempre pior.
 * A janela anterior termina no mesmo dia do mês, então os dois períodos têm o
 * mesmo tamanho e a comparação significa alguma coisa. O rótulo devolvido diz
 * exatamente qual recorte está no gráfico.
 *
 * ## Fuso
 *
 * O primeiro dia do mês é o primeiro dia **na unidade**, não em UTC. Em
 * `America/Recife` a diferença é de três horas — operações abertas no dia 1º
 * de madrugada cairiam no mês anterior se a fronteira fosse UTC.
 */
import {
  addZonedMonths,
  instantFromZoned,
  startOfZonedMonth,
  zonedParts,
} from "@/lib/scheduling";

export interface ComparisonWindow {
  readonly from: string;
  readonly to: string;
  /** Rótulo curto do recorte, ex.: "1–17 de ago." */
  readonly label: string;
}

export interface MonthComparison {
  /** Mês corrente, do dia 1 até hoje. */
  readonly thisMonth: ComparisonWindow;
  /** Mesmo trecho do mês anterior. */
  readonly lastMonth: ComparisonWindow;
}

const monthName = (instant: Date, timeZone: string): string =>
  new Intl.DateTimeFormat("pt-BR", { timeZone, month: "short" })
    .format(instant)
    .replace(".", "");

/**
 * Constrói as duas janelas a partir de um instante de referência.
 *
 * `reference` é quantizado no dia: o gráfico não deve refazer a consulta a
 * cada render só porque os milissegundos mudaram.
 */
export function buildMonthComparison(
  reference: Date,
  timeZone: string,
): MonthComparison {
  const parts = zonedParts(reference, timeZone);

  /** Fim da janela: o dia corrente inteiro, até 23:59:59 na unidade. */
  const endOfToday = instantFromZoned(
    {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: 23,
      minute: 59,
      second: 59,
    },
    timeZone,
  );

  const currentStart = startOfZonedMonth(reference, timeZone);
  const previousStart = addZonedMonths(currentStart, -1, timeZone);

  /**
   * Mesmo dia do mês anterior.
   *
   * `addZonedMonths` já resolve o mês curto — 31 de março menos um mês cai no
   * último dia de fevereiro, que é o recorte comparável possível.
   */
  const previousEnd = addZonedMonths(endOfToday, -1, timeZone);

  return {
    thisMonth: {
      from: currentStart.toISOString(),
      to: endOfToday.toISOString(),
      label: `1–${parts.day} de ${monthName(currentStart, timeZone)}`,
    },
    lastMonth: {
      from: previousStart.toISOString(),
      to: previousEnd.toISOString(),
      label: `1–${zonedParts(previousEnd, timeZone).day} de ${monthName(previousStart, timeZone)}`,
    },
  };
}
