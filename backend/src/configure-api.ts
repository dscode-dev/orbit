import {
  VERSION_NEUTRAL,
  VersioningType,
  type INestApplication,
} from '@nestjs/common';

/** Configuração pública compartilhada pelo bootstrap e pelos testes HTTP. */
export function configureApiVersioning(app: INestApplication): void {
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'api/v',
    defaultVersion: [VERSION_NEUTRAL, '1'],
  });
}
