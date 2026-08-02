"use client";

/**
 * Qual fuso a agenda usa para renderizar.
 *
 * O requisito é "o fuso da organização/unidade". Olhando os contratos:
 *
 * - `BusinessUnitReadModel.timezone` **existe** — é o fuso da unidade;
 * - `OrganizationContextReadModel` **não tem** campo de fuso;
 * - cada calendário e cada evento carregam o próprio `timezone`.
 *
 * Então a resolução vai da fonte mais específica para a mais genérica, e a
 * origem escolhida é devolvida junto para a interface poder declará-la — quem
 * olha um horário tem o direito de saber de onde veio o fuso.
 *
 * O fuso do navegador é o último recurso e é rotulado como tal. Ele nunca é
 * usado silenciosamente: essa é justamente a conversão implícita que a agenda
 * precisa evitar.
 */
import { useMemo } from "react";

import { isValidTimeZone } from "@/lib/scheduling";
import { useActiveScope } from "@/providers/use-active-scope";
import { useSession } from "@/providers/session-provider";

export interface SchedulingTimeZone {
  readonly timeZone: string;
  /** Texto curto de origem, para o rótulo da barra de período. */
  readonly origin: string;
}

const FALLBACK = "America/Sao_Paulo";

export function useSchedulingTimeZone(): SchedulingTimeZone {
  const session = useSession();
  const { businessUnitId } = useActiveScope();

  return useMemo(() => {
    const active = session.businessUnits.find(
      (unit) => unit.id === businessUnitId,
    );
    if (active?.timezone && isValidTimeZone(active.timezone)) {
      return {
        timeZone: active.timezone,
        origin: `unidade ${active.tradeName ?? active.legalName}`,
      };
    }

    const primary =
      session.businessUnits.find((unit) => unit.isPrimary) ??
      session.businessUnits[0];
    if (primary?.timezone && isValidTimeZone(primary.timezone)) {
      return {
        timeZone: primary.timezone,
        origin: `unidade principal ${primary.tradeName ?? primary.legalName}`,
      };
    }

    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browser && isValidTimeZone(browser)) {
      return { timeZone: browser, origin: "fuso deste navegador" };
    }

    return { timeZone: FALLBACK, origin: "padrão da aplicação" };
  }, [session.businessUnits, businessUnitId]);
}
