/**
 * Validação de regra, sem banco.
 *
 * O que se prova aqui é que uma regra malformada **não entra**: campo fora do
 * gatilho, operador com valor errado, ação sem configuração, fila não
 * permitida. Descobrir isso meses depois, quando o lembrete não apareceu, é o
 * pior momento possível.
 */
import { ConflictException, ValidationException } from '../../exceptions';
import type { AutomationRepository } from './automation.repository';
import { AutomationService } from './automation.service';

describe('AutomationService', () => {
  const repository = {
    list: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    pendingExecutions: jest.fn(),
    listExecutions: jest.fn(),
    findUser: jest.fn(),
    findBusinessUnit: jest.fn(),
  };

  const service = new AutomationService(
    repository as unknown as AutomationRepository,
  );

  const reminder = {
    type: 'CREATE_REMINDER' as const,
    config: { title: 'Revisar preventiva' },
    delay: { amount: 6, unit: 'MONTHS' as const },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository.create.mockResolvedValue({ id: 'rule-id' });
    repository.findBusinessUnit.mockResolvedValue({ id: 'unit-id' });
    repository.findUser.mockResolvedValue({ userId: 'user-id' });
  });

  /* ---------------------------------------------------------------- */
  /* Catálogo                                                          */
  /* ---------------------------------------------------------------- */

  it('publica o catálogo com gatilhos, ações e operadores', () => {
    const catalog = service.catalog();
    expect(catalog.triggers.length).toBeGreaterThan(5);
    expect(catalog.operators).toContain('equals');
    expect(catalog.delayUnits).toContain('MONTHS');
    /** A ação indisponível aparece — declarada, não escondida. */
    const followUp = catalog.actions.find(
      (action) => action.type === 'CREATE_FOLLOW_UP_OPERATION',
    );
    expect(followUp?.available).toBe(false);
    expect(followUp?.unavailableReason).toBeTruthy();
  });

  /* ---------------------------------------------------------------- */
  /* Gatilho e condições                                               */
  /* ---------------------------------------------------------------- */

  it('recusa gatilho fora do catálogo', async () => {
    await expect(
      service.create('org-id', 'user-id', {
        name: 'Regra',
        trigger: 'universo.explodiu',
        actions: [reminder],
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('recusa condição sobre campo que o gatilho não oferece', async () => {
    await expect(
      service.create('org-id', 'user-id', {
        name: 'Regra',
        trigger: 'operation.completed',
        conditions: [{ field: 'cor', operator: 'equals', value: 'azul' }],
        actions: [reminder],
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('aceita condição sobre campo do gatilho', async () => {
    await service.create('org-id', 'user-id', {
      name: 'Preventiva concluída',
      trigger: 'operation.completed',
      conditions: [{ field: 'kind', operator: 'equals', value: 'PREVENTIVE' }],
      actions: [reminder],
    });
    expect(repository.create).toHaveBeenCalled();
  });

  it('`in` exige lista não vazia', async () => {
    await expect(
      service.create('org-id', 'user-id', {
        name: 'Regra',
        trigger: 'operation.completed',
        conditions: [{ field: 'kind', operator: 'in', value: 'PREVENTIVE' }],
        actions: [reminder],
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('`equals` exige texto', async () => {
    await expect(
      service.create('org-id', 'user-id', {
        name: 'Regra',
        trigger: 'operation.completed',
        conditions: [{ field: 'kind', operator: 'equals', value: ['A', 'B'] }],
        actions: [reminder],
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  /* ---------------------------------------------------------------- */
  /* Ações                                                             */
  /* ---------------------------------------------------------------- */

  it('recusa ação sem a configuração que ela exige', async () => {
    await expect(
      service.create('org-id', 'user-id', {
        name: 'Regra',
        trigger: 'operation.completed',
        actions: [{ type: 'CREATE_REMINDER', config: {} }],
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('notificação para USER exige destinatário membro da organização', async () => {
    repository.findUser.mockResolvedValue(null);
    await expect(
      service.create('org-id', 'user-id', {
        name: 'Regra',
        trigger: 'operation.completed',
        actions: [
          {
            type: 'SEND_NOTIFICATION',
            config: {
              title: 'Oi',
              body: 'corpo',
              target: 'USER',
              userId: 'de-fora',
            },
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('recusa fila não permitida em TRIGGER_JOB', async () => {
    await expect(
      service.create('org-id', 'user-id', {
        name: 'Regra',
        trigger: 'operation.completed',
        actions: [
          { type: 'TRIGGER_JOB', config: { queue: 'automation.action' } },
        ],
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('atribui id estável a cada ação — é a chave de idempotência', async () => {
    await service.create('org-id', 'user-id', {
      name: 'Regra',
      trigger: 'operation.completed',
      actions: [
        reminder,
        { type: 'TRIGGER_JOB', config: { queue: 'artifact.render' } },
      ],
    });
    const [data] = repository.create.mock.calls[0] as [
      { actions: { id: string }[] },
    ];
    expect(data.actions.map((action) => action.id)).toEqual(['a1', 'a2']);
  });

  it('editar preserva o id da ação que já existia', async () => {
    repository.find.mockResolvedValue({
      id: 'rule-id',
      trigger: 'operation.completed',
      name: 'Antiga',
      actions: [{ id: 'a1', type: 'CREATE_REMINDER', config: {} }],
    });
    repository.update.mockResolvedValue({ id: 'rule-id' });

    await service.update('rule-id', 'org-id', 'user-id', {
      actions: [reminder],
    });
    const [, , , data] = repository.update.mock.calls[0] as [
      string,
      string,
      string,
      { actions: { id: string }[] },
    ];
    expect(data.actions[0]!.id).toBe('a1');
  });

  /* ---------------------------------------------------------------- */
  /* Ciclo de vida                                                     */
  /* ---------------------------------------------------------------- */

  it('a cópia nasce desligada', async () => {
    repository.find.mockResolvedValue({
      id: 'rule-id',
      name: 'Original',
      description: null,
      trigger: 'operation.completed',
      conditions: [],
      actions: [{ id: 'a1', type: 'CREATE_REMINDER', config: {} }],
      businessUnit: null,
    });
    await service.duplicate('rule-id', 'org-id', 'user-id');
    const [data] = repository.create.mock.calls[0] as [
      { enabled: boolean; name: string },
    ];
    expect(data.enabled).toBe(false);
    expect(data.name).toContain('cópia');
  });

  /**
   * O caso que protege o lembrete de seis meses.
   *
   * Excluir a regra deixaria um job pendente que, ao acordar, não a encontraria
   * e seria descartado em silêncio — o usuário teria "cancelado" a automação
   * sem cancelá-la.
   */
  it('recusa excluir regra com ação agendada e não executada', async () => {
    repository.find.mockResolvedValue({ id: 'rule-id', name: 'Regra' });
    repository.pendingExecutions.mockResolvedValue(1);
    await expect(
      service.remove('rule-id', 'org-id', 'user-id'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.softDelete).not.toHaveBeenCalled();
  });

  it('exclui quando não há pendência', async () => {
    repository.find.mockResolvedValue({ id: 'rule-id', name: 'Regra' });
    repository.pendingExecutions.mockResolvedValue(0);
    await service.remove('rule-id', 'org-id', 'user-id');
    expect(repository.softDelete).toHaveBeenCalled();
  });
});
