import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'crypto';
import { Request } from 'express';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';
import { PrismaService } from '@/prisma';
import { Role } from '@/generated/prisma/enums';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

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
    const tokenId = 'token-uuid-value';
    const hashedTokenId = hashToken(tokenId);

    const payload = {
      sub: 'user-1',
      email: 'test@example.com',
      role: Role.USER,
      tokenId: hashedTokenId, // JWT now carries the hash, not the raw token
    };

    let mockRequest: Partial<Request>;

    beforeEach(() => {
      mockRequest = {
        cookies: { refresh_token: tokenId }, // cookie must match JWT tokenId
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

      // Lookup now uses SHA-256 hash of tokenId
      expect(mockPrismaService.token.findUnique).toHaveBeenCalledWith({
        where: { token: hashedTokenId },
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

    it('should throw Token mismatch if cookie does not match JWT tokenId', async () => {
      mockRequest.cookies = { refresh_token: 'different-token' };

      await expect(strategy.validate(mockRequest as Request, payload)).rejects.toThrow(
        'Token mismatch',
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
        usedAt: new Date(Date.now() - 5000), // any past time — immediate revocation
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
