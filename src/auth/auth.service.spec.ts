import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';

import { Role } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma';
import { MailService } from '@/mail';
import { AuthService } from './auth.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let authService: AuthService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    token: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((queries) => Promise.all(queries)),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  };

  const mockMailService = {
    sendWelcome: jest.fn(),
    sendPasswordReset: jest.fn(),
  };

  const mockResponse = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);

    // Default config returns
    mockConfigService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'jwt.accessSecret') return 'access-secret';
      if (key === 'jwt.refreshSecret') return 'refresh-secret';
      throw new Error(`Unexpected config key: ${key}`);
    });

    mockConfigService.get.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'jwt.accessExpiresIn') return '15m';
      if (key === 'jwt.refreshExpiresIn') return '30d';
      if (key === 'app.nodeEnv') return 'test';
      if (key === 'app.passwordResetTokenTtl') return 3600;
      if (key === 'app.frontendUrl') return 'http://localhost:3000';
      return defaultValue;
    });
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    };

    it('should successfully register a user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-1',
        email: registerDto.email,
        name: registerDto.name,
        role: Role.USER,
      });

      const result = await authService.register(registerDto);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
        select: { id: true },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email,
          name: registerDto.name,
          passwordHash: 'hashedPassword',
        },
        select: { id: true, email: true, name: true, role: true },
      });
      expect(mockMailService.sendWelcome).toHaveBeenCalledWith(registerDto.email, {
        name: registerDto.name,
      });
      expect(result).toEqual({
        id: 'user-1',
        email: registerDto.email,
        name: registerDto.name,
        role: Role.USER,
      });
    });

    it('should throw ConflictException if email is already registered', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'existing-id' });

      await expect(authService.register(registerDto)).rejects.toThrow(ConflictException);
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: 'user-1',
      email: loginDto.email,
      name: 'Test User',
      role: Role.USER,
      passwordHash: 'hashedPassword',
      isActive: true,
    };

    it('should return tokens and user data on successful login', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mocked-token');

      const result = await authService.login(loginDto, mockResponse as unknown as Response);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: loginDto.email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          passwordHash: true,
          isActive: true,
        },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockUser.passwordHash);
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2); // Access and refresh tokens
      expect(mockResponse.cookie).toHaveBeenCalled();

      expect(result).toEqual({
        access_token: 'mocked-token',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          role: mockUser.role,
        },
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('dummy-hash'); // constant-time check

      await expect(
        authService.login(loginDto, mockResponse as unknown as Response),
      ).rejects.toThrow(UnauthorizedException);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if account is disabled', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(
        authService.login(loginDto, mockResponse as unknown as Response),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.login(loginDto, mockResponse as unknown as Response),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('should silently return if user is not found to prevent enumeration', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await authService.forgotPassword({ email: 'nonexistent@example.com' });

      expect(mockPrismaService.user.findUnique).toHaveBeenCalled();
      expect(mockPrismaService.token.deleteMany).not.toHaveBeenCalled();
    });

    it('should generate a reset link and send email if user is found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-1', name: 'Test User' });
      mockPrismaService.token.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.token.create.mockResolvedValue({});

      await authService.forgotPassword({ email: 'test@example.com' });

      expect(mockPrismaService.token.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', type: 'PASSWORD_RESET' },
      });
      expect(mockPrismaService.token.create).toHaveBeenCalled();

      expect(mockMailService.sendPasswordReset).toHaveBeenCalledWith('test@example.com', {
        name: 'Test User',
        resetLink: expect.stringContaining('http://localhost:3000/reset-password?token=') as string,
        expiresInMinutes: 60,
      });
    });
  });

  describe('resetPassword', () => {
    const resetDto = {
      token: 'valid-token',
      password: 'new-password123',
    };

    it('should reset password and revoke refresh tokens on valid token', async () => {
      const mockTokenRecord = {
        id: 'token-1',
        type: 'PASSWORD_RESET',
        usedAt: null,
        expiresAt: new Date(Date.now() + 10000), // future
        user: { id: 'user-1' },
      };

      mockPrismaService.token.findUnique.mockResolvedValue(mockTokenRecord);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');

      await authService.resetPassword(resetDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(resetDto.password, 12);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException if token does not exist', async () => {
      mockPrismaService.token.findUnique.mockResolvedValue(null);

      await expect(authService.resetPassword(resetDto)).rejects.toThrow(
        'Invalid or expired reset token',
      );
    });

    it('should throw BadRequestException if token is expired', async () => {
      const mockTokenRecord = {
        id: 'token-1',
        type: 'PASSWORD_RESET',
        usedAt: null,
        expiresAt: new Date(Date.now() - 10000), // past
        user: { id: 'user-1' },
      };

      mockPrismaService.token.findUnique.mockResolvedValue(mockTokenRecord);

      await expect(authService.resetPassword(resetDto)).rejects.toThrow('Reset token has expired');
    });
  });
});
