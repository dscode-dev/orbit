import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ParseUUIDv7Pipe } from '../../../pipes';
import { AuthenticationService } from '../application/authentication.service';
import { MfaService } from '../application/mfa.service';
import { ProfileService } from '../application/profile.service';
import type { IdentityRequest } from '../infrastructure/jwt-authentication.guard';
import { EnableMfaDto, UpdateProfileDto } from './dto/identity.dto';

@ApiTags('Identity Profile')
@Controller('identity/me')
export class ProfileController {
  constructor(
    private readonly profiles: ProfileService,
    private readonly authentication: AuthenticationService,
    private readonly mfa: MfaService,
  ) {}

  @Get()
  get(@Req() request: IdentityRequest) {
    return this.profiles.get(request.identity!.id);
  }

  @Patch()
  update(@Req() request: IdentityRequest, @Body() input: UpdateProfileDto) {
    return this.profiles.update(request.identity!.id, input);
  }

  @Get('sessions')
  sessions(@Req() request: IdentityRequest) {
    return this.authentication.listSessions(request.identity!.id);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeSession(
    @Req() request: IdentityRequest,
    @Param('id', ParseUUIDv7Pipe) sessionId: string,
  ) {
    return this.authentication.revokeSession(request.identity!.id, sessionId);
  }

  @Post('mfa/enrollment')
  beginMfa(@Req() request: IdentityRequest) {
    return this.profiles
      .get(request.identity!.id)
      .then((profile) =>
        this.mfa.beginEnrollment(request.identity!.id, profile.email),
      );
  }

  @Post('mfa/enable')
  enableMfa(@Req() request: IdentityRequest, @Body() input: EnableMfaDto) {
    return this.mfa.enable(request.identity!.id, input.factorId, input.code);
  }

  @Delete('mfa')
  @HttpCode(HttpStatus.NO_CONTENT)
  disableMfa(@Req() request: IdentityRequest) {
    return this.mfa.disable(request.identity!.id);
  }
}
