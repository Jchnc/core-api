import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './services/password.service';
import { Role } from '@/generated/prisma/enums';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    refresh: jest.fn(),
    getCurrentUser: jest.fn(),
  };

  const mockPasswordService = {
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    setPassword: jest.fn(),
  };

  const mockResponse = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: PasswordService, useValue: mockPasswordService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const dto = { email: 'test@example.com', password: 'password', name: 'Test' };
      const now = new Date();
      const expectedUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        role: Role.USER,
        isActive: true,
        isEmailVerified: false,
        createdAt: now,
        updatedAt: now,
      };
      mockAuthService.register.mockResolvedValue(expectedUser);

      const result = await controller.register(dto);

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ data: expectedUser, message: 'User registered successfully' });
    });
  });

  describe('login', () => {
    it('should login a user', async () => {
      const dto = { email: 'test@example.com', password: 'password' };
      const now = new Date();
      const expectedResult = {
        access_token: 'token',
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test',
          role: Role.USER,
          isActive: true,
          isEmailVerified: false,
          createdAt: now,
          updatedAt: now,
        },
      };
      mockAuthService.login.mockResolvedValue(expectedResult);

      const mockReq = { cookies: {} } as unknown as import('express').Request;
      const result = await controller.login(dto, mockReq, mockResponse);

      expect(mockAuthService.login).toHaveBeenCalledWith(dto, mockReq, mockResponse);
      expect(result).toEqual({ data: expectedResult, message: 'Login successful' });
    });
  });

  describe('logout', () => {
    it('should logout a user', async () => {
      const payload = {
        sub: 'user-1',
        email: 'test@example.com',
        role: Role.USER,
        tokenId: 'token-1',
      };
      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(payload, mockResponse);

      expect(mockAuthService.logout).toHaveBeenCalledWith('token-1', mockResponse);
      expect(result).toEqual({ data: null, message: 'Logged out successfully' });
    });
  });

  describe('refresh', () => {
    it('should refresh tokens', async () => {
      const payload = {
        sub: 'user-1',
        email: 'test@example.com',
        role: Role.USER,
        tokenId: 'token-1',
      };
      const expectedTokens = { access_token: 'new-token' };

      mockAuthService.refresh.mockResolvedValue(expectedTokens);

      const result = await controller.refresh(payload, mockResponse);

      expect(mockAuthService.refresh).toHaveBeenCalledWith(payload, mockResponse);
      expect(result).toEqual({ data: expectedTokens, message: 'Tokens refreshed' });
    });
  });

  describe('forgotPassword', () => {
    it('should process forgot password request', async () => {
      const dto = { email: 'test@example.com' };
      mockPasswordService.forgotPassword.mockResolvedValue(undefined);

      const result = await controller.forgotPassword(dto);

      expect(mockPasswordService.forgotPassword).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        data: null,
        message: 'If that email is registered, a reset link has been sent',
      });
    });
  });

  describe('resetPassword', () => {
    it('should process reset password request', async () => {
      const dto = { token: 'reset-token', password: 'new-password' };
      mockPasswordService.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword(dto);

      expect(mockPasswordService.resetPassword).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ data: null, message: 'Password reset successfully' });
    });
  });

  describe('me', () => {
    it('should return current user data', async () => {
      const payload = {
        sub: 'user-1',
        email: 'test@example.com',
        role: Role.USER,
        tokenId: 'token-1',
      };
      const now = new Date();
      const expectedUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        role: Role.USER,
        isActive: true,
        isEmailVerified: false,
        createdAt: now,
        updatedAt: now,
      };

      mockAuthService.getCurrentUser.mockResolvedValue(expectedUser);

      const result = await controller.me(payload);

      expect(mockAuthService.getCurrentUser).toHaveBeenCalledWith(payload.sub);
      expect(result).toEqual({ data: expectedUser });
    });
  });
});
