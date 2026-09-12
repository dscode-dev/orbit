/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import {
  ConflictException,
  ForbiddenException,
  ValidationException,
} from '../../exceptions';
import { createHash } from 'node:crypto';
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
const storageConfig = {
  signedUrlTtlSeconds: 300,
  localSigningSecret: 'test-signature-preview-secret-at-least-32-bytes',
};

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
      storageConfig as never,
    );
    await expect(service.status(actor)).resolves.toEqual({
      signatureAvailable: false,
      version: null,
      updatedAt: null,
      roles: ['FIELD_TECHNICIAN'],
      preview: null,
    });
  });

  it('signs only the authenticated actor active signature for preview', async () => {
    const storageObject = {
      bucket: 'private-bucket',
      objectKey: 'org/signatures/private-object.png',
      fileName: 'signature.png',
      mimeType: 'image/png',
      sizeBytes: BigInt(png.length),
      sha256: createHash('sha256').update(png).digest('hex'),
      status: 'AVAILABLE',
    };
    const repository = {
      context: jest.fn().mockResolvedValue({
        membership: { id: 'm' },
        profile,
        signature: {
          id: 'signature-a',
          version: 3,
          updatedAt: new Date('2026-09-08T10:00:00Z'),
          sha256: storageObject.sha256,
          storageObject,
        },
      }),
    };
    const files = { read: jest.fn().mockResolvedValue(png) };
    const service = new MobileSignatureService(
      repository as never,
      files as never,
      storageConfig as never,
    );

    const result = await service.status(actor);

    expect(repository.context).toHaveBeenCalledWith(
      actor.organizationId,
      actor.id,
    );
    expect(result.preview).toMatchObject({
      mimeType: 'image/png',
      sizeBytes: String(png.length),
      sha256: storageObject.sha256,
    });
    expect(JSON.stringify(result)).not.toContain(storageObject.bucket);
    expect(JSON.stringify(result)).not.toContain(storageObject.objectKey);

    const grant = new URL(result.preview!.url, 'http://orbit.local');
    await expect(
      service.previewBytes(actor, {
        expires: Number(grant.searchParams.get('expires')),
        signature: grant.searchParams.get('signature')!,
      }),
    ).resolves.toEqual({ body: png, mimeType: 'image/png' });
    expect(files.read).toHaveBeenCalledWith(
      storageObject.bucket,
      storageObject.objectKey,
    );
    await expect(
      service.previewBytes(
        { ...actor, id: '01900000-0000-7000-8000-000000000099' },
        {
          expires: Number(grant.searchParams.get('expires')),
          signature: grant.searchParams.get('signature')!,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.previewBytes(actor, {
        expires: 0,
        signature: grant.searchParams.get('signature')!,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
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
      storageConfig as never,
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
      storageConfig as never,
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
      storageConfig as never,
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
      storageConfig as never,
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
