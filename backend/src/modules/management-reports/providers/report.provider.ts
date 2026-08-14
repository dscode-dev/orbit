/**
 * O contrato de um provider de relatório.
 *
 * Um provider sabe **um domínio** e devolve seções prontas. Ele não conhece
 * PDF, storage, fila, snapshot nem os outros domínios — é o que permite que a
 * Visão Executiva componha seis deles sem que nenhum saiba que a Visão
 * Executiva existe.
 *
 * ## Provider não calcula o que já tem dono
 *
 * O de Financeiro chama `FinancialService`; o de Estoque chama
 * `InventoryService`. Reimplementar a soma aqui criaria um segundo número para
 * a mesma pergunta, e os dois divergiriam no primeiro caso de borda — um
 * lançamento cancelado, um movimento de transferência contado duas vezes.
 *
 * O que é agregado no repositório de Reports é o que **não tinha dono**:
 * contagem de operações por situação, de propostas por evento, de execuções
 * por tipo, de carga por técnico.
 *
 * ## Ausência é resultado
 *
 * Um provider que não pode compor devolve a seção **vazia com motivo**, não
 * uma exceção e não zeros. Zero e "não posso ver" são coisas diferentes, e um
 * relatório que os confunde faz alguém tomar decisão sobre um número que não
 * existe.
 */
import type {
  ReportSectionReadModel,
  ReportSourceReadModel,
} from '../report.read-models';
import type { ReportScope } from '../report.repository';

/** O que o ator pode consultar — decidido pelo serviço, não pelo provider. */
export interface ReportAccess {
  readonly capabilities: ReadonlySet<string>;
  readonly permissions: ReadonlySet<string>;
  /** `true` quando o plano concede tudo (`*`). */
  readonly wildcardCapability: boolean;
  readonly wildcardPermission: boolean;
}

export function allows(
  access: ReportAccess,
  requires: { capabilities: readonly string[]; permissions: readonly string[] },
): boolean {
  const capabilityOk =
    access.wildcardCapability ||
    requires.capabilities.every((capability) =>
      access.capabilities.has(capability),
    );
  const permissionOk =
    access.wildcardPermission ||
    requires.permissions.every((permission) =>
      access.permissions.has(permission),
    );
  return capabilityOk && permissionOk;
}

export interface ReportProviderContext {
  readonly scope: ReportScope;
  readonly access: ReportAccess;
}

export interface ReportComposition {
  readonly sections: readonly ReportSectionReadModel[];
  readonly sources: readonly ReportSourceReadModel[];
}

export interface ReportProvider {
  readonly domain: string;
  /** Exigências do domínio — conferidas antes de compor. */
  readonly requires: {
    readonly capabilities: readonly string[];
    readonly permissions: readonly string[];
  };
  compose(context: ReportProviderContext): Promise<ReportComposition>;
}

/* -------------------------------------------------------------------- */
/* Ajudantes de composição                                               */
/* -------------------------------------------------------------------- */

/** `bigint` do `COUNT` vira texto. Número grande em JSON não é seguro. */
export const count = (value: bigint | number | null | undefined): string =>
  String(value ?? 0);

/**
 * Percentual derivado, com uma casa.
 *
 * Devolve `null` quando o denominador é zero: "0%" de nada é uma afirmação
 * falsa — não houve o que cumprir, e a métrica sai declarada como ausente em
 * vez de sugerir desempenho ruim.
 */
export function percent(
  part: bigint | number,
  whole: bigint | number,
): string | null {
  const total = Number(whole);
  if (!Number.isFinite(total) || total <= 0) return null;
  return ((Number(part) / total) * 100).toFixed(1);
}

/** Seção que não pôde ser composta — com o motivo escrito. */
export function unavailableSection(
  id: string,
  title: string,
  reason: string,
): ReportSectionReadModel {
  return { id, title, metrics: [], tables: [], unavailableReason: reason };
}
