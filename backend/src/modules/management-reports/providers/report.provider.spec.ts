/**
 * As duas decisões que os providers compartilham: quem pode ver, e o que dizer
 * quando o denominador é zero.
 */
import { allows, percent, unavailableSection } from './report.provider';

const access = (capabilities: string[], permissions: string[]) => ({
  capabilities: new Set(capabilities),
  permissions: new Set(permissions),
  wildcardCapability: capabilities.includes('*'),
  wildcardPermission: permissions.includes('*'),
});

describe('autorização de provider', () => {
  const requires = {
    capabilities: ['financial.read'],
    permissions: ['financial.read'],
  };

  it('exige capability do plano e permissão do papel', () => {
    expect(
      allows(access(['financial.read'], ['financial.read']), requires),
    ).toBe(true);
  });

  /** Plano sem o módulo: papel nenhum compra o que a assinatura não inclui. */
  it('recusa quando só o papel concede', () => {
    expect(allows(access([], ['financial.read']), requires)).toBe(false);
  });

  /** Módulo contratado, mas esta pessoa não administra dinheiro. */
  it('recusa quando só o plano concede', () => {
    expect(allows(access(['financial.read'], []), requires)).toBe(false);
  });

  it('curinga vale dos dois lados', () => {
    expect(allows(access(['*'], ['*']), requires)).toBe(true);
  });
});

describe('percentual derivado', () => {
  it('calcula com uma casa', () => {
    expect(percent(3, 4)).toBe('75.0');
  });

  /**
   * Zero de nada não é 0% — é ausência de pergunta. Publicar "0%" faria
   * parecer descumprimento total onde não houve o que cumprir.
   */
  it('devolve nulo quando não há denominador', () => {
    expect(percent(0, 0)).toBeNull();
  });
});

describe('seção indisponível', () => {
  it('carrega o motivo, e não zeros', () => {
    const section = unavailableSection('x', 'Financeiro', 'sem acesso');
    expect(section.metrics).toHaveLength(0);
    expect(section.tables).toHaveLength(0);
    expect(section.unavailableReason).toBe('sem acesso');
  });
});
