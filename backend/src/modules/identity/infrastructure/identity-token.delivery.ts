import { Injectable } from '@nestjs/common';
import type {
  IdentityTokenPurpose,
  IIdentityTokenDelivery,
} from '../domain/identity.types';

/**
 * Safe default until an email provider is connected. It deliberately does not
 * log or expose secrets. Production deployments should replace this provider.
 */
@Injectable()
export class NoopIdentityTokenDelivery implements IIdentityTokenDelivery {
  deliver(
    purpose: IdentityTokenPurpose,
    recipient: string,
    token: string,
  ): Promise<void> {
    void purpose;
    void recipient;
    void token;
    return Promise.resolve();
  }
}
