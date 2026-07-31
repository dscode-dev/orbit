import { ReportStatus } from '../../contracts';
import { ValidationException } from '../../exceptions';
import type { DocumentStorageService } from '../document-engine/document-storage.service';
import type { PdfRendererService } from '../document-engine/pdf-renderer.service';
import type { ReportRepository } from './report.repository';
import { ReportService } from './report.service';

describe('ReportService', () => {
  const repository = {
    findTemplate: jest.fn(),
    findBusinessUnit: jest.fn(),
    findCustomer: jest.fn(),
    findOperation: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
  };
  const renderer = { render: jest.fn() };
  const storage = { store: jest.fn(), read: jest.fn(), remove: jest.fn() };
  const service = new ReportService(
    repository as unknown as ReportRepository,
    renderer as unknown as PdfRendererService,
    storage as unknown as DocumentStorageService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findBusinessUnit.mockResolvedValue({ id: 'unit-id' });
  });

  it('snapshots the template and calculates a source content hash', async () => {
    repository.findTemplate.mockResolvedValue({
      id: 'template-id',
      version: 3,
      sections: [{ key: 'summary', type: 'TEXT' }],
      signatureSlots: [],
      settings: { pageSize: 'A4' },
    });
    repository.create.mockImplementation((input: Record<string, unknown>) =>
      Promise.resolve({
        ...input,
        id: 'report-id',
        documents: [],
        signatures: [],
      }),
    );
    const report = await service.create('organization-id', 'actor-id', {
      businessUnitId: 'unit-id',
      templateId: 'template-id',
      code: ' rt-001 ',
      title: 'Relatório técnico',
      data: { pressure: 10 },
    });
    expect(report.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'RT-001',
        templateVersion: 3,
        renderSettings: { pageSize: 'A4' },
      }),
    );
  });

  it('blocks finalization while required signatures are pending', async () => {
    repository.find.mockResolvedValue({
      id: 'report-id',
      status: ReportStatus.APPROVED,
      contentHash: 'a'.repeat(64),
      signatureSlots: [
        {
          key: 'customer',
          label: 'Cliente',
          signerType: 'CUSTOMER',
          required: true,
          order: 0,
        },
      ],
      signatures: [],
    });
    await expect(
      service.finalize('report-id', 'organization-id'),
    ).rejects.toBeInstanceOf(ValidationException);
  });
});
