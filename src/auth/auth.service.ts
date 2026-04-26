import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import type { StringValue } from 'ms';

import { Role, TokenType } from '@/generated/prisma/enums';
import { MailService } from '@/mail';
import { PrismaService } from '@/prisma';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, SetPasswordDto } from './dto';
import { TwoFactorService } from './two-factor.service';
import { OAuthUserPayload } from './types/google-profile.type';
import { JwtPayload, JwtRefreshPayload } from './types/jwt-payload.type';
import type { TwoFactorRequiredResponse } from './types/two-factor.types';

const REFRESH_COOKIE_NAME = 'refresh_token';

export interface AuthTokens {
  access_token: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive?: boolean;
  isEmailVerified?: boolean;
  isTwoFactorEnabled?: boolean;
  hasPassword?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  private get argon2Options(): argon2.Options {
    return {
      type: argon2.argon2id,
      memoryCost: this.configService.get<number>('security.argon2.memoryCost', 65536),
      timeCost: this.configService.get<number>('security.argon2.timeCost', 3),
      parallelism: this.configService.get<number>('security.argon2.parallelism', 4),
    };
  }

  /**
   * Register a new user and send welcome email.
   * @param dto The user registration data.
   * @returns The registered user.
   * @throws {ConflictException} If the email is already registered.
   */
  async register(dto: RegisterDto): Promise<AuthUser> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await argon2.hash(dto.password, this.argon2Options);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    // Fire-and-forget: welcome email failure must not block registration
    void this.mailService.sendWelcome(user.email, {
      name: user.name,
    });

