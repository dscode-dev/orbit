import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReportStatus } from '../../contracts';
import {
  ConflictException,
  EntityNotFoundException,
  ValidationException,
} from '../../exceptions';
import { documentHash } from '../document-engine/canonical-document';
import type { SignatureSlot } from '../document-engine/document-engine.types';
import type { CreateSignatureDto } from './signature.dto';
import { SignatureRepository } from './signature.repository';

export interface SignatureMetadata {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class SignatureService {
  constructor(private readonly repository: SignatureRepository) {}

  async list(reportId: string, organizationId: string) {
    const report = await this.report(reportId, organizationId);
    const signatures = await this.repository.list(reportId);
    const bySlot = new Map(
      signatures
        .filter((signature) => !signature.revokedAt)
        .map((signature) => [signature.slotKey, signature]),
    );
    return (report.signatureSlots as unknown as SignatureSlot[])
      .sort((left, right) => left.order - right.order)
      .map((slot) => ({
        ...slot,
        status: bySlot.has(slot.key) ? 'SIGNED' : 'PENDING',
        signature: bySlot.get(slot.key) ?? null,
      }));
  }

  async sign(
    reportId: string,
    organizationId: string,
    actorId: string,
    input: CreateSignatureDto,
    metadata: SignatureMetadata,
  ) {
    const report = await this.report(reportId, organizationId);
    if (report.status !== ReportStatus.APPROVED) {
      throw new ConflictException('Only approved reports can be signed');
    }
    if (!input.consentAccepted) {
      throw new ValidationException('Signature consent is required');
    }
    const slots = report.signatureSlots as unknown as SignatureSlot[];
    const slot = slots.find((item) => item.key === input.slotKey);
    if (!slot) throw new ValidationException('Invalid signature slot');
    if (slot.signerType !== input.signerType) {
      throw new ValidationException('Signer type does not match the slot');
    }
    const evidence = this.decode(input.signatureData);
    const signedAt = new Date();
    let userId: string | undefined;
    let customerId: string | undefined;
    let signerName = input.signerName;

    if (input.signerType === 'USER') {
      const user = await this.repository.findUser(actorId);
      if (!user) throw new ValidationException('Invalid signer user');
      userId = actorId;
      signerName = user.displayName;
    } else if (input.signerType === 'CUSTOMER') {
      customerId = input.customerId ?? report.customerId ?? undefined;
      if (!customerId || customerId !== report.customerId) {
        throw new ValidationException(
          'Signer customer does not match the report customer',
        );
      }
      const customer = await this.repository.findCustomer(
        customerId,
        organizationId,
      );
      if (!customer) throw new ValidationException('Invalid signer customer');
    }

    const signatureHash = documentHash({
      reportId,
      reportContentHash: report.contentHash,
      slotKey: slot.key,
      signerType: input.signerType,
      signerName,
      signerDocument: input.signerDocument ?? null,
      evidence: evidence.toString('base64'),
      consentText: input.consentText,
      signedAt,
    });
    try {
      return await this.repository.create({
        organizationId,
        reportId,
        slotKey: slot.key,
        signerType: input.signerType,
        userId,
        customerId,
        signerName,
        signerDocument: input.signerDocument,
        signatureData: Uint8Array.from(evidence),
        signatureHash,
        reportContentHash: report.contentHash,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        geolocation: input.geolocation as Prisma.InputJsonValue | undefined,
        consentText: input.consentText,
        signedAt,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Signature slot is already signed');
      }
      throw error;
    }
  }

  async revoke(
    id: string,
    reportId: string,
    organizationId: string,
    reason: string,
  ) {
    const report = await this.report(reportId, organizationId);
    if (report.status === ReportStatus.PUBLISHED) {
      throw new ConflictException('Published report signatures are immutable');
    }
    const signature = await this.repository.find(id, reportId, organizationId);
    if (!signature || signature.revokedAt) {
      throw new EntityNotFoundException('Signature', id);
    }
    return this.repository.revoke(id, reason);
  }

  private report(id: string, organizationId: string) {
    return this.repository.findReport(id, organizationId).then((report) => {
      if (!report) throw new EntityNotFoundException('Report', id);
      return report;
    });
  }

  private decode(value: string): Buffer {
    const normalized = value.replace(/^data:[^;]+;base64,/, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
      throw new ValidationException('Invalid base64 signature data');
    }
    const evidence = Buffer.from(normalized, 'base64');
    if (evidence.length === 0 || evidence.length > 1_000_000) {
      throw new ValidationException(
        'Signature evidence must be between 1 byte and 1 MiB',
      );
    }
    return evidence;
  }
}
