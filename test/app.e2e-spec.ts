import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { buildTestApp } from './helpers/app.helper';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health — returns liveness status', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(res.body.data).toHaveProperty('status', 'ok');
    expect(res.body.data).toHaveProperty('timestamp');
  });

  it('GET /api/v1/readiness — returns readiness status with health checks', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/readiness');

    expect([200, 503]).toContain(res.status);

    if (res.status === 200) {
      expect(res.body.data).toHaveProperty('status');
      expect(res.body.data).toHaveProperty('details');
    } else {
      expect(res.body).toHaveProperty('statusCode', 503);
      expect(res.body).toHaveProperty('error');
    }
  });

  it('POST /api/v1/auth/login — Global Validation Handling (class-validator)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);

    expect(res.body).toHaveProperty('statusCode', 400);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('error', 'Bad Request');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('path', '/api/v1/auth/login');
  });
});
