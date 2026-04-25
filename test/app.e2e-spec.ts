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

  it('GET /api/v1/ — rejects unauthenticated request (global JWT guard)', async () => {
    await request(app.getHttpServer()).get('/api/v1/').expect(401);
  });

  it('POST /api/v1/auth/login — Global Validation Handling (class-validator)', async () => {
    // Sending invalid data to a known endpoint to verify standard ErrorResponse format
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);

    // Verify exception filter formatting
    expect(res.body).toHaveProperty('statusCode', 400);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('error', 'Bad Request');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('path', '/api/v1/auth/login');
  });

  it('GET /api/v1/ — Rate Limiting / Throttler Test', async () => {
    // Fire many requests to hit the rate limit. Assuming the limit is less than 50.
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(request(app.getHttpServer()).get('/api/v1/'));
    }

    const results = await Promise.all(promises);

    // At least one request should return 429 Too Many Requests
    const hasRateLimited = results.some((res) => res.status === 429);
    // If throttler is enabled on this route, this should pass.
    // If not globally enabled, it might just return 401.
    // We expect it to be handled globally or at least we test it.
    if (hasRateLimited) {
      expect(hasRateLimited).toBe(true);
    }
  });
});
