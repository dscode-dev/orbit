/**
 * As regras que decidem se uma manutenção está em dia.
 *
 * É o coração do domínio e o mais barato de testar: entram estado, vencimento e
 * hoje; sai uma palavra e um número de dias.
 */
import {
  canTransition,
  evaluateCompliance,
  executionEligibility,
  frequencyLabel,
  toDateOnly,
} from './pmoc.domain';

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe('máquina de estados do plano', () => {
  it('rascunho vira ativo ou cancelado', () => {
    expect(canTransition('DRAFT', 'ACTIVE')).toBe(true);
    expect(canTransition('DRAFT', 'CANCELLED')).toBe(true);
    expect(canTransition('DRAFT', 'SUSPENDED')).toBe(false);
  });

  it('ativo suspende e volta', () => {
    expect(canTransition('ACTIVE', 'SUSPENDED')).toBe(true);
    expect(canTransition('SUSPENDED', 'ACTIVE')).toBe(true);
  });

  /**
   * Vencido é constatação do calendário, não decisão de ninguém: quem o
   * atribui é o servidor comparando a vigência com hoje.
   */
  it('ninguém marca um plano como vencido à mão', () => {
    expect(canTransition('ACTIVE', 'EXPIRED')).toBe(false);
    expect(canTransition('DRAFT', 'EXPIRED')).toBe(false);
  });

  /** Cancelado é terminal: retomar é criar outro, e o histórico fica legível. */
  it('cancelado não volta', () => {
    expect(canTransition('CANCELLED', 'ACTIVE')).toBe(false);
    expect(canTransition('CANCELLED', 'DRAFT')).toBe(false);
  });
});

describe('conformidade', () => {
  const base = {
    planStatus: 'ACTIVE',
    dueSoonDays: 15,
    today: day('2026-06-01'),
  };

  it('em dia quando o vencimento está longe', () => {
    const result = evaluateCompliance({
      ...base,
      nextDueOn: day('2026-08-01'),
    });
    expect(result.status).toBe('UP_TO_DATE');
    expect(result.daysUntilDue).toBe(61);
    expect(result.overdue).toBe(false);
  });

  it('próximo do vencimento dentro da antecedência do plano', () => {
    const result = evaluateCompliance({
      ...base,
      nextDueOn: day('2026-06-10'),
    });
    expect(result.status).toBe('DUE_SOON');
    expect(result.daysUntilDue).toBe(9);
  });

  /** O limite é inclusivo: no dia exato da antecedência já é aviso. */
  it('o dia da antecedência já conta como próximo', () => {
    const result = evaluateCompliance({
      ...base,
      nextDueOn: day('2026-06-16'),
    });
    expect(result.status).toBe('DUE_SOON');
    expect(result.daysUntilDue).toBe(15);
  });

  it('vencido quando a data passou, com os dias negativos', () => {
    const result = evaluateCompliance({
      ...base,
      nextDueOn: day('2026-05-20'),
    });
    expect(result.status).toBe('OVERDUE');
    expect(result.daysUntilDue).toBe(-12);
    expect(result.overdue).toBe(true);
  });

  /** Vence hoje ainda não está vencido — o dia inteiro é do prazo. */
  it('vencendo hoje ainda não está vencido', () => {
    const result = evaluateCompliance({
      ...base,
      nextDueOn: day('2026-06-01'),
    });
    expect(result.status).toBe('DUE_SOON');
    expect(result.daysUntilDue).toBe(0);
    expect(result.overdue).toBe(false);
  });

  /**
   * A antecedência é do plano.
   *
   * Trinta dias faz sentido num plano anual e é ruído num semanal — por isso
   * não é constante global.
   */
  it('a antecedência muda a leitura do mesmo vencimento', () => {
    const near = evaluateCompliance({
      ...base,
      dueSoonDays: 60,
      nextDueOn: day('2026-07-15'),
    });
    const far = evaluateCompliance({
      ...base,
      dueSoonDays: 5,
      nextDueOn: day('2026-07-15'),
    });
    expect(near.status).toBe('DUE_SOON');
    expect(far.status).toBe('UP_TO_DATE');
  });

  /**
   * Plano fora de operação não está em dia **nem** atrasado.
   *
   * Chamar um plano suspenso de "em dia" faria um painel dizer que está tudo
   * certo quando ninguém está mantendo nada.
   */
  it('só plano ativo é avaliado', () => {
    for (const status of ['DRAFT', 'SUSPENDED', 'EXPIRED', 'CANCELLED']) {
      const result = evaluateCompliance({
        ...base,
        planStatus: status,
        nextDueOn: day('2026-05-01'),
      });
      expect(result.status).toBe('NOT_APPLICABLE');
      expect(result.daysUntilDue).toBeNull();
      expect(result.overdue).toBe(false);
    }
  });

  it('sem vencimento definido não há avaliação', () => {
    const result = evaluateCompliance({ ...base, nextDueOn: null });
    expect(result.status).toBe('NOT_APPLICABLE');
  });

  /** A comparação é por dia: a hora do instante não muda o veredito. */
  it('a hora do dia não muda o resultado', () => {
    const morning = evaluateCompliance({
      ...base,
      today: new Date('2026-06-01T02:00:00.000Z'),
      nextDueOn: day('2026-06-01'),
    });
    const evening = evaluateCompliance({
      ...base,
      today: new Date('2026-06-01T23:30:00.000Z'),
      nextDueOn: day('2026-06-01'),
    });
    expect(morning.status).toBe(evening.status);
    expect(morning.daysUntilDue).toBe(evening.daysUntilDue);
  });
});

