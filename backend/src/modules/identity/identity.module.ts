import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PermissionGuard, RoleGuard } from '../../guards';
import { EnvironmentProvider } from '../../providers';
import { AuthenticationService } from './application/authentication.service';
import { InvitationService } from './application/invitation.service';
import { MfaService } from './application/mfa.service';
import { PasswordRecoveryService } from './application/password-recovery.service';
import { ProfileService } from './application/profile.service';
import { RegistrationService } from './application/registration.service';
import { IdentityTokenService } from './application/token.service';
import { IDENTITY_TOKEN_DELIVERY } from './domain/identity.types';
import { IdentityRepository } from './infrastructure/identity.repository';
import { RegistrationRepository } from './infrastructure/registration.repository';
import { NoopIdentityTokenDelivery } from './infrastructure/identity-token.delivery';
import { JwtAuthenticationGuard } from './infrastructure/jwt-authentication.guard';
import { AuthController } from './presentation/auth.controller';
import { InvitationController } from './presentation/invitation.controller';
import { ProfileController } from './presentation/profile.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [EnvironmentProvider],
      useFactory: (environment: EnvironmentProvider) => ({
        secret:
          process.env.NODE_ENV === 'test'
            ? (environment.getOptional('JWT_ACCESS_SECRET') ??
              'test-only-jwt-secret-at-least-32-bytes')
            : environment.get('JWT_ACCESS_SECRET'),
        signOptions: {
          issuer: environment.getOptional('JWT_ISSUER') ?? 'orbit-api',
          audience: environment.getOptional('JWT_AUDIENCE') ?? 'orbit',
        },
        verifyOptions: {
          issuer: environment.getOptional('JWT_ISSUER') ?? 'orbit-api',
          audience: environment.getOptional('JWT_AUDIENCE') ?? 'orbit',
        },
      }),
    }),
  ],
  controllers: [AuthController, ProfileController, InvitationController],
  providers: [
    IdentityRepository,
    RegistrationRepository,
    IdentityTokenService,
    AuthenticationService,
    PasswordRecoveryService,
    InvitationService,
    ProfileService,
    MfaService,
    RegistrationService,
    NoopIdentityTokenDelivery,
    {
      provide: IDENTITY_TOKEN_DELIVERY,
      useExisting: NoopIdentityTokenDelivery,
    },
    { provide: APP_GUARD, useClass: JwtAuthenticationGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
  ],
  exports: [IdentityTokenService],
})
export class IdentityModule {}
