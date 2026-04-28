import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import type { StringValue } from 'ms';

import { Role } from '@/generated/prisma/enums';
import { AuthRepository } from './auth.repository';
import { MailService } from '@/mail';
import { LoginDto, RegisterDto } from './dto';
import { TwoFactorService } from './two-factor.service';
import { TokenService } from './services/token.service';
import { HashingService } from './services/hashing.service';
import { OAuthUserPayload } from './types/google-profile.type';
import { JwtPayload, JwtRefreshPayload } from './types/jwt-payload.type';
import { randomUUID } from 'crypto';
import type { TwoFactorRequiredResponse } from './types/two-factor.types';
import { AuthTokens } from './types/auth-tokens.type';

import { AuthUser } from '@/common/types/user.types';
@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly twoFactorService: TwoFactorService,
    private readonly tokenService: TokenService,
    private readonly hashingService: HashingService,
  ) {}

  /**
   * Register a new user and send welcome email.
   * @param dto The user registration data.
   * @returns The registered user.
   * @throws {ConflictException} If the email is already registered.
   */
  async register(dto: RegisterDto): Promise<AuthUser> {
    const existing = await this.authRepository.findUserByEmail(dto.email);

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await this.hashingService.hash(dto.password);

    const user = await this.authRepository.createUser({
      email: dto.email,
      name: dto.name,
      passwordHash,
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
    const user = await this.authRepository.findUserByEmail(dto.email);

    if (!user) {
      // Constant-time response to prevent user enumeration
      await this.hashingService.hash(dto.password);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    const isPasswordValid =
      user.passwordHash ? await this.hashingService.verify(user.passwordHash, dto.password) : false;

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isTwoFactorEnabled) {
      const isTrusted = await this.twoFactorService.isTrustedDevice(user.id, req);

      if (!isTrusted) {
        return this.twoFactorService.initiate(user.id, user.email, user.name);
      }
    }

    const tokens = await this.tokenService.issueTokenPair(user.id, user.email, user.role, res);

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
    await this.authRepository.deleteTokenById(tokenId);
    this.tokenService.clearRefreshCookie(res);
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
    await this.authRepository.markTokenAsUsed(payload.tokenId);

    const user = await this.authRepository.findUserById(payload.sub);

    if (!user) throw new UnauthorizedException('User not found');

    return this.tokenService.issueTokenPair(user.id, user.email, user.role, res);
  }

  /**
   * Get current user.
   * @param userId The user ID.
   * @returns The user.
   * @throws {NotFoundException} If the user is not found.
   */
  async getCurrentUser(userId: string): Promise<AuthUser> {
    const user = await this.authRepository.findUserById(userId);

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

  async verifySession(
    userId: string,
    email: string,
    role: Role,
    user: AuthUser,
  ): Promise<AuthTokens & { user: AuthUser }> {
    const dbUser = await this.authRepository.findUserById(userId);

    if (!dbUser?.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

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
  ): Promise<{ auth_code: string } | TwoFactorRequiredResponse> {
    let user = await this.authRepository.findUserByProviderId(payload.providerId, 'GOOGLE');

    if (user) {
      if (!user.isActive) {
        throw new UnauthorizedException('Account is disabled');
      }
    } else {
      // Create user and link OAuth provider
      const existingEmail = await this.authRepository.findUserByEmail(payload.email);

      if (existingEmail) {
        // Link to existing user by email
        user = existingEmail;
        await this.authRepository.linkOAuthProvider(user.id, 'GOOGLE', payload.providerId);
      } else {
        // First time: create user + OAuth account
        user = await this.authRepository.createUserWithOAuth({
          email: payload.email,
          name: payload.name,
          provider: 'GOOGLE',
          providerId: payload.providerId,
          isEmailVerified: payload.isEmailVerified,
        });
      }
    }

    if (user.isTwoFactorEnabled) {
      const isTrusted = await this.twoFactorService.isTrustedDevice(user.id, req);

      if (!isTrusted) {
        return this.twoFactorService.initiate(user.id, user.email, user.name);
      }
    }

    const authCode = randomUUID();
    // Valid for 60 seconds
    const expiresAt = new Date(Date.now() + 60_000);

    await this.authRepository.createOAuthCode(user.id, authCode, expiresAt);

    return { auth_code: authCode };
  }

  async exchangeOAuthCode(code: string, res: Response): Promise<AuthTokens & { user: AuthUser }> {
    const tokenRecord = await this.authRepository.findAndDeleteOAuthCode(code);

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired authorization code');
    }

    const user = await this.authRepository.findUserById(tokenRecord.userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const tokens = await this.tokenService.issueTokenPair(user.id, user.email, user.role, res);

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

    const user = await this.authRepository.findUserById(userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    if (trustDevice) {
      await this.twoFactorService.setTrustedDevice(user.id, req, res);
    }

    const tokens = await this.tokenService.issueTokenPair(user.id, user.email, user.role, res);
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

    await this.authRepository.updateTwoFactor(userId, true);
  }

  async disableTwoFactor(userId: string, password: string, res: Response): Promise<void> {
    await this.verifyPasswordForUser(userId, password);

    await this.authRepository.updateTwoFactor(userId, false);
    await this.twoFactorService.revokeTrustedDevices(userId, res);
  }

  private async verifyPasswordForUser(userId: string, password: string): Promise<void> {
    const user = await this.authRepository.findUserById(userId);

    if (!user?.passwordHash) {
      throw new BadRequestException('Password confirmation is required');
    }

    const isValid = await this.hashingService.verify(user.passwordHash, password);

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
}
