import { AssetCategory, AssetIdentifierType } from '../../../../contracts';
import { ValidationException } from '../../../../exceptions';
import type { AssetRepository } from './asset.repository';
import { AssetService } from './asset.service';

describe('AssetService', () => {
  const repository = {
    findBusinessUnit: jest.fn(),
    findCustomer: jest.fn(),
    create: jest.fn(),
    findByIdentifier: jest.fn(),
  };
  const service = new AssetService(repository as unknown as AssetRepository);

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findBusinessUnit.mockResolvedValue({ id: 'unit-id' });
  });

  it('requires identifier type and value together', async () => {
    await expect(
      service.create('organization-id', {
        businessUnitId: 'unit-id',
        category: AssetCategory.EQUIPMENT,
        name: 'Compressor',
        identifierType: AssetIdentifierType.QR_CODE,
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('rejects a warranty ending before installation', async () => {
    await expect(
      service.create('organization-id', {
        businessUnitId: 'unit-id',
        category: AssetCategory.EQUIPMENT,
        name: 'Compressor',
        installationAt: new Date('2026-02-01'),
        warrantyUntil: new Date('2026-01-01'),
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('resolves a scanned identifier inside the tenant context', async () => {
    repository.findByIdentifier.mockResolvedValue({ id: 'asset-id' });
    await expect(
      service.resolve(' NFC-0001 ', 'organization-id'),
    ).resolves.toEqual({ id: 'asset-id' });
    expect(repository.findByIdentifier).toHaveBeenCalledWith(
      'NFC-0001',
      'organization-id',
    );
  });
});
