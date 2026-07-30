import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../../decorators';
import { AuthenticationService } from '../application/authentication.service';
import { PasswordRecoveryService } from '../application/password-recovery.service';
import { RegistrationService } from '../application/registration.service';
import type { IdentityRequest } from '../infrastructure/jwt-authentication.guard';
import {
  ForgotPasswordDto,
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterOrganizationDto,
  ResetPasswordDto,
} from './dto/identity.dto';

@ApiTags('Identity')
@Controller('identity')
export class AuthController {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly recovery: PasswordRecoveryService,
    private readonly registration: RegistrationService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(
    @Body() input: RegisterOrganizationDto,
    @Req() request: IdentityRequest,
  ) {
    return this.registration.register(input, {
      client: input.client,
      deviceId: input.deviceId,
      userAgent: request.header('user-agent'),
      ipAddress: request.ip,
    });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() input: LoginDto, @Req() request: IdentityRequest) {
    return this.authentication.login(
      input.email,
      input.password,
      input.mfaCode,
      {
        client: input.client,
        deviceId: input.deviceId,
        userAgent: request.header('user-agent'),
        ipAddress: request.ip,
      },
    );
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() input: RefreshTokenDto) {
    return this.authentication.refresh(input.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() input: LogoutDto, @Req() request: IdentityRequest) {
    return this.authentication.logout(
      request.identity?.sessionId,
      input.refreshToken,
    );
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Body() input: ForgotPasswordDto) {
    await this.recovery.request(input.email);
    return {
      message: 'If the account exists, recovery instructions were sent',
    };
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@Body() input: ResetPasswordDto) {
    return this.recovery.reset(input.token, input.password);
  }
}
