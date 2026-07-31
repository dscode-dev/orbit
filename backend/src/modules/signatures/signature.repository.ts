import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RlsTransaction } from '../../database';

const signatureSelect = {
  id: true,
  organizationId: true,
  reportId: true,
  slotKey: true,
  signerType: true,
  userId: true,
  customerId: true,
  signerName: true,
  signerDocument: true,
  signatureHash: true,
  reportContentHash: true,
  ipAddress: true,
  userAgent: true,
  geolocation: true,
  consentText: true,
  signedAt: true,
  revokedAt: true,
  revocationReason: true,
} satisfies Prisma.SignatureSelect;

@Injectable()
export class SignatureRepository {
  constructor(private readonly rls: RlsTransaction) {}

  findReport(id: string, organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.report.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: {
          id: true,
          status: true,
          customerId: true,
          contentHash: true,
          signatureSlots: true,
        },
      }),
    );
  }

  findUser(id: string) {
    return this.rls.run((transaction) =>
      transaction.user.findFirst({
        where: { id, status: 'ACTIVE', deletedAt: null },
        select: { id: true, displayName: true },
      }),
    );
  }

  findCustomer(id: string, organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.customer.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: { id: true, legalName: true, tradeName: true },
      }),
    );
  }

  list(reportId: string) {
    return this.rls.run((transaction) =>
      transaction.signature.findMany({
        where: { reportId },
        select: signatureSelect,
        orderBy: { signedAt: 'asc' },
      }),
    );
  }

  create(data: Prisma.SignatureUncheckedCreateInput) {
    return this.rls.run((transaction) =>
      transaction.signature.create({ data, select: signatureSelect }),
    );
  }

  find(id: string, reportId: string, organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.signature.findFirst({
        where: { id, reportId, organizationId },
        select: signatureSelect,
      }),
    );
  }

  revoke(id: string, reason: string) {
    return this.rls.run((transaction) =>
      transaction.signature.update({
        where: { id },
        data: { revokedAt: new Date(), revocationReason: reason },
        select: signatureSelect,
      }),
    );
  }
}
