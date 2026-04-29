import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'crypto';
import { CookieOptions, Response } from 'express';
import ms, { type StringValue } from 'ms';

import { Role, TokenType } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma';
import { JwtPayload, JwtRefreshPayload } from '../types/jwt-payload.type';
import { AuthTokens } from '../types/auth-tokens.type';

const REFRESH_COOKIE_NAME = 'refresh_token';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async issueTokenPair(
    userId: string,
    email: string,
    role: Role,
    res: Response,
  ): Promise<AuthTokens> {
    const accessPayload: JwtPayload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
      expiresIn: this.configService.get<string>('jwt.accessExpiresIn', '15m') as StringValue,
    });

    const refreshToken = randomUUID();
    const refreshExpiresIn = this.configService.get<string>(
      'jwt.refreshExpiresIn',
      '30d',
    ) as StringValue;

    const expiresAt = this.parseExpiry(refreshExpiresIn);
    const cookieMaxAge = ms(refreshExpiresIn);
    if (cookieMaxAge === undefined) {
      throw new Error(`Invalid refresh expiry duration: ${refreshExpiresIn}`);
    }

    // Persist SHA-256 hash of the refresh token
    const hashedTokenId = hashToken(refreshToken);
    await this.prisma.token.create({
      data: {
        token: hashedTokenId,
        type: TokenType.REFRESH,
        userId,
        expiresAt,
      },
    });

    // Create a signed JWT that carries the hashed tokenId for refresh strategy validation
    const refreshJwt = this.jwtService.sign(
      { sub: userId, email, role, tokenId: hashedTokenId } as JwtRefreshPayload,
      {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn,
      },
    );

    this.setRefreshCookie(res, refreshJwt, cookieMaxAge);

    return { access_token: accessToken };
  }

  setRefreshCookie(res: Response, token: string, maxAge: number): void {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      ...this.getCookieOptions(),
      maxAge,
    });
  }

  clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE_NAME, {
      ...this.getCookieOptions(),
    });
  }

  parseExpiry(expiry: string): Date {
    const milliseconds = ms(expiry as StringValue);
    if (milliseconds === undefined) {
      throw new Error(`Invalid expiry format: ${expiry}`);
    }
    return new Date(Date.now() + milliseconds);
  }

  getCookieOptions(): CookieOptions {
    const isProd = this.configService.get<string>('app.nodeEnv') === 'production';

    return {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
    };
  }
}
