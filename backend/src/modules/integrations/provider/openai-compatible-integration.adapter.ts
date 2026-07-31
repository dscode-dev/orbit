import { Injectable } from '@nestjs/common';
import type { JSONObject } from '../../../contracts';
import { ValidationException } from '../../../exceptions';
import type { IntegrationAdapter } from './integration-provider';

@Injectable()
export class OpenAiCompatibleIntegrationAdapter implements IntegrationAdapter {
  readonly provider = 'OPENAI_COMPATIBLE';

  validate(configuration: JSONObject, secrets: JSONObject | null) {
    const baseUrl = configuration.baseUrl;
    if (typeof baseUrl !== 'string')
      throw new ValidationException('AI integration baseUrl is required');
    let parsed: URL;
    try {
      parsed = new URL(baseUrl);
    } catch {
      throw new ValidationException(
        'AI integration baseUrl must be a valid URL',
      );
    }
    const local =
      parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (
      parsed.protocol !== 'https:' &&
      !(process.env.NODE_ENV !== 'production' && local)
    )
      throw new ValidationException('AI integration baseUrl must use HTTPS');
    if (typeof secrets?.apiKey !== 'string' || secrets.apiKey.length < 8)
      throw new ValidationException('AI integration apiKey is required');
    return Promise.resolve();
  }
}
