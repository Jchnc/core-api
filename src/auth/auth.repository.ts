import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma';
import { Role } from '@/generated/prisma/enums';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  passwordHash: true,
  isActive: true,
  isEmailVerified: true,
  isTwoFactorEnabled: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: USER_SELECT,
    });
  }

  async findUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
  }

  async findUserByProviderId(providerId: string, provider: 'GOOGLE') {
    return this.prisma.user.findFirst({
      where: {
        oauthAccounts: {
          some: {
            provider,
            providerId,
          },
        },
      },
      select: USER_SELECT,
    });
  }

  async createUser(data: { email: string; name: string; passwordHash: string; role?: Role }) {
    return this.prisma.user.create({
      data,
      select: USER_SELECT,
    });
  }

  async createUserWithOAuth(data: {
    email: string;
    name: string;
    provider: 'GOOGLE';
    providerId: string;
    isEmailVerified: boolean;
  }) {
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        isEmailVerified: data.isEmailVerified,
        oauthAccounts: {
          create: {
            provider: data.provider,
            providerId: data.providerId,
          },
        },
      },
      select: USER_SELECT,
    });
  }

  async linkOAuthProvider(userId: string, provider: 'GOOGLE', providerId: string) {
    return this.prisma.oAuthAccount.create({
      data: {
        userId,
        provider,
        providerId,
      },
    });
  }

  async updateTwoFactor(userId: string, enabled: boolean) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isTwoFactorEnabled: enabled },
    });
  }

  async deleteTokenById(tokenId: string) {
    return this.prisma.token.delete({ where: { id: tokenId } });
  }

  async markTokenAsUsed(tokenId: string) {
    return this.prisma.token.update({
      where: { id: tokenId },
      data: { usedAt: new Date() },
    });
  }

  async createOAuthCode(userId: string, code: string, expiresAt: Date) {
    return this.prisma.token.create({
      data: {
        token: code,
        type: 'OAUTH_CODE',
        userId,
        expiresAt,
      },
    });
  }

  async findAndDeleteOAuthCode(code: string) {
    const token = await this.prisma.token.findFirst({
      where: { token: code, type: 'OAUTH_CODE' },
      select: { id: true, userId: true, expiresAt: true },
    });

    if (token) {
      await this.prisma.token.delete({ where: { id: token.id } });
    }

    return token;
  }
}
