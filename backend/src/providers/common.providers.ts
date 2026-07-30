import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCMTypes,
} from 'node:crypto';
import type {
  IClock,
  ICryptoProvider,
  IEnvironmentProvider,
  IHashProvider,
  IUuidProvider,
  UUID,
} from '../contracts';
import { InfrastructureException } from '../exceptions';
import { generateUuidV7 } from '../utils';

@Injectable()
export class ClockProvider implements IClock {
  now(): Date {
    return new Date();
  }
}

@Injectable()
export class UuidProvider implements IUuidProvider {
  generate(): UUID {
    return generateUuidV7();
  }
}

@Injectable()
export class HashProvider implements IHashProvider {
  hash(value: string): Promise<string> {
    return argon2.hash(value, { type: argon2.argon2id });
  }

  verify(hash: string, value: string): Promise<boolean> {
    return argon2.verify(hash, value);
  }
}

@Injectable()
export class EnvironmentProvider implements IEnvironmentProvider {
  get(key: string): string {
    const value = process.env[key];
    if (value === undefined) {
      throw new InfrastructureException(
        `Required environment variable ${key} is missing`,
      );
    }
    return value;
  }

  getOptional(key: string): string | undefined {
    return process.env[key];
  }
}

@Injectable()
export class CryptoProvider implements ICryptoProvider {
  private readonly algorithm: CipherGCMTypes = 'aes-256-gcm';

  constructor(private readonly environment: EnvironmentProvider) {}

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.key(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
      'base64url',
    );
  }

  decrypt(value: string): string {
    const payload = Buffer.from(value, 'base64url');
    const decipher = createDecipheriv(
      this.algorithm,
      this.key(),
      payload.subarray(0, 12),
    );
    decipher.setAuthTag(payload.subarray(12, 28));
    return Buffer.concat([
      decipher.update(payload.subarray(28)),
      decipher.final(),
    ]).toString('utf8');
  }

  randomBytes(size: number): Buffer {
    return randomBytes(size);
  }

  private key(): Buffer {
    const key = Buffer.from(this.environment.get('ENCRYPTION_KEY'), 'base64');
    if (key.length !== 32) {
      throw new InfrastructureException(
        'ENCRYPTION_KEY must be a base64-encoded 32-byte key',
      );
    }
    return key;
  }
}
