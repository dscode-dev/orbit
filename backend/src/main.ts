import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApiVersioning } from './configure-api';

async function bootstrap() {
  /**
   * `rawBody` guarda os bytes originais além do JSON já interpretado.
   *
   * O webhook de cobrança precisa verificar a assinatura sobre exatamente os
   * bytes recebidos: reserializar o JSON muda espaços, ordem de chaves e
   * escapes, e a assinatura deixaria de bater para eventos legítimos. Todas as
   * outras rotas continuam recebendo o corpo interpretado como sempre — este
   * ajuste **acrescenta** o buffer, não substitui o parser.
   */
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureApiVersioning(app);
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(
    Number(process.env.PORT ?? 3001),
    process.env.HOST ?? '0.0.0.0',
  );
}
void bootstrap();
