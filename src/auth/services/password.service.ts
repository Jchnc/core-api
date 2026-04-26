import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

import { HashingService } from './hashing.service';

import { TokenType } from '@/generated/prisma/enums';
import { MailService } from '@/mail';
import { PrismaService } from '@/prisma';
import { ForgotPasswordDto, ResetPasswordDto, SetPasswordDto } from '../dto';

@Injectable()
export class PasswordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly hashingService: HashingService,
  ) {}

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, name: true },
    });

    if (!user) return;

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

    const passwordHash = await this.hashingService.hash(dto.password);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: tokenRecord.user.id },
        data: { passwordHash },
      }),
      this.prisma.token.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.token.deleteMany({
        where: {
          userId: tokenRecord.user.id,
          type: TokenType.REFRESH,
        },
      }),
    ]);
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

    const passwordHash = await this.hashingService.hash(dto.password);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}
