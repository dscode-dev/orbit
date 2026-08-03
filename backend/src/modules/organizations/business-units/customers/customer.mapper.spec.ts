import { CustomerReadModelMapper } from './customer.mapper';

/**
 * O teste que dá razão a este mapper: nenhum campo de persistência atravessa o
 * contrato público. `deletedAt` é verificado explicitamente porque foi o
 * vazamento que motivou a correção — e `_count` porque é a mesma classe de
 * problema, um nome do ORM aparecendo na API.
 */
describe('CustomerReadModelMapper', () => {
  const mapper = new CustomerReadModelMapper();
  const createdAt = new Date('2026-08-01T12:00:00.000Z');

  const source = {
    id: 'customer-1',
    organizationId: 'org-1',
    type: 'COMPANY',
    legalName: 'Condomínio Aurora LTDA',
    tradeName: 'Condomínio Aurora',
    documentType: 'CNPJ',
    documentNumber: '11222333000181',
    email: 'sindico@aurora.com.br',
    phone: '81999990000',
    notes: 'Contrato PMOC anual',
    address: { city: 'Recife' },
    status: 'ACTIVE',
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    contacts: [
      {
        id: 'contact-1',
        organizationId: 'org-1',
        businessUnitId: null,
        customerId: 'customer-1',
        name: 'Marina Duarte',
        role: 'Síndica',
        email: 'marina@aurora.com.br',
        phone: '81988887777',
        isPrimary: true,
        createdAt,
        updatedAt: createdAt,
        deletedAt: null,
      },
    ],
    _count: { assets: 3, operations: 7 },
  };

  it('não expõe deletedAt no cliente nem nos contatos', () => {
    const result = mapper.details(source);

    expect(result).not.toHaveProperty('deletedAt');
    expect(result.contacts[0]).not.toHaveProperty('deletedAt');
  });

  it('não expõe o _count do Prisma; publica counts', () => {
    const result = mapper.details(source);

    expect(result).not.toHaveProperty('_count');
    expect(result.counts).toEqual({ assets: 3, operations: 7 });
  });

  it('preserva o registro removido sem publicar a marca', () => {
    const removed = { ...source, deletedAt: createdAt, status: 'INACTIVE' };

    const result = mapper.details(removed);

    /** A exclusão lógica continua no banco; o contrato só não a publica. */
    expect(result).not.toHaveProperty('deletedAt');
    expect(result.status).toBe('INACTIVE');
  });

  it('serializa datas em ISO', () => {
    const result = mapper.details(source);

    expect(result.createdAt).toBe('2026-08-01T12:00:00.000Z');
    expect(result.contacts[0]?.createdAt).toBe('2026-08-01T12:00:00.000Z');
  });

  it('tolera ausência de contatos e de contagens', () => {
    const partial = {
      ...source,
      contacts: undefined,
      _count: undefined,
    };

    const result = mapper.details(partial);

    expect(result.contacts).toEqual([]);
    expect(result.counts).toEqual({ assets: 0, operations: 0 });
  });

  it('mapeia a listagem preservando a paginação', () => {
    const result = mapper.list({
      data: [source],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).not.toHaveProperty('deletedAt');
    expect(result.meta.total).toBe(1);
  });

  it('não expõe deletedAt ao mapear um contato isolado', () => {
    const result = mapper.contact(source.contacts[0]!);

    expect(result).not.toHaveProperty('deletedAt');
    expect(result.name).toBe('Marina Duarte');
  });
});
