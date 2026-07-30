import { CustomerType } from '../../../../contracts';
import { ValidationException } from '../../../../exceptions';
import type { CustomerRepository } from './customer.repository';
import { CustomerService } from './customer.service';

describe('CustomerService', () => {
  const repository = {
    create: jest.fn(),
    find: jest.fn(),
    createContact: jest.fn(),
    findBusinessUnit: jest.fn(),
  };
  const service = new CustomerService(
    repository as unknown as CustomerRepository,
  );

  beforeEach(() => jest.clearAllMocks());

  it('normalizes document and email before persistence', async () => {
    repository.create.mockResolvedValue({ id: 'customer-id' });
    await service.create('organization-id', {
      type: CustomerType.COMPANY,
      legalName: 'Orbit Cliente Ltda',
      documentType: 'CNPJ',
      documentNumber: '11.222.333/0001-81',
      email: 'CLIENTE@ORBIT.COM',
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        documentNumber: '11222333000181',
        email: 'cliente@orbit.com',
      }),
    );
  });

  it('requires document type and value together', async () => {
    await expect(
      service.create('organization-id', {
        type: CustomerType.COMPANY,
        legalName: 'Orbit Cliente Ltda',
        documentType: 'CNPJ',
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('creates a contact only for an existing customer', async () => {
    repository.find.mockResolvedValue({ id: 'customer-id' });
    repository.createContact.mockResolvedValue({ id: 'contact-id' });
    await service.createContact('customer-id', 'organization-id', {
      name: 'Marina',
      isPrimary: true,
    });
    expect(repository.createContact).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'organization-id',
        customerId: 'customer-id',
        isPrimary: true,
      }),
    );
  });
});
