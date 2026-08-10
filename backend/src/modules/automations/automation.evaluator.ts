/**
 * O interpretador de condições.
 *
 * Quatro operadores sobre campos escalares de um payload plano. Não avalia
 * expressão, não resolve caminho aninhado, não chama função. É deliberadamente
 * pequeno: cada capacidade a mais aqui é uma capacidade a mais de um tenant
 * fazer o servidor executar algo que ninguém previu.
 *
 * **Todas as condições precisam ser verdadeiras.** Não há `OR` nem
 * agrupamento — quem precisa de duas alternativas cria duas regras, e cada uma
 * fica legível sozinha. Um editor de expressão booleana seria o começo do BPMN
 * que esta PR existe para não construir.
 */
import type { RuleCondition } from './automation.catalog';

export interface EvaluationResult {
  matched: boolean;
  /** Qual condição barrou — para o log dizer por que a regra não valeu. */
  failedOn: string | null;
}

export function evaluate(
  conditions: readonly RuleCondition[],
  payload: Record<string, unknown>,
): EvaluationResult {
  for (const condition of conditions) {
    if (!satisfies(condition, payload)) {
      return {
        matched: false,
        failedOn: `${condition.field} ${condition.operator}`,
      };
    }
  }
  return { matched: true, failedOn: null };
}

function satisfies(
  condition: RuleCondition,
  payload: Record<string, unknown>,
): boolean {
  /**
   * Só escalar é comparável.
   *
   * O emissor já limpa o payload, mas um evento gravado por uma versão antiga
   * pode trazer objeto. Converter com `String()` daria `"[object Object]"` — e
   * uma condição que comparasse com esse texto passaria a valer para qualquer
   * objeto. Não escalar é tratado como ausente.
   */
  const raw = payload[condition.field];
  const actual =
    typeof raw === 'string' ||
    typeof raw === 'number' ||
    typeof raw === 'boolean'
      ? String(raw)
      : null;

  switch (condition.operator) {
    case 'exists':
      return actual !== null && actual !== '';

    case 'equals':
      return actual !== null && actual === expected(condition.value);

    /**
     * Campo ausente **não** satisfaz `notEquals`.
     *
     * A leitura ingênua diria que `null !== 'PREVENTIVE'` é verdadeiro, e a
     * regra dispararia para eventos que nem carregam o campo. Uma condição
     * sobre um campo que não existe não tem resposta — e o silêncio certo é
     * não disparar.
     */
    case 'notEquals':
      return actual !== null && actual !== expected(condition.value);

    case 'in':
      return (
        actual !== null &&
        Array.isArray(condition.value) &&
        condition.value.map(String).includes(actual)
      );

    default:
      return false;
  }
}

function expected(value: RuleCondition['value']): string | null {
  if (typeof value === 'string') return value;
  return null;
}
