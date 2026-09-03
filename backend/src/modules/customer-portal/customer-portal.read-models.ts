import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomerPortalOrganizationReadModel {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() displayName!: string;
}

export class CustomerPortalCustomerReadModel {
  @ApiProperty() id!: string;
  @ApiProperty() displayName!: string;
}

export class CustomerPortalIdentityReadModel {
  @ApiProperty() id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: ['invited', 'active', 'disabled'] }) status!: string;
  @ApiPropertyOptional({ nullable: true }) contactId!: string | null;
}

export class CustomerPortalMeReadModel {
  @ApiProperty({ enum: ['CUSTOMER_PORTAL'] })
  actorType!: 'CUSTOMER_PORTAL';
  @ApiProperty({ type: CustomerPortalIdentityReadModel })
  identity!: CustomerPortalIdentityReadModel;
  @ApiProperty({ type: CustomerPortalOrganizationReadModel })
  organization!: CustomerPortalOrganizationReadModel;
  @ApiProperty({ type: CustomerPortalCustomerReadModel })
  customer!: CustomerPortalCustomerReadModel;
  @ApiProperty() sessionId!: string;
}

export class CustomerPortalSessionReadModel {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ example: 'Bearer' }) tokenType!: 'Bearer';
  @ApiProperty({ example: 900 }) expiresIn!: number;
  @ApiProperty({ type: CustomerPortalMeReadModel }) me!: CustomerPortalMeReadModel;
}

export class CustomerPortalInvitationReadModel {
  @ApiProperty() id!: string;
  @ApiProperty() identityId!: string;
  @ApiProperty() customerId!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() email!: string;
  @ApiProperty() expiresAt!: string;
  @ApiProperty({ enum: ['invited'] }) status!: 'invited';
}

export class PortalMessageReadModel {
  @ApiProperty() message!: string;
}

