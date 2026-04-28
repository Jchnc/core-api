import { Role } from '@/generated/prisma/enums';

export interface BaseUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface UserResponse extends BaseUser {
  isActive: boolean;
  isEmailVerified: boolean;
  isTwoFactorEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthUser extends BaseUser {
  isActive?: boolean;
  isEmailVerified?: boolean;
  isTwoFactorEnabled?: boolean;
  hasPassword?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
