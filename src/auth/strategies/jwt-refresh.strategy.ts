import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
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
      const gracePeriodMs = 30 * 1000; // 30 seconds
      const isWithinGracePeriod = Date.now() - token.usedAt.getTime() < gracePeriodMs;

      if (!isWithinGracePeriod) {
        // Token reuse detected — possible theft; revoke all tokens for this user
        await this.prisma.token.deleteMany({
          where: { userId: payload.sub },
        });
        throw new UnauthorizedException('Refresh token reuse detected. All sessions revoked.');
      }
    }

    if (token.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    if (!token.user.isActive) {
      throw new UnauthorizedException('User is inactive');
    }

    return { ...payload, tokenId: token.id, user: token.user };
  }
}
