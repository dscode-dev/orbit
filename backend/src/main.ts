import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import { AppModule } from './app.module';
import { configureApiVersioning } from './configure-api';
import { validateReleaseEnvironment } from './release-environment';

async function bootstrap() {
  validateReleaseEnvironment(process.env);
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

  /**
   * O corpo grande é permitido **só** onde ele existe.
   *
   * O padrão do Express é 100 KB, e a logo de uma unidade chega como data URI
   * — passa disso com facilidade e o cliente recebia 413 sem explicação. Subir
   * o limite global para acomodá-la abriria todas as rotas de escrita a
   * corpos de megabytes, que é convite a esgotar memória de graça.
   *
   * Aqui o limite maior vale para o caminho da marca e mais nada. O tamanho
   * real da imagem continua sendo checado depois, por
   * `readEmbeddedImage` — este limite é a primeira barreira, não a única.
   */
  app.use(/\/business-units\/[^/]+\/logo$/, json({ limit: '1mb' }));

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
