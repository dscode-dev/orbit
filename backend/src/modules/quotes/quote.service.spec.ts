/**
 * Regras do Commercial Engine, sem banco.
 *
 * Prova decisão de domínio: o que cada estado aceita, o que congela um item, o
 * que impede enviar uma proposta vazia. **Não** prova idempotência,
 * concorrência nem isolamento — essas são garantias do banco, e um mock delas
 * provaria apenas que o mock funciona. Ver o E2E.
 */
import { ConflictException, ValidationException } from '../../exceptions';
import type { QuoteRepository } from './quote.repository';
import { QuoteService } from './quote.service';

const decimal = (value: string) => ({ toString: () => value });

const quote = (overrides: Record<string, unknown> = {}) => ({
  id: 'quote-id',
  number: 1,
  code: 'ORC-000001',
  status: 'DRAFT',
  title: 'Manutenção preventiva anual',
  notes: null,
  validUntil: new Date('2099-12-31T00:00:00.000Z'),
  currency: 'BRL',
  subtotal: decimal('1000.00'),
  discount: decimal('0.00'),
  total: decimal('1000.00'),
  operationId: null,
  operation: null,
  convertedAt: null,
  sentAt: null,
  decidedAt: null,
  closingReason: null,
  expiredAt: null,
  cancelledAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  customer: { id: 'customer-id', legalName: 'Cliente', tradeName: null },
  businessUnit: { id: 'unit-id', legalName: 'Matriz', tradeName: null },
  createdBy: { id: 'user-id', displayName: 'Vendedor' },
  sentBy: null,
  decidedBy: null,
  items: [],
  _count: { items: 1 },
  ...overrides,
});

