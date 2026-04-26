import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';
import { PrismaService } from '@/prisma';
import { Role } from '@/generated/prisma/enums';

describe('JwtRefreshStrategy', () => {
  let strategy: JwtRefreshStrategy;

  const mockPrismaService = {
    token: {
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockConfigService = {
    getOrThrow: jest.fn().mockReturnValue('refresh-secret'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtRefreshStrategy,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    strategy = module.get<JwtRefreshStrategy>(JwtRefreshStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    const payload = {
      sub: 'user-1',
      email: 'test@example.com',
      role: Role.USER,
      tokenId: 'token-1',
    };

    let mockRequest: Partial<Request>;

    beforeEach(() => {
      mockRequest = {
        cookies: { refresh_token: 'raw-refresh-token' },
      };
    });

    it('should return payload with tokenId if token is valid and user is active', async () => {
      const mockToken = {
        id: 'token-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 10000), // future
        user: { id: 'user-1', isActive: true, passwordHash: null },
      };
      mockPrismaService.token.findUnique.mockResolvedValue(mockToken);

      const result = await strategy.validate(mockRequest as Request, payload);

      expect(mockPrismaService.token.findUnique).toHaveBeenCalledWith({
        where: { token: payload.tokenId },
        select: {
          id: true,
          expiresAt: true,
          usedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
              isEmailVerified: true,
              isTwoFactorEnabled: true,
              passwordHash: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });
      expect(result).toEqual({
        ...payload,
        tokenId: 'token-1',
        user: {
          id: 'user-1',
          isActive: true,
          hasPassword: false,
        },
      });
    });

    it('should throw UnauthorizedException if raw token is missing', async () => {
      mockRequest.cookies = {};

      await expect(strategy.validate(mockRequest as Request, payload)).rejects.toThrow(
        'Refresh token missing',
      );
    });

    it('should throw UnauthorizedException if token record is not found', async () => {
      mockPrismaService.token.findUnique.mockResolvedValue(null);

      await expect(strategy.validate(mockRequest as Request, payload)).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should throw UnauthorizedException and revoke all tokens if token is reused', async () => {
      const mockToken = {
        id: 'token-1',
        usedAt: new Date(Date.now() - 35000), // 35 seconds ago, outside the 30s grace period
        expiresAt: new Date(Date.now() + 10000),
        user: { id: 'user-1', isActive: true, passwordHash: null },
      };
      mockPrismaService.token.findUnique.mockResolvedValue(mockToken);

      await expect(strategy.validate(mockRequest as Request, payload)).rejects.toThrow(
        'Refresh token reuse detected. All sessions revoked.',
      );
      expect(mockPrismaService.token.deleteMany).toHaveBeenCalledWith({
        where: { userId: payload.sub },
      });
    });

    it('should throw UnauthorizedException if token is expired', async () => {
      const mockToken = {
        id: 'token-1',
        usedAt: null,
        expiresAt: new Date(Date.now() - 10000), // past
        user: { id: 'user-1', isActive: true, passwordHash: null },
      };
      mockPrismaService.token.findUnique.mockResolvedValue(mockToken);

      await expect(strategy.validate(mockRequest as Request, payload)).rejects.toThrow(
        'Refresh token expired',
      );
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const mockToken = {
        id: 'token-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 10000),
        user: { id: 'user-1', isActive: false, passwordHash: null },
      };
      mockPrismaService.token.findUnique.mockResolvedValue(mockToken);

      await expect(strategy.validate(mockRequest as Request, payload)).rejects.toThrow(
        'User is inactive',
      );
    });
  });
});
