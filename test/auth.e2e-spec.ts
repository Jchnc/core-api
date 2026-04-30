import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from '../src/prisma';
import { buildTestApp } from './helpers/app.helper';
import { cleanDatabase } from './helpers/db.helper';

const BASE = '/api/v1/auth';

const validUser = {
  name: 'E2E User',
  email: 'e2e@example.com',
  password: 'E2eP@ssw0rd!',
};

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await buildTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase(app);
  });

  afterAll(async () => {
    await cleanDatabase(app);
    await app.close();
  });

  /**
   * Helper: create a fresh agent per test to avoid cookie leakage
   * between describe blocks (stale refresh cookies break login).
   */
  function freshAgent() {
    return request.agent(app.getHttpServer());
  }

  describe(`POST ${BASE}/register`, () => {
    it('201 — registers a new user', async () => {
      const agent = freshAgent();
      const res = await agent.post(`${BASE}/register`).send(validUser).expect(201);

      expect(res.body.data).toMatchObject({
        email: validUser.email,
        name: validUser.name,
      });
      expect(res.body.data).not.toHaveProperty('passwordHash');
    });

    it('409 — rejects duplicate email', async () => {
      const agent = freshAgent();
      await agent.post(`${BASE}/register`).send(validUser);
      await agent.post(`${BASE}/register`).send(validUser).expect(409);
    });

    it('400 — rejects weak password', async () => {
      const agent = freshAgent();
      await agent
        .post(`${BASE}/register`)
        .send({ ...validUser, password: 'weak' })
        .expect(400);
    });

    it('400 — rejects invalid email', async () => {
      const agent = freshAgent();
      await agent
        .post(`${BASE}/register`)
        .send({ ...validUser, email: 'not-an-email' })
        .expect(400);
    });
  });

  describe(`POST ${BASE}/login`, () => {
    beforeEach(async () => {
      // Register the user using a raw request (no agent, no cookies)
      await request(app.getHttpServer()).post(`${BASE}/register`).send(validUser).expect(201);
    });

    it('200 — returns access_token and sets httpOnly refresh cookie', async () => {
      const agent = freshAgent();
      const res = await agent
        .post(`${BASE}/login`)
        .send({ email: validUser.email, password: validUser.password })
        .expect(200);

      expect(res.body.data).toHaveProperty('access_token');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');

      const setCookie = res.headers['set-cookie'] as unknown as string[];
      expect(setCookie).toBeDefined();
      const refreshCookie = setCookie.find((c) => c.startsWith('refresh_token='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
    });

    it('401 — rejects wrong password', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/login`)
        .send({ email: validUser.email, password: 'wrong-password' })
        .expect(401);
    });

    it('401 — rejects unknown email', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/login`)
        .send({ email: 'nobody@example.com', password: validUser.password })
        .expect(401);
    });
  });

  describe(`POST ${BASE}/refresh`, () => {
    it('200 — returns new access_token and rotates refresh cookie', async () => {
      await request(app.getHttpServer()).post(`${BASE}/register`).send(validUser);

      const loginRes = await request(app.getHttpServer())
        .post(`${BASE}/login`)
        .send({ email: validUser.email, password: validUser.password });

      // Extract the refresh cookie from the login response
      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));
      expect(refreshCookie).toBeDefined();
      const cookieValue = refreshCookie!.split(';')[0];

      const res = await request(app.getHttpServer())
        .post(`${BASE}/refresh`)
        .set('Cookie', cookieValue)
        .expect(200);

      expect(res.body.data).toHaveProperty('access_token');
    });

    it('401 — rejects request without cookie', async () => {
      await request(app.getHttpServer()).post(`${BASE}/refresh`).expect(401);
    });
  });

  describe(`GET ${BASE}/me`, () => {
    it('200 — returns current user', async () => {
      const agent = freshAgent();
      await agent.post(`${BASE}/register`).send(validUser);
      const loginRes = await agent
        .post(`${BASE}/login`)
        .send({ email: validUser.email, password: validUser.password });

      const { access_token } = loginRes.body.data;

      const res = await agent
        .get(`${BASE}/me`)
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);

      expect(res.body.data).toMatchObject({ email: validUser.email });
    });

    it('401 — rejects unauthenticated request', async () => {
      await request(app.getHttpServer()).get(`${BASE}/me`).expect(401);
    });
  });

  describe(`POST ${BASE}/logout`, () => {
    it('200 — invalidates session', async () => {
      await request(app.getHttpServer()).post(`${BASE}/register`).send(validUser);

      const loginRes = await request(app.getHttpServer())
        .post(`${BASE}/login`)
        .send({ email: validUser.email, password: validUser.password });

      const { access_token } = loginRes.body.data;
      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));
      const cookieValue = refreshCookie!.split(';')[0];

      await request(app.getHttpServer())
        .post(`${BASE}/logout`)
        .set('Authorization', `Bearer ${access_token}`)
        .set('Cookie', cookieValue)
        .expect(200);

      // Verify the refresh cookie no longer works
      await request(app.getHttpServer())
        .post(`${BASE}/refresh`)
        .set('Cookie', cookieValue)
        .expect(401);
    });
  });

  describe(`POST ${BASE}/forgot-password`, () => {
    it('200 — always returns 200 regardless of email existence', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/forgot-password`)
        .send({ email: 'nobody@example.com' })
        .expect(200);
    });

    it('200 — sends email when user exists', async () => {
      const agent = freshAgent();
      await agent.post(`${BASE}/register`).send(validUser);

      await agent.post(`${BASE}/forgot-password`).send({ email: validUser.email }).expect(200);
    });
  });

  describe(`POST ${BASE}/reset-password`, () => {
    it('400 — rejects invalid token format', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/reset-password`)
        .send({ token: 'not-a-uuid', password: 'New@P4ss!' })
        .expect(400);
    });

    it('400 — rejects non-existent token', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/reset-password`)
        .send({
          token: '00000000-0000-4000-a000-000000000000',
          password: 'New@P4ss!',
        })
        .expect(400);
    });

    it('200 — verifies token is created and stored as hash in database', async () => {
      const agent = freshAgent();

      await agent.post(`${BASE}/register`).send(validUser);
      await agent.post(`${BASE}/forgot-password`).send({ email: validUser.email }).expect(200);

      const tokenRecord = await prisma.token.findFirst({
        where: { type: 'PASSWORD_RESET' },
        orderBy: { createdAt: 'desc' },
      });

      expect(tokenRecord).not.toBeNull();
      expect(tokenRecord!.token).toHaveLength(64);
      expect(tokenRecord!.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(tokenRecord!.usedAt).toBeNull();
    });

    it('400 — rejects already-used reset token', async () => {
      const agent = freshAgent();
      const crypto = await import('crypto');

      await agent.post(`${BASE}/register`).send(validUser);

      const user = await prisma.user.findUnique({
        where: { email: validUser.email },
        select: { id: true },
      });

      const rawToken = crypto.randomUUID();
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      await prisma.token.create({
        data: {
          token: hashedToken,
          type: 'PASSWORD_RESET',
          userId: user!.id,
          expiresAt: new Date(Date.now() + 3600000),
          usedAt: new Date(),
        },
      });

      await agent
        .post(`${BASE}/reset-password`)
        .send({ token: rawToken, password: 'New@P4ss!' })
        .expect(400);
    });

    it('200 — full flow: manually create token → reset → login with new password', async () => {
      const agent = freshAgent();
      const crypto = await import('crypto');

      await agent.post(`${BASE}/register`).send(validUser);

      const user = await prisma.user.findUnique({
        where: { email: validUser.email },
        select: { id: true },
      });

      const rawToken = crypto.randomUUID();
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      await prisma.token.create({
        data: {
          token: hashedToken,
          type: 'PASSWORD_RESET',
          userId: user!.id,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });

      const newPassword = 'NewP@ssw0rd!';
      await agent
        .post(`${BASE}/reset-password`)
        .send({ token: rawToken, password: newPassword })
        .expect(200);

      const loginRes = await agent
        .post(`${BASE}/login`)
        .send({ email: validUser.email, password: newPassword })
        .expect(200);

      expect(loginRes.body.data).toHaveProperty('access_token');
    });
  });
});
