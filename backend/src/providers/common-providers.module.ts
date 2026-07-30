import { Global, Module } from '@nestjs/common';
import {
  ClockProvider,
  CryptoProvider,
  EnvironmentProvider,
  HashProvider,
  UuidProvider,
} from './common.providers';
import {
  CLOCK,
  CRYPTO_PROVIDER,
  ENVIRONMENT_PROVIDER,
  HASH_PROVIDER,
  UUID_PROVIDER,
} from './tokens';

@Global()
@Module({
  providers: [
    ClockProvider,
    UuidProvider,
    HashProvider,
    EnvironmentProvider,
    CryptoProvider,
    { provide: CLOCK, useExisting: ClockProvider },
    { provide: UUID_PROVIDER, useExisting: UuidProvider },
    { provide: HASH_PROVIDER, useExisting: HashProvider },
    { provide: CRYPTO_PROVIDER, useExisting: CryptoProvider },
    { provide: ENVIRONMENT_PROVIDER, useExisting: EnvironmentProvider },
  ],
  exports: [
    CLOCK,
    UUID_PROVIDER,
    HASH_PROVIDER,
    CRYPTO_PROVIDER,
    ENVIRONMENT_PROVIDER,
    ClockProvider,
    UuidProvider,
    HashProvider,
    EnvironmentProvider,
    CryptoProvider,
  ],
})
export class CommonProvidersModule {}
