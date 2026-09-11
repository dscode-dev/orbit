/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  MobileFieldService,
  type MobileFieldActor,
} from './mobile-field.service';

const actor: MobileFieldActor = {
  id: '01900000-0000-7000-8000-000000000001',
  organizationId: '01900000-0000-7000-8000-000000000002',
  businessUnitIds: ['01900000-0000-7000-8000-000000000003'],
  permissions: ['operations.read'],
};

describe('MobileFieldService', () => {
  it('returns a valid empty dashboard', async () => {
    const repository = { project: jest.fn().mockResolvedValue(emptySource()) };
    const service = new MobileFieldService(repository as never);
    await expect(service.dashboard(actor)).resolves.toMatchObject({
      next: null,
      counters: { today: 0, overdue: 0, inProgress: 0, upcoming: 0 },
      today: [],
      overdue: [],
      inProgress: [],
    });
  });

  it('does not turn assignment into execution authorization', async () => {
    const source = emptySource();
    source.businessUnits.push({
      id: actor.businessUnitIds[0],
      legalName: 'Recife',
      tradeName: null,
      timezone: 'America/Recife',
    });
    source.operations.push({
      id: '01900000-0000-7000-8000-000000000004',
      businessUnitId: actor.businessUnitIds[0],
      customerId: null,
      assetId: null,
      code: 'OS-1',
      title: 'Atendimento',
      description: null,
      status: 'OPEN',
      priority: 'NORMAL',
      scheduledStart: new Date('2099-01-01T12:00:00Z'),
      scheduledEnd: null,
      startedAt: null,
      completedAt: null,
      location: null,
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      responsibleFieldTechnician: { id: actor.id, displayName: 'João' },
      auxiliaryTechnicians: [],
      asset: null,
      artifactExecutions: [],
      checklistExecutions: [],
    });
    const service = new MobileFieldService({
      project: jest.fn().mockResolvedValue(source),
    } as never);
    const queue = await service.workQueue(actor, {});
    expect(queue.data).toHaveLength(1);
    expect(queue.data[0]?.allowedActions).toEqual(['VIEW']);
    expect(queue.data[0]?.allowedActions).not.toContain('START');
  });

  it('reports a rendered document as available, and a failed one as failed', async () => {
    /**
     * A regressão que este teste existe para impedir foi silenciosa: a
     * comparação era com `'RENDERED'`, estado que o domínio não tem — o pronto
     * se chama `READY`. Nada quebrou, e todo documento emitido aparecia como
     * "Preparando" para sempre.
     */
    const documentos = [
      documentRow('READY'),
      documentRow('NOT_RENDERED'),
      documentRow('PENDING'),
      documentRow('RENDERING'),
      documentRow('FAILED'),
      documentRow('ESTADO_QUE_AINDA_NAO_EXISTE'),
    ];
    const repository = {
      project: jest.fn().mockResolvedValue(emptySource()),
      recentDocuments: jest.fn().mockResolvedValue(documentos),
      recentAppointments: jest.fn().mockResolvedValue([]),
      recentlyCompleted: jest.fn().mockResolvedValue([]),
    };
    const service = new MobileFieldService(repository as never);

    const home = await service.home(actor);
    expect(home.recentDocuments.map((value) => value.state)).toEqual([
      'AVAILABLE',
      'PREPARING',
      'PREPARING',
      'PREPARING',
      'FAILED',

      /**
       * Um estado que este build não conhece degrada para "preparando" em vez
       * de derrubar a tela inicial de quem está em campo.
       */
      'PREPARING',
    ]);
  });

  it('resolves the public document label on the server', async () => {
    const repository = {
      project: jest.fn().mockResolvedValue(emptySource()),
      recentDocuments: jest
        .fn()
        .mockResolvedValue([
          documentRow('READY', 'SERVICE_ORDER'),
          documentRow('READY', 'PMOC'),
          documentRow('READY', 'TIPO_NOVO'),
        ]),
      recentAppointments: jest.fn().mockResolvedValue([]),
      recentlyCompleted: jest.fn().mockResolvedValue([]),
    };
    const service = new MobileFieldService(repository as never);

    const home = await service.home(actor);
    expect(home.recentDocuments.map((value) => value.label)).toEqual([
      'Ordem de serviço',
      'PMOC',

      /** Sigla crua nunca chega à tela. */
      'Documento',
    ]);
  });

  it('uses an opaque stable cursor without duplicates', async () => {
    const source = emptySource();
    source.businessUnits.push({
      id: actor.businessUnitIds[0],
      legalName: 'Recife',
      tradeName: null,
      timezone: 'America/Recife',
    });
    for (let index = 0; index < 55; index += 1) {
      source.operations.push({
        id: `01900000-0000-7000-8000-${String(index).padStart(12, '0')}`,
        businessUnitId: actor.businessUnitIds[0],
        customerId: null,
        assetId: null,
        code: `OS-${index}`,
        title: `Atendimento ${index}`,
        description: null,
        status: 'OPEN',
        priority: 'NORMAL',
        scheduledStart: new Date(
          `2099-01-${String((index % 28) + 1).padStart(2, '0')}T12:00:00Z`,
        ),
        scheduledEnd: null,
        startedAt: null,
        completedAt: null,
        location: null,
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        responsibleFieldTechnician: { id: actor.id, displayName: 'João' },
        auxiliaryTechnicians: [],
        asset: null,
        artifactExecutions: [],
        checklistExecutions: [],
      });
    }
    const service = new MobileFieldService({
      project: jest.fn().mockResolvedValue(source),
    } as never);
    const first = await service.workQueue(actor, { limit: 50 });
    const second = await service.workQueue(actor, {
      limit: 50,
      cursor: first.meta.nextCursor!,
    });
    expect(first.data).toHaveLength(50);
    expect(second.data).toHaveLength(5);
    expect(Buffer.byteLength(JSON.stringify(first), 'utf8')).toBeLessThan(
      128 * 1024,
    );
    expect(
      new Set([...first.data, ...second.data].map((item) => item.id)).size,
    ).toBe(55);
  });
  it('lista a base de clientes, mesmo quem não tem trabalho', async () => {
    /// O defeito que este teste tranca: a primeira versão derivava a lista
    /// da projeção de trabalho, e 433 dos 498 clientes cadastrados não
    /// apareciam — inclusive um recém-criado, que por definição ainda não
    /// tem atendimento nenhum.
    const repository = {
      project: jest.fn().mockResolvedValue(emptySource()),
      recentDocuments: jest.fn().mockResolvedValue([]),
      recentAppointments: jest.fn().mockResolvedValue([]),
      recentlyCompleted: jest.fn().mockResolvedValue([]),
      customersPage: jest.fn().mockResolvedValue([
        {
          id: 'c-sem-trabalho',
          legalName: 'Cliente Recém-Cadastrado LTDA',
          tradeName: null,
          documentNumber: null,
          status: 'ACTIVE',
        },
      ]),
    };
    const service = new MobileFieldService(repository as never);

    const pagina = await service.fieldCustomers(actor, {});

    expect(pagina.data).toHaveLength(1);
    expect(pagina.data[0]!.id).toBe('c-sem-trabalho');

    /// Aparece com zero, e zero é a resposta certa — não é motivo para sumir.
    expect(pagina.data[0]!.openCount).toBe(0);
    expect(pagina.data[0]!.completedCount).toBe(0);

    /// Sem nome fantasia, o nome exibido é a razão social.
    expect(pagina.data[0]!.name).toBe('Cliente Recém-Cadastrado LTDA');
  });

  it('a contagem de trabalho é pessoal, e casada por id', async () => {
    const cliente = { id: 'c1', name: 'Shopping Recife' };
    const repository = {
      project: jest.fn().mockResolvedValue(emptySource()),
      recentDocuments: jest.fn().mockResolvedValue([]),
      recentAppointments: jest.fn().mockResolvedValue([]),
      recentlyCompleted: jest.fn().mockResolvedValue([
        {
          id: 'op1',
          code: 'OP-1',
          title: 'Corretiva',
          kind: 'SERVICE_OPERATION',
          completedAt: new Date('2026-09-05T14:00:00.000Z'),
          customer: { id: 'c1', legalName: 'Shopping Recife S.A.' },
          asset: null,
        },
      ]),
      customersPage: jest.fn().mockResolvedValue([
        {
          id: 'c1',
          legalName: 'Shopping Recife S.A.',
          tradeName: 'Shopping Recife',
          documentNumber: null,
          status: 'ACTIVE',
        },
        {
          id: 'c2',
          legalName: 'Outro Cliente com Nome Igual',
          tradeName: 'Shopping Recife',
          documentNumber: null,
          status: 'ACTIVE',
        },
      ]),
    };
    const service = new MobileFieldService(repository as never);

    const pagina = await service.fieldCustomers(actor, {});

    /// Dois clientes com o **mesmo nome fantasia**. O histórico tem de cair
    /// no dono certo: casar por texto juntaria os dois num só número.
    const [primeiro, segundo] = pagina.data;
    expect(primeiro!.completedCount).toBe(1);
    expect(segundo!.completedCount).toBe(0);
    expect(cliente.id).toBe('c1');
  });
});

function emptySource() {
  return {
    businessUnits: [] as any[],
    operations: [] as any[],
    pmocCycles: [] as any[],
    rvtOccurrences: [] as any[],
    customers: [] as any[],
    rvtAssets: [] as any[],
  };
}

function documentRow(renderStatus: string, documentType = 'SERVICE_ORDER') {
  return {
    id: '01900000-0000-7000-8000-00000000000a',
    documentType,
    createdAt: new Date('2026-09-01T12:00:00Z'),
    artifactExecution: { renderStatus, customer: null },
  };
}
