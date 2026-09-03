import { Injectable } from '@nestjs/common';
import type {
  CustomerPortalInvitation,
  CustomerPortalIdentity,
} from '@prisma/client';
import type { PortalSessionRecord } from './customer-portal.types';
import type {
  CustomerPortalInvitationReadModel,
  CustomerPortalMeReadModel,
} from './customer-portal.read-models';

@Injectable()
export class CustomerPortalMapper {
  me(record: PortalSessionRecord): CustomerPortalMeReadModel {
    return {
      actorType: 'CUSTOMER_PORTAL',
      identity: {
        id: record.id,
        displayName: record.displayName,
        email: record.email,
        status: record.status.toLocaleLowerCase('en-US'),
        contactId: record.contactId,
      },
      organization: {
        id: record.organizationId,
        slug: record.organizationSlug,
        displayName: record.organizationName,
      },
      customer: {
        id: record.customerId,
        displayName: record.customerName,
      },
      sessionId: record.sessionId,
    };
  }

  invitation(
    invitation: CustomerPortalInvitation & {
      identity: CustomerPortalIdentity;
    },
  ): CustomerPortalInvitationReadModel {
    return {
      id: invitation.id,
      identityId: invitation.portalIdentityId,
      customerId: invitation.customerId,
      displayName: invitation.identity.displayName,
      email: invitation.identity.email,
      expiresAt: invitation.expiresAt.toISOString(),
      status: 'invited',
    };
  }
}

