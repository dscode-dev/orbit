import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('x-request-id', /.+/);

    const body = response.body as unknown as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.data).toBe('Hello World!');
    expect(typeof body.requestId).toBe('string');
    expect(typeof body.timestamp).toBe('string');
  });
});
