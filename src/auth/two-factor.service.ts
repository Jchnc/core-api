import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail';
import { PrismaService } from '../prisma';
import { HashingService } from './services/hashing.service';
import { randomInt, randomUUID } from 'crypto';
import { Request, Response } from 'express';
import * as UAParser from 'ua-parser-js';
import type { TwoFactorRequiredResponse } from './types/two-factor.types';

const TRUSTED_COOKIE = 'trusted_device';
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly hashingService: HashingService,
  ) {}

  /**
   * Initiates a 2FA session for the user
   * @param userId The ID of the user
   * @param userEmail The email of the user
   * @param userName The name of the user
   * @returns An object containing a flag indicating whether 2FA is required and the 2FA session token
   */
  async initiate(
    userId: string,
    userEmail: string,
    userName: string,
  ): Promise<TwoFactorRequiredResponse> {
    const ttl = this.configService.get<number>('security.twoFactor.codeTtl', 600);

    await this.prisma.twoFactorSession.deleteMany({
      where: { userId, verifiedAt: null },
    });

    const rawCode = String(randomInt(100_000, 999_999));
    const codeHash = await this.hashingService.hash(rawCode);
    const sessionToken = randomUUID();

    await this.prisma.twoFactorSession.create({
      data: {
        id: sessionToken,
        codeHash,
        userId,
        expiresAt: new Date(Date.now() + ttl * 1_000),
      },
    });

    await this.mailService.sendTwoFactorCode(userEmail, {
      name: userName,
      code: rawCode,
      expiresInMinutes: Math.floor(ttl / 60),
    });

    return { requires_2fa: true, two_factor_token: sessionToken };
  }

  /**
   * Verifies the 2FA code and returns the user ID.
   * @param twoFactorToken The 2FA session token
   * @param rawCode The raw 2FA code
   * @returns The user ID associated with the verified session
   */
  async verify(twoFactorToken: string, rawCode: string): Promise<{ userId: string }> {
    const maxAttempts = this.configService.get<number>('security.twoFactor.maxAttempts', 5);

    const session = await this.prisma.twoFactorSession.findUnique({
      where: { id: twoFactorToken },
      select: {
        id: true,
        codeHash: true,
        attempts: true,
        verifiedAt: true,
        expiresAt: true,
        userId: true,
      },
    });

    if (!session || session.verifiedAt !== null) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.twoFactorSession.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Verification code expired');
    }

    if (session.attempts >= maxAttempts) {
      await this.prisma.twoFactorSession.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Too many failed attempts. Please log in again.');
    }

    const isValid = await this.hashingService.verify(session.codeHash, rawCode);

    if (!isValid) {
      await this.prisma.twoFactorSession.update({
        where: { id: session.id },
        data: { attempts: { increment: 1 } },
      });

      const remaining = maxAttempts - (session.attempts + 1);

      throw new UnauthorizedException(
        `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      );
    }

    await this.prisma.twoFactorSession.delete({ where: { id: session.id } });

    return { userId: session.userId };
  }

  /**
   * Checks if the current browser/device is trusted for the user
   * @param userId The ID of the user
   * @param req Request object
   * @returns True if the device is trusted, false otherwise
   */
  async isTrustedDevice(userId: string, req: Request): Promise<boolean> {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const rawToken = cookies?.[TRUSTED_COOKIE];

    if (typeof rawToken !== 'string' || !UUID_V4_REGEX.test(rawToken)) return false;

    const devices = await this.prisma.trustedDevice.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: { tokenHash: true },
    });

    if (devices.length === 0) return false;

    const results = await Promise.all(
      devices.map((d) => this.hashingService.verify(d.tokenHash, rawToken)),
    );
    return results.some(Boolean);
  }

  /**
   * Marks the current browser/device as trusted for the user
   * @param userId The ID of the user
   * @param req Request object
   * @param res Response object
   */
  async setTrustedDevice(userId: string, req: Request, res: Response): Promise<void> {
    const ttlDays = this.configService.get<number>('security.twoFactor.trustedDeviceTtlDays', 30);
    const isProd = this.configService.get<string>('app.nodeEnv') === 'production';

    const rawToken = randomUUID();
    const tokenHash = await this.hashingService.hash(rawToken);

    const ua = new UAParser.UAParser(req.headers['user-agent']);
    const browser = ua.getBrowser().name ?? 'Unknown Browser';
    const os = ua.getOS().name ?? 'Unknown OS';
    const deviceLabel = `${browser} on ${os}`;

    const existing = await this.prisma.trustedDevice.count({ where: { userId } });
    const MAX_DEVICES = 10;
    if (existing >= MAX_DEVICES) {
      // Delete oldest to make room for the new one
      const oldest = await this.prisma.trustedDevice.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        take: existing - MAX_DEVICES + 1,
        select: { id: true },
      });
      await this.prisma.trustedDevice.deleteMany({
        where: { id: { in: oldest.map((d) => d.id) } },
      });
    }

    await this.prisma.trustedDevice.create({
      data: {
        tokenHash,
        deviceLabel,
        userId,
        expiresAt: new Date(Date.now() + ttlDays * 86_400_000),
      },
    });

    res.cookie(TRUSTED_COOKIE, rawToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: ttlDays * 86_400_000,
    });
  }

  async revokeTrustedDevices(userId: string, res: Response): Promise<void> {
    await this.prisma.trustedDevice.deleteMany({ where: { userId } });
    res.clearCookie(TRUSTED_COOKIE);
  }
}
