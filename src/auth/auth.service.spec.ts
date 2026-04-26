import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { Response } from 'express';

jest.mock('argon2');

import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { PrismaService } from '@/prisma';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailService } from '@/mail';
import { TokenType } from '@/generated/prisma/client';

import { buildPrismaMock, PrismaMock } from '@test/mocks/prisma.mock';
import { buildJwtServiceMock } from '@test/mocks/jwt.mock';
import { buildMailServiceMock } from '@test/mocks/mail.mock';
import { buildConfigServiceMock } from '@test/mocks/config.mock';
import { buildUser } from '@test/factories/user.factory';

const mockResponse = (): Partial<Response> => ({
  cookie: jest.fn(),
  clearCookie: jest.fn(),
});

const mockRequest = () => ({ cookies: {} }) as unknown as import('express').Request;

const mockTwoFactorService = {
  initiate: jest.fn(),
  verify: jest.fn(),
  isTrustedDevice: jest.fn().mockResolvedValue(false),
  setTrustedDevice: jest.fn(),
  revokeTrustedDevices: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = buildPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: buildJwtServiceMock() },
        { provide: ConfigService, useValue: buildConfigServiceMock() },
        { provide: MailService, useValue: buildMailServiceMock() },
        { provide: TwoFactorService, useValue: mockTwoFactorService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('throws ConflictException when email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-id' });

      await expect(
        service.register({ name: 'John', email: 'taken@example.com', password: 'P@ssw0rd!' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates user and returns safe fields', async () => {
      const user = buildUser();
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });

      const result = await service.register({
        name: user.name,
        email: user.email,
        password: 'P@ssw0rd!',
      });

      expect(result).toEqual({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
      expect(result).not.toHaveProperty('passwordHash');
      expect(prisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('hashes password before storing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(buildUser());

      await service.register({
        name: 'John',
        email: 'new@example.com',
        password: 'P@ssw0rd!',
      });

      expect(argon2.hash).toHaveBeenCalledWith('P@ssw0rd!', expect.any(Object));
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException for unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const req = mockRequest();
      const res = mockResponse() as Response;

      await expect(
        service.login({ email: 'ghost@example.com', password: 'P@ssw0rd!' }, req, res),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for inactive user', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isActive: false }));
      const req = mockRequest();
      const res = mockResponse() as Response;

      await expect(
        service.login({ email: 'test@example.com', password: 'P@ssw0rd!' }, req, res),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const user = buildUser({ passwordHash: 'hashed-password' });
      prisma.user.findUnique.mockResolvedValue(user);
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      const req = mockRequest();
      const res = mockResponse() as Response;

      await expect(
        service.login({ email: user.email, password: 'wrong-password' }, req, res),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns access_token and sets refresh cookie on success', async () => {
      const password = 'P@ssw0rd!';
      const user = buildUser({ passwordHash: 'hashed-password' });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.token.create.mockResolvedValue({});
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      const req = mockRequest();
      const res = mockResponse() as Response;

      const result = await service.login({ email: user.email, password }, req, res);

      expect(result).toHaveProperty('access_token');
      if ('user' in result) {
        expect(result.user).not.toHaveProperty('passwordHash');
      }
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expect.objectContaining({ httpOnly: true }),
      );
    });
  });

  describe('logout', () => {
    it('deletes token and clears cookie', async () => {
      prisma.token.deleteMany.mockResolvedValue({ count: 1 });
      const res = mockResponse() as Response;

      await service.logout('token-id', res);

      expect(prisma.token.deleteMany).toHaveBeenCalledWith({
        where: { id: 'token-id' },
      });
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', expect.any(Object));
    });
  });

  describe('forgotPassword', () => {
    it('returns without action when user not found (anti-enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.forgotPassword({ email: 'nobody@example.com' }),
      ).resolves.toBeUndefined();

      expect(prisma.token.create).not.toHaveBeenCalled();
    });

    it('creates reset token and sends email when user exists', async () => {
      const user = buildUser();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.token.deleteMany.mockResolvedValue({ count: 0 });
      prisma.token.create.mockResolvedValue({});

      await service.forgotPassword({ email: user.email });

      expect(prisma.token.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: TokenType.PASSWORD_RESET,
            userId: user.id,
          }),
        }),
      );
    });
  });

  describe('resetPassword', () => {
    it('throws BadRequestException for invalid token', async () => {
      prisma.token.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          token: '00000000-0000-0000-0000-000000000000',
          password: 'New@P4ss!',
        }),
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('throws BadRequestException for already used token', async () => {
      prisma.token.findUnique.mockResolvedValue({
        id: 't1',
        type: TokenType.PASSWORD_RESET,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(),
        user: { id: 'user-1' },
      });

      await expect(
        service.resetPassword({
          token: '00000000-0000-0000-0000-000000000000',
          password: 'New@P4ss!',
        }),
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('throws BadRequestException for expired token', async () => {
      prisma.token.findUnique.mockResolvedValue({
        id: 't1',
        type: TokenType.PASSWORD_RESET,
        expiresAt: new Date(Date.now() - 1_000),
        usedAt: null,
        userId: 'user-1',
      });

      await expect(
        service.resetPassword({
          token: '00000000-0000-0000-0000-000000000000',
          password: 'New@P4ss!',
        }),
      ).rejects.toThrow('Reset token has expired');
    });

    it('updates password and revokes refresh tokens on success', async () => {
      prisma.token.findUnique.mockResolvedValue({
        id: 't1',
        type: TokenType.PASSWORD_RESET,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        user: { id: 'user-1' },
      });
      prisma.$transaction.mockResolvedValue([]);

      await service.resetPassword({
        token: '00000000-0000-0000-0000-000000000000',
        password: 'New@P4ss!',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCurrentUser', () => {
    it('returns user without sensitive fields', async () => {
      const user = buildUser();
      prisma.user.findUnique.mockResolvedValue({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
      });

      const result = await service.getCurrentUser(user.id);

      expect(result).toEqual({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
      });
    });

    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getCurrentUser('missing-id')).rejects.toThrow(NotFoundException);
    });
  });
});