describe('QuoteService', () => {
  const repository = {
    list: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    addItem: jest.fn(),
    updateItem: jest.fn(),
    removeItem: jest.fn(),
    findItem: jest.fn(),
    transition: jest.fn(),
    convert: jest.fn(),
    expire: jest.fn(),
    findBusinessUnit: jest.fn(),
    findCustomer: jest.fn(),
    findCatalogItem: jest.fn(),
    nextOperationCode: jest.fn(),
  };

  const service = new QuoteService(repository as unknown as QuoteRepository);

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findBusinessUnit.mockResolvedValue({ id: 'unit-id' });
    repository.findCustomer.mockResolvedValue({ id: 'customer-id' });
    repository.expire.mockResolvedValue(undefined);
    repository.transition.mockImplementation((input: { to: string }) =>
      quote({ status: input.to }),
    );
  });

  /* ---------------------------------------------------------------- */
  /* Criação                                                           */
  /* ---------------------------------------------------------------- */

  it('recusa validade no passado — proposta não nasce vencida', async () => {
    await expect(
      service.create('org-id', 'unit-id', 'user-id', {
        customerId: 'customer-id',
        title: 'Proposta',
        validUntil: new Date('2020-01-01'),
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('recusa moeda fora das suportadas', async () => {
    await expect(
      service.create('org-id', 'unit-id', 'user-id', {
        customerId: 'customer-id',
        title: 'Proposta',
        currency: 'XYZ',
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('exige unidade de negócio', async () => {
    await expect(
      service.create('org-id', null, 'user-id', {
        customerId: 'customer-id',
        title: 'Proposta',
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  /* ---------------------------------------------------------------- */
  /* Itens e snapshot                                                  */
  /* ---------------------------------------------------------------- */

  it('congela descrição, SKU, unidade e preço do Catálogo', async () => {
    repository.find.mockResolvedValue(quote());
    repository.findCatalogItem.mockResolvedValue({
      id: 'product-id',
      kind: 'PART',
      name: 'Filtro G4 620x620',
      sku: 'FLT-620',
      unit: 'UN',
      salePrice: decimal('89.90'),
      status: 'ACTIVE',
    });
    repository.addItem.mockResolvedValue(quote());

    await service.addItem('quote-id', 'org-id', 'user-id', {
      catalogItemId: 'product-id',
      quantity: 4,
    });

    const [, , , , snapshot] = repository.addItem.mock.calls[0] as [
      string,
      string,
      string,
      string,
      Record<string, unknown>,
    ];
    expect(snapshot).toMatchObject({
      catalogItemId: 'product-id',
      kind: 'PART',
      description: 'Filtro G4 620x620',
      sku: 'FLT-620',
      unit: 'UN',
      quantity: '4.000',
      unitPrice: '89.90',
    });
  });

  it('o preço informado sobrepõe o do Catálogo — negociar é o que se faz', async () => {
    repository.find.mockResolvedValue(quote());
    repository.findCatalogItem.mockResolvedValue({
      id: 'product-id',
      kind: 'SERVICE',
      name: 'Limpeza de evaporadora',
      sku: null,
      unit: 'H',
      salePrice: decimal('120.00'),
      status: 'ACTIVE',
    });
    repository.addItem.mockResolvedValue(quote());

    await service.addItem('quote-id', 'org-id', 'user-id', {
      catalogItemId: 'product-id',
      quantity: 2.5,
      unitPrice: 99,
    });

    const [, , , , snapshot] = repository.addItem.mock.calls[0] as [
      string,
      string,
      string,
      string,
      Record<string, unknown>,
    ];
    expect(snapshot.unitPrice).toBe('99.00');
    expect(snapshot.quantity).toBe('2.500');
  });

  it('recusa item de catálogo indisponível', async () => {
    repository.find.mockResolvedValue(quote());
    repository.findCatalogItem.mockResolvedValue({
      id: 'product-id',
      kind: 'PRODUCT',
      name: 'Descontinuado',
      sku: null,
      unit: 'UN',
      salePrice: decimal('10.00'),
      status: 'INACTIVE',
    });

    await expect(
      service.addItem('quote-id', 'org-id', 'user-id', {
        catalogItemId: 'product-id',
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('item livre exige descrição e preço', async () => {
    repository.find.mockResolvedValue(quote());
    await expect(
      service.addItem('quote-id', 'org-id', 'user-id', { quantity: 1 }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('não aceita item em orçamento já enviado', async () => {
    repository.find.mockResolvedValue(quote({ status: 'SENT' }));
    await expect(
      service.addItem('quote-id', 'org-id', 'user-id', {
        description: 'Serviço',
        unitPrice: 10,
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  /* ---------------------------------------------------------------- */
  /* Máquina de estados                                                */
  /* ---------------------------------------------------------------- */

  it('não envia orçamento sem itens', async () => {
    repository.find.mockResolvedValue(quote({ _count: { items: 0 } }));
    await expect(
      service.send('quote-id', 'org-id', 'user-id'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('não envia orçamento de valor zero', async () => {
    repository.find.mockResolvedValue(quote({ total: decimal('0.00') }));
    await expect(
      service.send('quote-id', 'org-id', 'user-id'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('não envia orçamento sem validade', async () => {
    repository.find.mockResolvedValue(quote({ validUntil: null }));
    await expect(
      service.send('quote-id', 'org-id', 'user-id'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('envia rascunho completo, registrando o autor', async () => {
    repository.find.mockResolvedValue(quote());
    await service.send('quote-id', 'org-id', 'user-id');

    const [input] = repository.transition.mock.calls[0] as [
      Record<string, unknown>,
    ];
    expect(input.to).toBe('SENT');
    expect(input.from).toEqual(['DRAFT']);
    expect((input.data as Record<string, unknown>).sentById).toBe('user-id');
    /** Enviar não é evento financeiro: nada foi decidido ainda. */
    expect(input.event).toBeUndefined();
  });

  it('aprova apenas o que foi enviado', async () => {
    repository.find.mockResolvedValue(quote({ status: 'DRAFT' }));
    await expect(
      service.approve('quote-id', 'org-id', 'user-id'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('aprovação dispara o evento financeiro', async () => {
    repository.find.mockResolvedValue(quote({ status: 'SENT' }));
    await service.approve('quote-id', 'org-id', 'user-id');

    const [input] = repository.transition.mock.calls[0] as [
      Record<string, unknown>,
    ];
    expect(input.to).toBe('APPROVED');
    expect(input.event).toBe(true);
  });

  it('expira antes de decidir qualquer transição', async () => {
    repository.find.mockResolvedValue(quote({ status: 'SENT' }));
    await service.approve('quote-id', 'org-id', 'user-id');
    expect(repository.expire).toHaveBeenCalledWith('org-id');
  });

  it('não aprova orçamento expirado', async () => {
    repository.find.mockResolvedValue(quote({ status: 'EXPIRED' }));
    await expect(
      service.approve('quote-id', 'org-id', 'user-id'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('cancela também depois de aprovado, disparando o evento', async () => {
    repository.find.mockResolvedValue(quote({ status: 'APPROVED' }));
    await service.cancel('quote-id', 'org-id', 'user-id', {
      reason: 'Cliente desistiu',
    });

    const [input] = repository.transition.mock.calls[0] as [
      Record<string, unknown>,
    ];
    expect(input.to).toBe('CANCELLED');
    expect(input.event).toBe(true);
    expect((input.data as Record<string, unknown>).closingReason).toBe(
      'Cliente desistiu',
    );
  });

  it('não cancela o que já é terminal', async () => {
    repository.find.mockResolvedValue(quote({ status: 'REJECTED' }));
    await expect(
      service.cancel('quote-id', 'org-id', 'user-id', { reason: 'tarde' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('recusa a transição quando outra requisição já mudou o estado', async () => {
    repository.find.mockResolvedValue(quote({ status: 'SENT' }));
    repository.transition.mockResolvedValue(null);
    await expect(
      service.approve('quote-id', 'org-id', 'user-id'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  /* ---------------------------------------------------------------- */
  /* Edição                                                            */
  /* ---------------------------------------------------------------- */

  it('recusa desconto maior que o subtotal', async () => {
    repository.find.mockResolvedValue(quote());
    await expect(
      service.update('quote-id', 'org-id', 'user-id', { discount: 2000 }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('não edita orçamento enviado', async () => {
    repository.find.mockResolvedValue(quote({ status: 'SENT' }));
    await expect(
      service.update('quote-id', 'org-id', 'user-id', { title: 'Outro' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('não apaga orçamento enviado — cancela', async () => {
    repository.find.mockResolvedValue(quote({ status: 'SENT' }));
    await expect(
      service.remove('quote-id', 'org-id', 'user-id'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  /* ---------------------------------------------------------------- */
  /* Conversão                                                         */
  /* ---------------------------------------------------------------- */

  it('converte apenas orçamento aprovado', async () => {
    repository.find.mockResolvedValue(quote({ status: 'SENT' }));
    await expect(
      service.convert('quote-id', 'org-id', 'user-id', {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('já convertido devolve o mesmo, sem criar nada', async () => {
    const converted = quote({
      status: 'APPROVED',
      operationId: 'operation-id',
      operation: { id: 'operation-id', code: 'OS-1', title: 'Serviço' },
    });
    repository.find.mockResolvedValue(converted);

    const result = await service.convert('quote-id', 'org-id', 'user-id', {});
    expect(repository.convert).not.toHaveBeenCalled();
    expect(result.operationId).toBe('operation-id');
  });

  it('deriva o código da operação do código do orçamento', async () => {
    repository.find.mockResolvedValue(quote({ status: 'APPROVED' }));
    repository.nextOperationCode.mockResolvedValue('OS-ORC-000001');
    repository.convert.mockResolvedValue(quote({ status: 'APPROVED' }));

    await service.convert('quote-id', 'org-id', 'user-id', {});

    const [input] = repository.convert.mock.calls[0] as [
      Record<string, unknown>,
    ];
    expect(input.code).toBe('OS-ORC-000001');
    expect(input.kind).toBe('MAINTENANCE');
    expect(input.customerId).toBe('customer-id');
  });

  it('recusa agendamento invertido na conversão', async () => {
    repository.find.mockResolvedValue(quote({ status: 'APPROVED' }));
    await expect(
      service.convert('quote-id', 'org-id', 'user-id', {
        scheduledStart: new Date('2026-09-10T10:00:00Z'),
        scheduledEnd: new Date('2026-09-10T08:00:00Z'),
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('quem perde a corrida da conversão recebe o resultado existente', async () => {
    repository.find.mockResolvedValue(quote({ status: 'APPROVED' }));
    repository.nextOperationCode.mockResolvedValue('OS-ORC-000001');
    /** `null` = outra transação ocupou `operationId` primeiro. */
    repository.convert.mockResolvedValue(null);

    const result = await service.convert('quote-id', 'org-id', 'user-id', {});
    expect(result).toBeDefined();
    expect(repository.find).toHaveBeenCalledTimes(2);
  });

  /* ---------------------------------------------------------------- */
  /* Consulta                                                          */
  /* ---------------------------------------------------------------- */

  it('recusa período invertido', async () => {
    await expect(
      service.list('org-id', {
        from: new Date('2026-08-31'),
        to: new Date('2026-08-01'),
        page: 1,
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });
});
