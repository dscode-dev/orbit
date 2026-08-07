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
import { IdentityReadModelMapper } from '../identity.mapper';
import {
  ChangePasswordDto,
  EnableMfaDto,
  UpdateProfileDto,
} from './dto/identity.dto';

@ApiTags('Identity Profile')
@Controller('identity/me')
export class ProfileController {
  constructor(
    private readonly profiles: ProfileService,
    private readonly authentication: AuthenticationService,
    private readonly mfa: MfaService,
    private readonly readModels: IdentityReadModelMapper,
  ) {}

  @Get()
  async get(@Req() request: IdentityRequest) {
    return this.readModels.profile(
      await this.profiles.get(request.identity!.id),
    );
  }

  @Patch()
  async update(
    @Req() request: IdentityRequest,
    @Body() input: UpdateProfileDto,
  ) {
    return this.readModels.profile(
      await this.profiles.update(request.identity!.id, input),
    );
  }

  /**
   * Troca da própria senha.
   *
   * Revoga as demais sessões e mantém a atual — se a senha mudou, quem estava
   * com a antiga não deve continuar dentro, mas quem acabou de trocá-la não
   * deve ser expulso da tela.
   */
  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @Req() request: IdentityRequest,
    @Body() input: ChangePasswordDto,
  ) {
    return this.profiles.changePassword(
      request.identity!.id,
      input,
      request.identity!.sessionId,
    );
  }

  @Get('sessions')
  async sessions(@Req() request: IdentityRequest) {
    return (await this.authentication.listSessions(request.identity!.id)).map(
      (session) => this.readModels.deviceSession(session),
    );
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
