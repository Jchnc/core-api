import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '@/prisma';
import { JwtRefreshPayload, JwtRefreshPayloadWithUser } from '@/auth/types/jwt-payload.type';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => (req?.cookies?.['refresh_token'] as string | undefined) ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.refreshSecret'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtRefreshPayload): Promise<JwtRefreshPayloadWithUser> {
    const rawToken = req.cookies?.['refresh_token'] as string | undefined;

    if (!rawToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    if (!payload.tokenId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Constant-time hash comparison of raw cookie vs JWT tokenId
    const hashed = createHash('sha256').update(rawToken).digest();
    const expected = Buffer.from(payload.tokenId, 'hex');
    if (
      hashed.length !== expected.length
      || expected.length !== 32
      || !timingSafeEqual(hashed, expected)
    ) {
      throw new UnauthorizedException('Token mismatch');
    }

    // payload.tokenId is already a SHA-256 hash — use it directly for DB lookup
    const token = await this.prisma.token.findUnique({
      where: { token: payload.tokenId },
      select: {
        id: true,
        usedAt: true,
        expiresAt: true,
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

    if (!token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (token.usedAt !== null) {
      await this.prisma.token.deleteMany({
        where: { userId: payload.sub },
      });
      throw new UnauthorizedException('Refresh token reuse detected. All sessions revoked.');
    }

    if (token.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    if (!token.user.isActive) {
      throw new UnauthorizedException('User is inactive');
    }

    const { passwordHash, ...safeUser } = token.user;
    return { ...payload, tokenId: token.id, user: { ...safeUser, hasPassword: !!passwordHash } };
  }
}
