/**
 * O interpretador de condições — o coração da regra.
 *
 * É o único código do motor que decide **se** algo acontece, e por isso o mais
 * barato de testar sem banco: entra payload, sai verdadeiro ou falso.
 */
import { evaluate } from './automation.evaluator';
import type { RuleCondition } from './automation.catalog';

describe('automation evaluator', () => {
  const payload = {
    kind: 'PREVENTIVE',
    status: 'COMPLETED',
    priority: 'NORMAL',
    businessUnitId: 'unit-a',
  };

  it('sem condições, a regra vale sempre', () => {
    expect(evaluate([], payload).matched).toBe(true);
  });

  it('todas as condições precisam ser verdadeiras', () => {
    const conditions: RuleCondition[] = [
      { field: 'kind', operator: 'equals', value: 'PREVENTIVE' },
      { field: 'status', operator: 'equals', value: 'COMPLETED' },
    ];
    expect(evaluate(conditions, payload).matched).toBe(true);
  });

  it('uma condição falsa barra a regra, e diz qual', () => {
    const result = evaluate(
      [
        { field: 'kind', operator: 'equals', value: 'PREVENTIVE' },
        { field: 'priority', operator: 'equals', value: 'URGENT' },
      ],
      payload,
    );
    expect(result.matched).toBe(false);
    expect(result.failedOn).toBe('priority equals');
  });

  it('`in` testa pertinência', () => {
    expect(
      evaluate(
        [
          {
            field: 'kind',
            operator: 'in',
            value: ['PREVENTIVE', 'CORRECTIVE'],
          },
        ],
        payload,
      ).matched,
    ).toBe(true);
    expect(
      evaluate(
        [{ field: 'kind', operator: 'in', value: ['CORRECTIVE'] }],
        payload,
      ).matched,
    ).toBe(false);
  });

  it('`exists` pergunta se o campo veio preenchido', () => {
    expect(
      evaluate([{ field: 'businessUnitId', operator: 'exists' }], payload)
        .matched,
    ).toBe(true);
    expect(
      evaluate([{ field: 'customerId', operator: 'exists' }], payload).matched,
    ).toBe(false);
  });

  /**
   * O caso que engana.
   *
   * A leitura ingênua diria que "campo ausente é diferente de X", e a regra
   * dispararia para eventos que nem carregam o campo. Uma condição sobre o que
   * não existe não tem resposta — e o silêncio certo é não disparar.
   */
  it('campo ausente não satisfaz notEquals', () => {
    expect(
      evaluate(
        [{ field: 'customerId', operator: 'notEquals', value: 'x' }],
        payload,
      ).matched,
    ).toBe(false);
  });

  it('notEquals vale quando o campo existe e difere', () => {
    expect(
      evaluate(
        [{ field: 'kind', operator: 'notEquals', value: 'CORRECTIVE' }],
        payload,
      ).matched,
    ).toBe(true);
  });

  /** Objeto no payload não vira `"[object Object]"` — é tratado como ausente. */
  it('valor não escalar é tratado como ausente', () => {
    const dirty = { nested: { a: 1 } } as unknown as Record<string, unknown>;
    expect(
      evaluate([{ field: 'nested', operator: 'exists' }], dirty).matched,
    ).toBe(false);
  });

  it('número e booleano são comparados como texto', () => {
    const mixed = { total: 500, urgent: true };
    expect(
      evaluate([{ field: 'total', operator: 'equals', value: '500' }], mixed)
        .matched,
    ).toBe(true);
    expect(
      evaluate([{ field: 'urgent', operator: 'equals', value: 'true' }], mixed)
        .matched,
    ).toBe(true);
  });
});
