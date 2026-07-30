import { OperationKind, OperationStatus } from '../../contracts';
import { ValidationException } from '../../exceptions';
import type { OperationRepository } from './operation.repository';
import { OperationService } from './operation.service';
import type { OperationStorageService } from './operation-storage.service';

describe('OperationService', () => {
  const repository = {
    find: jest.fn(),
    findBusinessUnit: jest.fn(),
    findCustomer: jest.fn(),
    findAsset: jest.fn(),
    create: jest.fn(),
    changeStatus: jest.fn(),
    findAssignableUser: jest.fn(),
    assign: jest.fn(),
  };
  const storage = { store: jest.fn(), remove: jest.fn(), read: jest.fn() };
  const service = new OperationService(
    repository as unknown as OperationRepository,
    storage as unknown as OperationStorageService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findBusinessUnit.mockResolvedValue({ id: 'unit-id' });
  });

  it('creates scheduled operations with a normalized code', async () => {
    repository.create.mockResolvedValue({ id: 'operation-id' });
    await service.create('organization-id', 'actor-id', {
      businessUnitId: 'unit-id',
      code: ' os-001 ',
      kind: OperationKind.MAINTENANCE,
      title: 'Manutenção preventiva',
      scheduledStart: new Date('2026-08-01T12:00:00Z'),
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'OS-001',
        status: OperationStatus.SCHEDULED,
      }),
      'actor-id',
      expect.any(Object),
    );
  });

  it('rejects an invalid schedule interval', async () => {
    await expect(
      service.create('organization-id', 'actor-id', {
        businessUnitId: 'unit-id',
        code: 'OS-002',
        kind: OperationKind.MAINTENANCE,
        title: 'Manutenção preventiva',
        scheduledStart: new Date('2026-08-02T12:00:00Z'),
        scheduledEnd: new Date('2026-08-01T12:00:00Z'),
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('enforces the operation status state machine', async () => {
    repository.find.mockResolvedValue({
      id: 'operation-id',
      status: OperationStatus.OPEN,
    });
    await expect(
      service.changeStatus('operation-id', 'organization-id', 'actor-id', {
        status: OperationStatus.COMPLETED,
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('only assigns active members of the operation unit', async () => {
    repository.find.mockResolvedValue({
      id: 'operation-id',
      businessUnitId: 'unit-id',
      status: OperationStatus.OPEN,
    });
    repository.findAssignableUser.mockResolvedValue(null);
    await expect(
      service.assign('operation-id', 'organization-id', 'actor-id', {
        userId: 'user-id',
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });
});