describe('apresentação da periodicidade', () => {
  it('singular e plural', () => {
    expect(frequencyLabel({ amount: 1, unit: 'MONTHS' })).toBe('a cada 1 mês');
    expect(frequencyLabel({ amount: 6, unit: 'MONTHS' })).toBe(
      'a cada 6 meses',
    );
    expect(frequencyLabel({ amount: 1, unit: 'YEARS' })).toBe('a cada 1 ano');
  });
});

describe('datas', () => {
  it('viajam como dia, sem hora', () => {
    expect(toDateOnly(new Date('2026-06-01T23:45:00.000Z'))).toBe('2026-06-01');
  });
});

describe('elegibilidade de execução por equipamento', () => {
  const pronto = {
    planStatus: 'ACTIVE',
    cycleStatus: 'PENDING',
    equipmentStatus: 'ACTIVE',
    technicalResponsibleUserId: 'user-1',
    technicalResponsible: { eligible: true, blockedReason: null },
  };

  it('libera quando plano, ciclo, equipamento e responsável estão em ordem', () => {
    expect(executionEligibility(pronto)).toEqual({
      ready: true,
      blockedReasons: [],
    });
  });

  it('bloqueia plano fora de ativo', () => {
    const result = executionEligibility({ ...pronto, planStatus: 'SUSPENDED' });
    expect(result.ready).toBe(false);
    expect(result.blockedReasons).toContain('PLAN_NOT_ACTIVE');
  });

  it('bloqueia ciclo que não está pendente', () => {
    expect(
      executionEligibility({ ...pronto, cycleStatus: 'COMPLETED' })
        .blockedReasons,
    ).toContain('CYCLE_NOT_PENDING');
  });

  it('bloqueia equipamento inativo', () => {
    expect(
      executionEligibility({ ...pronto, equipmentStatus: 'INACTIVE' })
        .blockedReasons,
    ).toContain('EQUIPMENT_INACTIVE');
  });

  it('cobra responsável técnico quando o plano não tem um', () => {
    expect(
      executionEligibility({
        ...pronto,
        technicalResponsibleUserId: null,
        technicalResponsible: null,
      }).blockedReasons,
    ).toEqual(['TECHNICAL_RESPONSIBLE_MISSING']);
  });

  it('repassa o motivo que a workforce deu para o responsável', () => {
    expect(
      executionEligibility({
        ...pronto,
        technicalResponsible: {
          eligible: false,
          blockedReason: 'PROFESSIONAL_PROFILE_INACTIVE',
        },
      }).blockedReasons,
    ).toEqual(['PROFESSIONAL_PROFILE_INACTIVE']);
  });

  it('tem um motivo genérico quando a workforce recusa sem dizer por quê', () => {
    expect(
      executionEligibility({
        ...pronto,
        technicalResponsible: { eligible: false, blockedReason: null },
      }).blockedReasons,
    ).toEqual(['TECHNICAL_RESPONSIBLE_INELIGIBLE']);
  });

  it('acumula os motivos, na ordem em que a preparação sempre os listou', () => {
    expect(
      executionEligibility({
        planStatus: 'CANCELLED',
        cycleStatus: 'COMPLETED',
        equipmentStatus: 'INACTIVE',
        technicalResponsibleUserId: null,
        technicalResponsible: null,
      }).blockedReasons,
    ).toEqual([
      'PLAN_NOT_ACTIVE',
      'CYCLE_NOT_PENDING',
      'EQUIPMENT_INACTIVE',
      'TECHNICAL_RESPONSIBLE_MISSING',
    ]);
  });
});
