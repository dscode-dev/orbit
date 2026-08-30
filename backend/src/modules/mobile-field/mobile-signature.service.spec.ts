/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import {
  ConflictException,
  ForbiddenException,
  ValidationException,
} from '../../exceptions';
import { MobileSignatureService } from './mobile-signature.service';

const actor = {
  id: '01900000-0000-7000-8000-000000000001',
  organizationId: '01900000-0000-7000-8000-000000000002',
  businessUnitIds: ['01900000-0000-7000-8000-000000000003'],
  permissions: ['operations.read'],
};
const profile = {
  active: true,
  fieldTechnicianEnabled: true,
  technicalResponsibleEnabled: false,
};
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  Buffer.from('signature'),
]);

describe('MobileSignatureService', () => {
  it('reports first-use status without exposing the asset', async () => {
    const repository = {
      context: jest.fn().mockResolvedValue({
        membership: { id: 'm' },
        profile,
        signature: null,
      }),
    };
    const service = new MobileSignatureService(
      repository as never,
      {} as never,
    );
    await expect(service.status(actor)).resolves.toEqual({
      signatureAvailable: false,
      version: null,
      updatedAt: null,
      roles: ['FIELD_TECHNICIAN'],
    });
  });

  it('rejects a spoofed image MIME', async () => {
    const repository = {
      context: jest.fn().mockResolvedValue({
        membership: { id: 'm' },
        profile,
        signature: null,
      }),
      signatureUploadFile: jest.fn().mockResolvedValue({
        id: 'f',
        createdById: actor.id,
      }),
      storageFile: jest.fn().mockResolvedValue({
        id: 'f',
        createdById: actor.id,
        sha256: 'a'.repeat(64),
        sizeBytes: 20n,
        mimeType: 'image/jpeg',
        bucket: 'b',
        objectKey: 'k',
      }),
    };
    const service = new MobileSignatureService(
      repository as never,
      {
        confirm: jest.fn().mockResolvedValue({}),
        read: jest.fn().mockResolvedValue(png),
      } as never,
    );
    await expect(
      service.upload(actor, { storageObjectId: 'f' }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('never permits an inactive/non-professional user to enroll', async () => {
    const repository = {
      context: jest.fn().mockResolvedValue({
        membership: { id: 'm' },
        profile: { ...profile, fieldTechnicianEnabled: false },
        signature: null,
      }),
    };
    const service = new MobileSignatureService(
      repository as never,
      {} as never,
    );
    await expect(service.status(actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('detects stale acknowledgement before persisting', async () => {
    const operation = operationSource();
    const repository = { operation: jest.fn().mockResolvedValue(operation) };
    const service = new MobileSignatureService(
      repository as never,
      {} as never,
    );
    await expect(
      service.acknowledge(actor, operation.id, {
        signerName: 'Cliente Local',
        expectedVersion: 'stale',
        contentHash: '0'.repeat(64),
        commandId: 'command-123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect((repository as any).capture).toBeUndefined();
  });

  it('uses the actual executor, not an auxiliary, as acknowledgement collector', async () => {
    const operation = operationSource();
    operation.startedByUserId = '01900000-0000-7000-8000-000000000099';
    operation.auxiliaryTechnicians = [{ userId: actor.id }];
    const repository = { operation: jest.fn().mockResolvedValue(operation) };
    const service = new MobileSignatureService(
      repository as never,
      {} as never,
    );
    await expect(
      service.acknowledgementPreparation(actor, operation.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

function operationSource(): any {
  return {
    id: '01900000-0000-7000-8000-000000000004',
    organizationId: actor.organizationId,
    businessUnitId: actor.businessUnitIds[0],
    customerId: null,
    title: 'Manutenção',
    description: null,
    startedAt: new Date('2026-08-28T10:00:00Z'),
    completedAt: null,
    updatedAt: new Date('2026-08-28T10:05:00Z'),
    responsibleFieldTechnicianId: actor.id,
    startedByUserId: actor.id,
    completedByUserId: null,
    customer: null,
    asset: null,
    auxiliaryTechnicians: [],
  };
}
