import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { CookieOptions, Response } from 'express';
import ms, { type StringValue } from 'ms';

import { Role, TokenType } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma';
import { JwtPayload, JwtRefreshPayload } from '../types/jwt-payload.type';
import { AuthTokens } from '../types/auth-tokens.type';

const REFRESH_COOKIE_NAME = 'refresh_token';

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

    // Persist the refresh token
    await this.prisma.token.create({
      data: {
        token: refreshToken,
        type: TokenType.REFRESH,
        userId,
        expiresAt,
      },
    });

    // Create a signed JWT that carries the tokenId for refresh strategy validation
    const refreshJwt = this.jwtService.sign(
      { sub: userId, email, role, tokenId: refreshToken } as JwtRefreshPayload,
      {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn,
      },
    );

    this.setRefreshCookie(res, refreshJwt);

    return { access_token: accessToken };
  }

  setRefreshCookie(res: Response, token: string): void {
    const expiresIn = this.configService.get<string>('jwt.refreshExpiresIn', '30d');
    const maxAge = this.parseExpiry(expiresIn).getTime() - Date.now();

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
