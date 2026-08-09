/**
 * A porta do Financeiro, conferida rota a rota.
 *
 * O requisito é explícito: **quem tem acesso à operação ou ao cliente não
 * obtém dados financeiros por causa disso**. Isso não se prova lendo o
 * controlador — se prova garantindo que nenhuma rota escape da dupla
 * capability + permissão financeira, inclusive as que alguém acrescentar
 * depois. Este teste percorre os métodos do controlador e falha na primeira
 * rota que esquecer o guarda.
 */
import { PERMISSIONS_KEY } from '../../decorators';
import { REQUIRED_CAPABILITIES_KEY } from '../subscription-plans/plan-access';
import { FinancialController } from './financial.controller';

const ROUTE_METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];

/** Nomes dos métodos que o Nest reconhece como rota. */
function routes(): string[] {
  const prototype = FinancialController.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(prototype).filter((name) => {
    if (name === 'constructor') return false;
    const handler = prototype[name];
    if (typeof handler !== 'function') return false;
    const method: unknown = Reflect.getMetadata('method', handler);
    /** `method` é numérico no Nest; a presença de `path` basta para identificar. */
    return (
      Reflect.hasMetadata('path', handler) ||
      ROUTE_METHODS.includes(String(method))
    );
  });
}

describe('FinancialController', () => {
  const handlers = routes();

  it('expõe rotas', () => {
    expect(handlers.length).toBeGreaterThan(10);
  });

  it.each(routes())('%s exige capability financeira', (name) => {
    const handler = (FinancialController.prototype as Record<string, unknown>)[
      name
    ] as object;
    const capabilities = Reflect.getMetadata(
      REQUIRED_CAPABILITIES_KEY,
      handler,
    ) as string[] | undefined;

    expect(capabilities).toBeDefined();
    expect(
      capabilities?.every((capability) => capability.startsWith('financial.')),
    ).toBe(true);
  });

  it.each(routes())('%s exige permissão financeira', (name) => {
    const handler = (FinancialController.prototype as Record<string, unknown>)[
      name
    ] as object;
    const permissions = Reflect.getMetadata(PERMISSIONS_KEY, handler) as
      string[] | undefined;

    expect(permissions).toBeDefined();
    expect(
      permissions?.every((permission) => permission.startsWith('financial.')),
    ).toBe(true);
  });

  /**
   * Escrever exige mais que ler.
   *
   * Sem isto, uma rota de escrita marcada com `financial.read` passaria pelos
   * dois testes acima e daria a quem só consulta o direito de criar receita.
   */
  it.each(routes())('%s casa escrita com capability de gestão', (name) => {
    const handler = (FinancialController.prototype as Record<string, unknown>)[
      name
    ] as object;
    const method = String(Reflect.getMetadata('method', handler) ?? '');
    const capabilities = (Reflect.getMetadata(
      REQUIRED_CAPABILITIES_KEY,
      handler,
    ) ?? []) as string[];

    /** `0` é `GET` na enumeração do Nest. */
    const readOnly = method === '0';
    if (!readOnly) {
      expect(capabilities).toContain('financial.manage');
    }
  });
});
