import { ReportStatus } from '../../contracts';
import { ConflictException, ValidationException } from '../../exceptions';
import type { SignatureRepository } from './signature.repository';
import { SignatureService } from './signature.service';

describe('SignatureService', () => {
  const repository = {
    findReport: jest.fn(),
    findUser: jest.fn(),
    create: jest.fn(),
  };
  const service = new SignatureService(
    repository as unknown as SignatureRepository,
  );

  beforeEach(() => jest.clearAllMocks());

  it('only signs approved reports', async () => {
    repository.findReport.mockResolvedValue({
      id: 'report-id',
      status: ReportStatus.DRAFT,
      signatureSlots: [],
    });
    await expect(
      service.sign(
        'report-id',
        'organization-id',
        'actor-id',
        {
          slotKey: 'technician',
          signerType: 'USER',
          signerName: 'Technician',
          signatureData: Buffer.from('signature-evidence').toString('base64'),
          consentAccepted: true,
          consentText: 'Concordo com a assinatura deste documento.',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires explicit signature consent', async () => {
    repository.findReport.mockResolvedValue({
      id: 'report-id',
      status: ReportStatus.APPROVED,
      contentHash: 'a'.repeat(64),
      signatureSlots: [
        {
          key: 'technician',
          label: 'Técnico',
          signerType: 'USER',
          required: true,
          order: 0,
        },
      ],
    });
    await expect(
      service.sign(
        'report-id',
        'organization-id',
        'actor-id',
        {
          slotKey: 'technician',
          signerType: 'USER',
          signerName: 'Technician',
          signatureData: Buffer.from('signature-evidence').toString('base64'),
          consentAccepted: false,
          consentText: 'Concordo com a assinatura deste documento.',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ValidationException);
  });
});
