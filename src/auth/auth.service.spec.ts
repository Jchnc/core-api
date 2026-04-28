import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';

import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { TokenService } from './services/token.service';
import { HashingService } from './services/hashing.service';

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailService } from '@/mail';
import { AuthRepository } from './auth.repository';

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

const mockHashingService = {
  hash: jest.fn().mockResolvedValue('hashed-password'),
  verify: jest.fn().mockResolvedValue(true),
};

const mockTokenService = {
  issueTokenPair: jest.fn().mockResolvedValue({ access_token: 'token' }),
  clearRefreshCookie: jest.fn(),
};

const mockAuthRepository = {
  findUserByEmail: jest.fn(),
  findUserById: jest.fn(),
  createUser: jest.fn(),
  deleteTokenById: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let authRepository: typeof mockAuthRepository;

  beforeEach(async () => {
    authRepository = mockAuthRepository;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: authRepository },
        { provide: JwtService, useValue: buildJwtServiceMock() },
        { provide: ConfigService, useValue: buildConfigServiceMock() },
        { provide: MailService, useValue: buildMailServiceMock() },
        { provide: TwoFactorService, useValue: mockTwoFactorService },
        { provide: HashingService, useValue: mockHashingService },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('throws ConflictException when email already exists', async () => {
      authRepository.findUserByEmail.mockResolvedValue({ id: 'existing-id' });

      await expect(
        service.register({ name: 'John', email: 'taken@example.com', password: 'P@ssw0rd!' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates user and returns safe fields', async () => {
      const user = buildUser();
      authRepository.findUserByEmail.mockResolvedValue(null);
      authRepository.createUser.mockResolvedValue({
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
      expect(authRepository.createUser).toHaveBeenCalledTimes(1);
    });

    it('hashes password before storing', async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);
      authRepository.createUser.mockResolvedValue(buildUser());

      await service.register({
        name: 'John',
        email: 'new@example.com',
        password: 'P@ssw0rd!',
      });

      expect(mockHashingService.hash).toHaveBeenCalledWith('P@ssw0rd!');
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException for unknown email', async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);
      const req = mockRequest();
      const res = mockResponse() as Response;

      await expect(
        service.login({ email: 'ghost@example.com', password: 'P@ssw0rd!' }, req, res),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for inactive user', async () => {
      authRepository.findUserByEmail.mockResolvedValue(buildUser({ isActive: false }));
      const req = mockRequest();
      const res = mockResponse() as Response;

      await expect(
        service.login({ email: 'test@example.com', password: 'P@ssw0rd!' }, req, res),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const user = buildUser({ passwordHash: 'hashed-password' });
      authRepository.findUserByEmail.mockResolvedValue(user);
      mockHashingService.verify.mockResolvedValueOnce(false);
      const req = mockRequest();
      const res = mockResponse() as Response;

      await expect(
        service.login({ email: user.email, password: 'wrong-password' }, req, res),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns access_token and sets refresh cookie on success', async () => {
      const password = 'P@ssw0rd!';
      const user = buildUser({ passwordHash: 'hashed-password' });
      authRepository.findUserByEmail.mockResolvedValue(user);
      mockHashingService.verify.mockResolvedValueOnce(true);
      const req = mockRequest();
      const res = mockResponse() as Response;

      const result = await service.login({ email: user.email, password }, req, res);

      expect(result).toHaveProperty('access_token');
      if ('user' in result) {
        expect(result.user).not.toHaveProperty('passwordHash');
      }
      expect(mockTokenService.issueTokenPair).toHaveBeenCalledWith(
        user.id,
        user.email,
        user.role,
        res,
      );
    });
  });

  describe('logout', () => {
    it('deletes token and clears cookie', async () => {
      authRepository.deleteTokenById.mockResolvedValue({ id: 'token-id' });
      const res = mockResponse() as Response;

      await service.logout('token-id', res);

      expect(authRepository.deleteTokenById).toHaveBeenCalledWith('token-id');
      expect(mockTokenService.clearRefreshCookie).toHaveBeenCalledWith(res);
    });
  });

  describe('getCurrentUser', () => {
    it('returns user without sensitive fields', async () => {
      const user = buildUser();
      authRepository.findUserById.mockResolvedValue({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
        passwordHash: null,
      });

      const result = await service.getCurrentUser(user.id);

      expect(result).toEqual({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
        hasPassword: false,
      });
    });

    it('throws NotFoundException when user does not exist', async () => {
      authRepository.findUserById.mockResolvedValue(null);

      await expect(service.getCurrentUser('missing-id')).rejects.toThrow(NotFoundException);
    });
  });
});
