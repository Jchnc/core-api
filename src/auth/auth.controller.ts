import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';

import { seconds, SkipThrottle, Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { PasswordService } from './services/password.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  SetPasswordDto,
  UserResponseDto,
  LoginGenericResponseDto,
  NullResponseDto,
  TokensResponseDto,
  ExchangeCodeDto,
} from './dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { JwtPayload, JwtRefreshPayload, JwtRefreshPayloadWithUser } from './types/jwt-payload.type';

import { GoogleGuard } from './guards/google.guard';
import type { OAuthUserPayload } from './types/google-profile.type';

import { ConfirmPasswordDto, VerifyTwoFactorDto } from './dto';
import { toUserDto } from './mappers/user.mapper';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordService: PasswordService,
  ) {}

  // POST /api/v1/auth/register
  @Public()
  @Post('register')
  @Throttle({ short: { ttl: seconds(60), limit: 5 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() dto: RegisterDto): Promise<UserResponseDto> {
    const user = await this.authService.register(dto);
    return {
      data: toUserDto(user),
      message: 'User registered successfully',
    };
  }

  // POST /api/v1/auth/login
  @Public()
  @Post('login')
  @Throttle({ short: { ttl: seconds(60), limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginGenericResponseDto> {
    const result = await this.authService.login(dto, req, res);

    if ('requires_2fa' in result) {
      return {
        data: result as unknown as LoginGenericResponseDto['data'],
        message: '2FA required',
      };
    }

    return {
      data: {
        access_token: result.access_token,
        user: toUserDto(result.user),
      },
      message: 'Login successful',
    };
  }

  // POST /api/v1/auth/logout
  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  async logout(
    @CurrentUser() user: JwtRefreshPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<NullResponseDto> {
    await this.authService.logout(user.tokenId, res);
    return { data: null, message: 'Logged out successfully' };
  }

  // POST /api/v1/auth/refresh
  @Public()
  @UseGuards(JwtRefreshGuard)
  @SkipThrottle({ short: true, medium: true, long: true })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and get new access token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @CurrentUser() payload: JwtRefreshPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokensResponseDto> {
    const tokens = await this.authService.refresh(payload, res);
    return { data: tokens, message: 'Tokens refreshed' };
  }

  // POST /api/v1/auth/forgot-password
  @Public()
  @Post('forgot-password')
  @Throttle({ short: { ttl: seconds(60), limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<NullResponseDto> {
    await this.passwordService.forgotPassword(dto);
    return {
      data: null,
      message: 'If that email is registered, a reset link has been sent',
    };
  }

  // POST /api/v1/auth/reset-password
  @Public()
  @Post('reset-password')
  @Throttle({ short: { ttl: seconds(60), limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token from email' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<NullResponseDto> {
    await this.passwordService.resetPassword(dto);
    return { data: null, message: 'Password reset successfully' };
  }

  // GET /api/v1/auth/me
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user data' })
  async me(@CurrentUser() user: JwtRefreshPayload): Promise<UserResponseDto> {
    const currentUser = await this.authService.getCurrentUser(user.sub);
    return { data: toUserDto(currentUser) };
  }

  // POST /api/v1/auth/session
  @Public()
  @UseGuards(JwtRefreshGuard)
  @SkipThrottle({ short: true, medium: true, long: true })
  @Post('session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify session and get fresh access token (no token rotation)' })
  @ApiResponse({ status: 200, description: 'Session verified' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async session(@CurrentUser() payload: JwtRefreshPayloadWithUser): Promise<TokensResponseDto> {
    const result = await this.authService.verifySession(
      payload.sub,
      payload.email,
      payload.role,
      payload.user,
    );
    return { data: result };
  }

  // GET /api/v1/auth/google
  @Public()
  @UseGuards(GoogleGuard)
  @Get('google')
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  googleLogin(): void {
    // Guard redirects to Google — no body needed
  }

  // GET /api/v1/auth/google/callback
  @Public()
  @UseGuards(GoogleGuard)
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(
    @CurrentUser() oauthPayload: OAuthUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.authService.loginWithOAuth(oauthPayload, req);
    const frontendUrl = this.authService.getFrontendUrl();

    if ('requires_2fa' in result) {
      const params = new URLSearchParams({
        two_factor_token: result.two_factor_token,
      });
      res.redirect(`${frontendUrl}/2fa/verify?${params.toString()}`);
      return;
    }

    const params = new URLSearchParams({ code: result.auth_code });
    res.redirect(`${frontendUrl}/api/auth/oauth/callback?${params.toString()}`);
  }

  // POST /api/v1/auth/oauth/exchange
  @Public()
  @Post('oauth/exchange')
  @Throttle({ short: { ttl: seconds(60), limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange OAuth code for tokens' })
  @ApiResponse({
    status: 200,
    description: 'Code exchanged for tokens',
    type: LoginGenericResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired code' })
  async exchangeOAuthCode(
    @Body() dto: ExchangeCodeDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginGenericResponseDto> {
    const result = await this.authService.exchangeOAuthCode(dto.code, res);

    return {
      data: {
        access_token: result.access_token,
        user: toUserDto(result.user),
      },
    };
  }

  // POST /api/v1/auth/2fa/verify
  @Public()
  @Post('2fa/verify')
  @Throttle({ short: { ttl: seconds(60), limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify 2FA code and complete login' })
  async verifyTwoFactor(
    @Body() dto: VerifyTwoFactorDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginGenericResponseDto> {
    const result = await this.authService.completeTwoFactor(
      dto.two_factor_token,
      dto.code,
      dto.trust_device ?? false,
      req,
      res,
    );

    if ('requires_2fa' in result) {
      return {
        data: result as unknown as LoginGenericResponseDto['data'],
        message: '2FA required',
      };
    }

    return {
      data: {
        access_token: result.access_token,
        user: toUserDto(result.user),
      },
      message: 'Login successful',
    };
  }

  // POST /api/v1/auth/2fa/enable
  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable 2FA for current user (requires password confirmation)' })
  async enableTwoFactor(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ConfirmPasswordDto,
  ): Promise<NullResponseDto> {
    await this.authService.enableTwoFactor(user.sub, dto.password);
    return { data: null, message: 'Two-factor authentication enabled' };
  }

  // POST /api/v1/auth/2fa/disable
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Disable 2FA and revoke trusted devices (requires password confirmation)',
  })
  async disableTwoFactor(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ConfirmPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<NullResponseDto> {
    await this.authService.disableTwoFactor(user.sub, dto.password, res);
    return { data: null, message: 'Two-factor authentication disabled' };
  }

  // POST /api/v1/auth/set-password
  @Post('set-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set password for OAuth-only accounts' })
  async setPassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SetPasswordDto,
  ): Promise<NullResponseDto> {
    await this.passwordService.setPassword(user.sub, dto);
    return { data: null, message: 'Password set successfully' };
  }
}
