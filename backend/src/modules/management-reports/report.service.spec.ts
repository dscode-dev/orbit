/**
 * Regras do serviço, sem banco: período, autorização composta e parâmetros.
 */
import { ForbiddenException, ValidationException } from '../../exceptions';
import type { BackgroundJobQueue } from '../jobs/background-job.queue';
import type { StorageFileMapper } from '../storage/file-object.mapper';
import type { FileObjectService } from '../storage/file-object.service';
import type { SubscriptionPlanService } from '../subscription-plans/subscription-plan.service';
import { ReportMapper } from './report.mapper';
import type { ReportRepository } from './report.repository';
import { ReportService, type ReportActor } from './report.service';

describe('ReportService', () => {
  const repository = {
    createOrReuse: jest.fn(),
    find: jest.fn(),
    findWithFile: jest.fn(),
    findBusinessUnit: jest.fn(),
    findCustomer: jest.fn(),
    organizationTimezone: jest.fn(),
    audit: jest.fn(),
    list: jest.fn(),
  };
  const jobs = { enqueue: jest.fn() };
  const plans = { getEntitlements: jest.fn() };

  const service = new ReportService(
    repository as unknown as ReportRepository,
    new ReportMapper(),
    jobs as unknown as BackgroundJobQueue,
    plans as unknown as SubscriptionPlanService,
    {} as unknown as FileObjectService,
    {} as unknown as StorageFileMapper,
  );

  const actor: ReportActor = {
    organizationId: 'org-1',
    actorId: 'user-1',
    permissions: ['reports.management.manage', 'operations.read'],
    businessUnitIds: [],
  };

  const record = {
    id: 'report-1',
    type: 'OPERATIONS_PERFORMANCE',
    schemaVersion: 1,
    status: 'PENDING',
    format: 'PDF',
    parameters: {},
    data: null,
    sourceHash: null,
    provenance: [],
    timezone: 'America/Recife',
    periodFrom: new Date('2026-01-01T00:00:00Z'),
    periodTo: new Date('2026-01-31T00:00:00Z'),
    generatedAt: null,
    fileId: null,
    renderer: null,
    error: null,
    attempts: 0,
    correlationId: 'corr-1',
    createdAt: new Date('2026-02-01T00:00:00Z'),
    businessUnit: null,
    generatedBy: { id: 'user-1', displayName: 'Alguém' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    plans.getEntitlements.mockResolvedValue({
      capabilities: ['operations.read', 'reports.management.manage'],
    });
    repository.organizationTimezone.mockResolvedValue('America/Recife');
    repository.createOrReuse.mockResolvedValue({
      id: 'report-1',
      created: true,
    });
    repository.find.mockResolvedValue(record);
  });

  const request = (overrides: Record<string, unknown> = {}) =>
    ({
      type: 'OPERATIONS_PERFORMANCE',
      dateFrom: new Date('2026-01-01T00:00:00Z'),
      dateTo: new Date('2026-01-31T00:00:00Z'),
      ...overrides,
    }) as never;

  /* ---------------------------------------------------------------- */
  /* Catálogo                                                          */
  /* ---------------------------------------------------------------- */

  it('o catálogo diz o que esta sessão pode gerar, e por que não pode', async () => {
    const catalog = await service.catalog(actor);

    const operations = catalog.types.find(
      (type) => type.type === 'OPERATIONS_PERFORMANCE',
    );
    const financial = catalog.types.find(
      (type) => type.type === 'FINANCIAL_PERFORMANCE',
    );

    expect(catalog.types).toHaveLength(8);
    expect(operations?.allowed).toBe(true);
    expect(financial?.allowed).toBe(false);
    /** O motivo é texto porque a interface precisa exibi-lo. */
    expect(financial?.blockedReason).toContain('financial.read');
  });

  /* ---------------------------------------------------------------- */
  /* Autorização composta                                              */
  /* ---------------------------------------------------------------- */

  /**
   * O caso central desta PR: quem tem o motor mas não tem o domínio não lê o
   * domínio por dentro do motor.
   */
  it('recusa o relatório financeiro sem financial.read', async () => {
    await expect(
      service.generate(actor, request({ type: 'FINANCIAL_PERFORMANCE' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it('recusa quando o plano não inclui, mesmo com a permissão do papel', async () => {
    plans.getEntitlements.mockResolvedValue({ capabilities: [] });
    await expect(
      service.generate(
        { ...actor, permissions: ['financial.read'] },
        request({ type: 'FINANCIAL_PERFORMANCE' }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('aceita quando plano e papel concedem', async () => {
    plans.getEntitlements.mockResolvedValue({
      capabilities: ['financial.read'],
    });
    repository.find.mockResolvedValue({
      ...record,
      type: 'FINANCIAL_PERFORMANCE',
    });
    await service.generate(
      { ...actor, permissions: ['financial.read'] },
      request({ type: 'FINANCIAL_PERFORMANCE' }),
    );
    expect(repository.createOrReuse).toHaveBeenCalled();
  });

  /* ---------------------------------------------------------------- */
  /* Período                                                           */
  /* ---------------------------------------------------------------- */

  it('recusa período invertido', async () => {
    await expect(
      service.generate(
        actor,
        request({
          dateFrom: new Date('2026-03-01T00:00:00Z'),
          dateTo: new Date('2026-01-01T00:00:00Z'),
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  /** A janela é declarada, e a recusa diz o limite em vez de truncar. */
  it('recusa janela maior que a permitida pelo tipo', async () => {
    await expect(
      service.generate(
        actor,
        request({
          dateFrom: new Date('2020-01-01T00:00:00Z'),
          dateTo: new Date('2026-01-01T00:00:00Z'),
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  /* ---------------------------------------------------------------- */
  /* Parâmetros e fuso                                                 */
  /* ---------------------------------------------------------------- */

  it('resolve o fuso da unidade, não do cliente', async () => {
    repository.findBusinessUnit.mockResolvedValue({
      id: 'unit-1',
      legalName: 'Filial',
      tradeName: 'Filial',
      timezone: 'Europe/Lisbon',
    });

    await service.generate(actor, request({ businessUnitId: 'unit-1' }));

    const [data] = repository.createOrReuse.mock.calls[0] as [
      { timezone: string; parameters: Record<string, unknown> },
    ];
    expect(data.timezone).toBe('Europe/Lisbon');
    expect(data.parameters.timezone).toBe('Europe/Lisbon');
    expect(repository.organizationTimezone).not.toHaveBeenCalled();
  });

  /**
   * Descartar em silêncio produziria um relatório da organização inteira para
   * quem pediu o de um cliente.
   */
  it('recusa parâmetro que o tipo não aceita', async () => {
    plans.getEntitlements.mockResolvedValue({
      capabilities: ['inventory.read'],
    });
    await expect(
      service.generate(
        { ...actor, permissions: ['inventory.read'] },
        request({ type: 'INVENTORY_CONSUMPTION', customerId: 'customer-1' }),
      ),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('aceita o parâmetro que o tipo declara', async () => {
    repository.findCustomer.mockResolvedValue({ id: 'customer-1' });
    await service.generate(actor, request({ customerId: 'customer-1' }));
    const [data] = repository.createOrReuse.mock.calls[0] as [
      { parameters: Record<string, unknown> },
    ];
    expect(data.parameters.customerId).toBe('customer-1');
  });

  it('o mesmo recorte produz o mesmo hash de solicitação', async () => {
    await service.generate(actor, request());
    await service.generate(actor, request());
    const calls = repository.createOrReuse.mock.calls as [
      { parametersHash: string },
    ][];
    expect(calls[0]![0].parametersHash).toBe(calls[1]![0].parametersHash);
  });

  /* ---------------------------------------------------------------- */
  /* Concorrência                                                      */
  /* ---------------------------------------------------------------- */

  /** Segundo clique: devolve o que já está em andamento, sem enfileirar. */
  it('não enfileira de novo quando já há geração em andamento', async () => {
    repository.createOrReuse.mockResolvedValue({
      id: 'report-1',
      created: false,
    });
    await service.generate(actor, request());
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it('enfileira levando a autorização do momento do pedido', async () => {
    await service.generate(actor, request());
    const [job] = jobs.enqueue.mock.calls[0] as [
      { payload: { capabilities: string[]; permissions: string[] } },
    ];
    expect(job.payload.capabilities).toContain('operations.read');
    expect(job.payload.permissions).toContain('operations.read');
  });

  /* ---------------------------------------------------------------- */
  /* Unidade fora do escopo                                            */
  /* ---------------------------------------------------------------- */

  it('recusa unidade fora do recorte da sessão', async () => {
    repository.findBusinessUnit.mockResolvedValue({
      id: 'unit-2',
      legalName: 'Outra',
      tradeName: null,
      timezone: 'America/Recife',
    });
    await expect(
      service.generate(
        { ...actor, businessUnitIds: ['unit-1'] },
        request({ businessUnitId: 'unit-2' }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