    return user;
  }

  /**
   * Login a user.
   * @param dto The user login data.
   * @param res The response object to set cookies.
   * @returns The tokens and user data.
   * @throws {UnauthorizedException} If the credentials are invalid or the account is disabled.
   */
  async login(
    dto: LoginDto,
    req: Request,
    res: Response,
  ): Promise<(AuthTokens & { user: AuthUser }) | TwoFactorRequiredResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        isActive: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
        isTwoFactorEnabled: true,
      },
    });

    if (!user) {
      // Constant-time response to prevent user enumeration
      await argon2.hash(dto.password, this.argon2Options);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    const isPasswordValid =
      user.passwordHash ? await argon2.verify(user.passwordHash, dto.password) : false;

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isTwoFactorEnabled) {
      const isTrusted = await this.twoFactorService.isTrustedDevice(user.id, req);

      if (!isTrusted) {
        return this.twoFactorService.initiate(user.id, user.email, user.name);
      }
    }

    const tokens = await this.issueTokenPair(user.id, user.email, user.role, res);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  /**
   * Logout a user.
   * @param tokenId The token ID of the user.
   * @param res The response object to clear cookies.
   */
  async logout(tokenId: string, res: Response): Promise<void> {
    await this.prisma.token.deleteMany({ where: { id: tokenId } });
    this.clearRefreshCookie(res);
  }

  /**
   * Refresh the access token.
   * @param payload The token payload.
   * @param res The response object to set cookies.
   * @returns The tokens.
   * @throws {UnauthorizedException} If the token is invalid or expired.
   */
  async refresh(payload: JwtRefreshPayload, res: Response): Promise<AuthTokens> {
    // Mark old token as used (rotation)
    await this.prisma.token.update({
      where: { id: payload.tokenId },
      data: { usedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true },
    });

    if (!user) throw new UnauthorizedException('User not found');

    return this.issueTokenPair(user.id, user.email, user.role, res);
  }

  /**
   * Send a password reset link to the user.
   * @param dto The user email.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, name: true },
    });

    // Always return 200 to prevent email enumeration
    if (!user) return;

    // Invalidate any existing password reset tokens for this user
    await this.prisma.token.deleteMany({
      where: { userId: user.id, type: TokenType.PASSWORD_RESET },
    });

    const tokenTtl = this.configService.get<number>('app.passwordResetTokenTtl', 3600);

    const resetToken = randomUUID();

    await this.prisma.token.create({
      data: {
        token: resetToken,
        type: TokenType.PASSWORD_RESET,
        userId: user.id,
        expiresAt: new Date(Date.now() + tokenTtl * 1000),
      },
    });

    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    await this.mailService.sendPasswordReset(dto.email, {
      name: user.name,
      resetLink,
      expiresInMinutes: Math.floor(tokenTtl / 60),
    });
  }

  /**
   * Reset a user's password.
   * @param dto The reset password data.
   * @returns void
   * @throws {BadRequestException} If the token is invalid or expired.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenRecord = await this.prisma.token.findUnique({
      where: { token: dto.token },
      select: {
        id: true,
        type: true,
        expiresAt: true,
        usedAt: true,
        user: { select: { id: true } },
      },
    });

    if (
      !tokenRecord
      || tokenRecord.type !== TokenType.PASSWORD_RESET
      || tokenRecord.usedAt !== null
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    const passwordHash = await argon2.hash(dto.password, this.argon2Options);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: tokenRecord.user.id },
        data: { passwordHash },
      }),
      // Mark token as used
      this.prisma.token.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      }),
      // Revoke ALL refresh tokens for this user (force re-login everywhere)
      this.prisma.token.deleteMany({
        where: {
          userId: tokenRecord.user.id,
          type: TokenType.REFRESH,
        },
      }),
    ]);
  }

  /**
   * Get current user.
   * @param userId The user ID.
   * @returns The user.
   * @throws {NotFoundException} If the user is not found.
   */
  async getCurrentUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isTwoFactorEnabled: true,
        passwordHash: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isTwoFactorEnabled: user.isTwoFactorEnabled,
      hasPassword: !!user.passwordHash,
    };
  }

  verifySession(
    userId: string,
    email: string,
    role: Role,
    user: AuthUser,
  ): AuthTokens & { user: AuthUser } {
    const accessPayload: JwtPayload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
      expiresIn: this.configService.get<string>('jwt.accessExpiresIn', '15m') as StringValue,
    });

    return {
      access_token: accessToken,
      user,
    };
  }

  /**
   * Logs in or creates a user based on OAuth provider data.
   * @param payload - The OAuth user profile payload.
   * @param res - The response object to set cookies.
   * @returns An object containing the access token, refresh token, and user profile.
   * @throws {UnauthorizedException} If the account is disabled.
   */
  async loginWithOAuth(
    payload: OAuthUserPayload,
    req: Request,
    res: Response,
  ): Promise<(AuthTokens & { user: AuthUser }) | TwoFactorRequiredResponse> {
    let user = await this.prisma.user.findUnique({
      where: { email: payload.email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isTwoFactorEnabled: true,
        passwordHash: true,
        oauthAccounts: {
          where: {
            provider: payload.provider,
            providerId: payload.providerId,
          },
          select: { id: true },
        },
      },
    });

    if (user) {
      if (!user.isActive) {
        throw new UnauthorizedException('Account is disabled');
      }

      // Link OAuth account if not already linked
      if (user.oauthAccounts.length === 0) {
        await this.prisma.oAuthAccount.create({
          data: {
            provider: payload.provider,
            providerId: payload.providerId,
            userId: user.id,
          },
        });
      }
    } else {
      // First time: create user + OAuth account
      user = await this.prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name,
          isEmailVerified: payload.isEmailVerified,
          oauthAccounts: {
            create: {
              provider: payload.provider,
              providerId: payload.providerId,
            },
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          isTwoFactorEnabled: true,
          passwordHash: true,
          oauthAccounts: { select: { id: true } },
        },
      });
    }

    if (user.isTwoFactorEnabled) {
      const isTrusted = await this.twoFactorService.isTrustedDevice(user.id, req);

      if (!isTrusted) {
        return this.twoFactorService.initiate(user.id, user.email, user.name);
      }
    }

    const tokens = await this.issueTokenPair(user.id, user.email, user.role, res);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
      },
    };
  }

  async completeTwoFactor(
    twoFactorToken: string,
    code: string,
    trustDevice: boolean,
    req: Request,
    res: Response,
  ): Promise<AuthTokens & { user: AuthUser }> {
    const { userId } = await this.twoFactorService.verify(twoFactorToken, code);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isTwoFactorEnabled: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    if (trustDevice) {
      await this.twoFactorService.setTrustedDevice(user.id, req, res);
    }

    const tokens = await this.issueTokenPair(user.id, user.email, user.role, res);
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
      },
    };
  }

  async enableTwoFactor(userId: string, password: string): Promise<void> {
    await this.verifyPasswordForUser(userId, password);

    await this.prisma.user.update({
      where: { id: userId },
      data: { isTwoFactorEnabled: true },
    });
  }

  async disableTwoFactor(userId: string, password: string, res: Response): Promise<void> {
    await this.verifyPasswordForUser(userId, password);

    await this.prisma.user.update({
      where: { id: userId },
      data: { isTwoFactorEnabled: false },
    });
    await this.twoFactorService.revokeTrustedDevices(userId, res);
  }

  async setPassword(userId: string, dto: SetPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) throw new NotFoundException('User not found');

    if (user.passwordHash) {
      throw new BadRequestException('Password is already set. Use reset password instead.');
    }

    const passwordHash = await argon2.hash(dto.password, this.argon2Options);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  private async verifyPasswordForUser(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      throw new BadRequestException('Password confirmation is required');
    }

    const isValid = await argon2.verify(user.passwordHash, password);

    if (!isValid) {
      throw new UnauthorizedException('Invalid password');
    }
  }

  /**
   * Get frontend URL.
   * @returns The frontend URL.
   */
  getFrontendUrl(): string {
    return this.configService.get<string>('app.frontendUrl') ?? 'http://localhost:3001';
  }

  /**
   * Issue a token pair.
   * @param userId The user ID.
   * @param email The user email.
   * @param role The user role.
   * @param res The response object.
   * @returns The tokens.
   */
  private async issueTokenPair(
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

  /**
   * Set the refresh cookie.
   * @param res The response object.
   * @param token The refresh token.
   */
  private setRefreshCookie(res: Response, token: string): void {
    const isProd = this.configService.get<string>('app.nodeEnv') === 'production';

    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE_NAME, {
      path: '/',
    });
  }

  /**
   * Parse an expiry string to a Date object.
   * @param expiry The expiry string (e.g., '30d').
   * @returns The Date object.
   */
  private parseExpiry(expiry: string): Date {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1), 10);

    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    const ms = (multipliers[unit] ?? 1000) * value;
    return new Date(Date.now() + ms);
  }
}
