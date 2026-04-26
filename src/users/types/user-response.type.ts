import { Role } from '@/generated/prisma/client';

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  isEmailVerified: boolean;
  isTwoFactorEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedUsers {
  items: UserResponse[];
  nextCursor: string | null;
  total: number;
}
