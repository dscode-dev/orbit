import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permissions, Public } from '../../../decorators';
import { ForbiddenException } from '../../../exceptions';
import { InvitationService } from '../application/invitation.service';
import type { IdentityRequest } from '../infrastructure/jwt-authentication.guard';
import { AcceptInvitationDto, CreateInvitationDto } from './dto/identity.dto';

@ApiTags('Identity Invitations')
@Controller('identity/invitations')
export class InvitationController {
  constructor(private readonly invitations: InvitationService) {}

  @Post()
  @Permissions('identity.invitations.create')
  create(@Body() input: CreateInvitationDto, @Req() request: IdentityRequest) {
    const identity = request.identity!;
    if (!identity.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return this.invitations.create({
      organizationId: identity.organizationId,
      businessUnitId: input.businessUnitId,
      roleId: input.roleId,
      invitedById: identity.id,
      email: input.email,
    });
  }

  @Public()
  @Post('accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  accept(@Body() input: AcceptInvitationDto) {
    return this.invitations.accept(input);
  }
}
