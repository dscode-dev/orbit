/**
 * O que se testa aqui é **apresentação**, não regra.
 *
 * Nenhuma recorrência é calculada no navegador — não há teste de "semestral =
 * mais seis meses" porque não existe código que faça isso. O que existe é a
 * tradução do que o servidor publicou, e é ela que precisa de prova: código
 * cru não vaza, o vocabulário é o do produto, e um motivo de RVT não cai na
 * frase de outro domínio.
 */
import { describe, expect, it } from "vitest";

import {
  CONFIGURATION_STATUS,
  DUE_STATE,
  OCCURRENCE_BLOCKED_REASONS,
  OCCURRENCE_STATUS,
  SCHEDULE_MODE,
  VISIT_TYPE,
  configurationStatus,
  dueState,
  isOneTime,
  occurrenceBlockedLabel,
  occurrenceStatus,
  recurrenceLabel,
  visitType,
} from "./rvt";

const ONE_TIME = { scheduleMode: "ONE_TIME", visitType: "SEMIANNUAL" } as const;
const WEEKLY = { scheduleMode: "RECURRING", visitType: "WEEKLY" } as const;
const SEMIANNUAL = {
  scheduleMode: "RECURRING",
  visitType: "SEMIANNUAL",
} as const;

describe("periodicidade", () => {
  it("traduz o tipo de visita para linguagem natural", () => {
    expect(visitType("WEEKLY").label).toBe("Semanal");
    expect(visitType("SEMIANNUAL").label).toBe("Semestral");
  });

  it("semestral nunca vira uma contagem de dias", () => {
    /**
     * "180 dias" seria uma regra de calendário reconstruída aqui — e errada:
     * seis meses civis vão de 181 a 184 dias conforme a data de partida.
     */
    for (const entry of Object.values(VISIT_TYPE)) {
      expect(entry.label).not.toMatch(/\d+\s*dias?/i);
      expect(entry.description ?? "").not.toMatch(/\d+\s*dias?/i);
    }
  });

  it("a visita avulsa é descrita pela agenda, não pelo tipo", () => {
    /**
     * Uma visita única também tem `visitType` — anunciar "Semestral" para algo
     * que acontece uma vez só seria simplesmente falso.
     */
    expect(recurrenceLabel(ONE_TIME)).toBe("Uma única vez");
    expect(recurrenceLabel(WEEKLY)).toBe("Semanal");
    expect(recurrenceLabel(SEMIANNUAL)).toBe("Semestral");
  });

  it("avulsa é derivada de ONE_TIME, não de um enum local", () => {
    expect(isOneTime(ONE_TIME)).toBe(true);
    expect(isOneTime(WEEKLY)).toBe(false);
  });
});

describe("vocabulário", () => {
  const MAPS = {
    CONFIGURATION_STATUS,
    OCCURRENCE_STATUS,
    DUE_STATE,
    VISIT_TYPE,
    SCHEDULE_MODE,
  };

  it("nenhum rótulo é o código cru", () => {
    for (const [name, map] of Object.entries(MAPS)) {
      for (const [code, entry] of Object.entries(map)) {
        expect(entry.label, `${name}.${code}`).not.toBe(code);
        expect(entry.label, `${name}.${code}`).not.toMatch(/^[A-Z_]+$/);
      }
    }
  });

  it("código desconhecido vira traço, não o próprio código", () => {
    expect(configurationStatus("ALGO_NOVO").label).toBe("—");
    expect(occurrenceStatus("ALGO_NOVO").label).toBe("—");
    expect(dueState(null).label).toBe("—");
  });
});

describe("vencimento", () => {
  it("só atraso e hoje pedem atenção", () => {
    expect(dueState("OVERDUE").tone).toBe("critical");
    expect(dueState("DUE_TODAY").tone).toBe("warning");
    /** O estado normal de quase toda visita futura não deve alarmar. */
    expect(dueState("UPCOMING").tone).toBe("neutral");
  });
});

describe("Responsável Técnico condicional", () => {
  it("a ausência de RT não é apresentada como falha", () => {
    /**
     * Nenhum estado de configuração fala de RT: a exigência é um campo
     * (`requiresTechnicalResponsible`) publicado pelo servidor, e a tela lê o
     * campo em vez de deduzir bloqueio de um status.
     */
    for (const entry of Object.values(CONFIGURATION_STATUS)) {
      expect(entry.description ?? "").not.toMatch(/respons[áa]vel t[ée]cnico/i);
    }
    expect(CONFIGURATION_STATUS.ACTIVE!.tone).toBe("success");
    expect(CONFIGURATION_STATUS.INACTIVE!.tone).toBe("neutral");
  });
});

describe("motivos de bloqueio", () => {
  /** Um motivo profissional conhecido, como o registro da PR-27 devolveria. */
  const professional = (code: string) =>
    code === "SIGNATURE_MISSING" ? "Assinatura ausente." : null;

  it("traduz os motivos do próprio domínio", () => {
    expect(occurrenceBlockedLabel("OCCURRENCE_CANCELLED", professional)).toBe(
      OCCURRENCE_BLOCKED_REASONS.OCCURRENCE_CANCELLED,
    );
  });

  it("encadeia com o domínio profissional em vez de duplicá-lo", () => {
    expect(occurrenceBlockedLabel("SIGNATURE_MISSING", professional)).toBe(
      "Assinatura ausente.",
    );
  });

  it("motivo desconhecido cai no texto genérico do RVT", () => {
    /**
     * A lição da FE-03: deixar um código de RVT cair na frase de assinatura ou
     * de PMOC daria ao usuário uma explicação de outro domínio — errada com
     * aparência de certa.
     */
    expect(occurrenceBlockedLabel("ALGO_NOVO", professional)).toBe(
      "Visita indisponível no momento.",
    );
  });
});
