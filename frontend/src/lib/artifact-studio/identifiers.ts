/**
 * Sugestão de identificadores.
 *
 * O `id` de seção, campo e assinatura é escolha de quem configura — ele
 * aparece na integração, na exportação e nos dados preenchidos. O Studio
 * apenas **sugere** um valor derivado do rótulo; o usuário pode trocar, e
 * quem valida unicidade e formato é o backend.
 */
import { ARTIFACT_LIMITS } from "@/types/artifact-templates";

/**
 * Transforma um rótulo em identificador aceito pelo contrato.
 *
 * Acentos viram a letra base — o padrão do backend
 * (`/^[a-zA-Z][a-zA-Z0-9_.-]*$/`) não aceita diacríticos, e "Inspeção" precisa
 * virar `inspecao`, não `inspe_o`.
 */
export function toIdentifier(label: string): string {
  const base = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, ARTIFACT_LIMITS.identifierMaxLength);

  /** O contrato exige começar com letra. */
  return /^[a-z]/.test(base) ? base : `campo_${base}`.slice(0, 120);
}

/** Mesma ideia para `key` do template, que é MAIÚSCULA com hífen ou sublinhado. */
export function toTemplateKey(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, ARTIFACT_LIMITS.keyMaxLength);

  return /^[A-Z]/.test(base) ? base : `T_${base}`.slice(0, 100);
}

/** E para os identificadores de tipo, que seguem `/^[A-Z][A-Z0-9_.-]*$/`. */
export function toTypeIdentifier(value: string): string {
  const base = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_.-]+/g, "_")
    .replace(/^[^A-Z]+/, "")
    .slice(0, ARTIFACT_LIMITS.typeMaxLength);
  return base;
}

/**
 * Acrescenta sufixo até não colidir com os identificadores já usados.
 *
 * Evita o 400 previsível de "Duplicate field ids" quando alguém cria dois
 * campos com o mesmo rótulo — que é o caminho natural ao duplicar uma seção.
 */
export function uniqueIdentifier(
  candidate: string,
  used: readonly string[],
): string {
  const taken = new Set(used);
  if (!taken.has(candidate)) return candidate;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const next = `${candidate}_${suffix}`;
    if (!taken.has(next)) return next;
  }
  return `${candidate}_${Date.now()}`;
}
