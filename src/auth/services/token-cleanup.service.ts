import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma';

@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanup(): Promise<void> {
    this.logger.log('Starting stale token cleanup...');
    const now = new Date();

    try {
      const tokens = await this.prisma.token.deleteMany({
        where: { expiresAt: { lt: now } },
      });
      this.logger.log(`Deleted ${tokens.count} expired tokens.`);

      const sessions = await this.prisma.twoFactorSession.deleteMany({
        where: { expiresAt: { lt: now } },
      });
      this.logger.log(`Deleted ${sessions.count} expired 2FA sessions.`);

      const devices = await this.prisma.trustedDevice.deleteMany({
        where: { expiresAt: { lt: now } },
      });
      this.logger.log(`Deleted ${devices.count} expired trusted devices.`);
    } catch (error) {
      this.logger.error('Failed to run token cleanup job', error);
    }
  }
}
