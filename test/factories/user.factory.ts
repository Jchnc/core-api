import { Role } from '@/generated/prisma/client';

export interface MockUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  isEmailVerified: boolean;
  isTwoFactorEnabled: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function buildUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 'uuid-user-1',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: '$2b$12$hashedpassword',
    role: Role.USER,
    isActive: true,
    isEmailVerified: false,
    isTwoFactorEnabled: false,
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export function buildAdminUser(overrides: Partial<MockUser> = {}): MockUser {
  return buildUser({ role: Role.ADMIN, ...overrides });
}
