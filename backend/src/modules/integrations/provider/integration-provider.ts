import { Inject, Injectable } from '@nestjs/common';
import type { JSONObject } from '../../../contracts';
import { ValidationException } from '../../../exceptions';

export interface IntegrationAdapter {
  readonly provider: string;
  validate(
    configuration: JSONObject,
    secrets: JSONObject | null,
  ): Promise<void>;
}

export const INTEGRATION_ADAPTERS = Symbol('INTEGRATION_ADAPTERS');

@Injectable()
export class IntegrationProviderRegistry {
  private readonly adapters: ReadonlyMap<string, IntegrationAdapter>;

  constructor(
    @Inject(INTEGRATION_ADAPTERS)
    adapters: readonly IntegrationAdapter[],
  ) {
    this.adapters = new Map(
      adapters.map((adapter) => [adapter.provider, adapter]),
    );
  }

  get(provider: string): IntegrationAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new ValidationException(
        `Integration provider ${provider} has no configured adapter`,
      );
    }
    return adapter;
  }
}
