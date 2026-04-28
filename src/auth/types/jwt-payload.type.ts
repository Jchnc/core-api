import { Role } from '@/generated/prisma/enums';
import type { AuthUser } from '@/common/types/user.types';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload extends JwtPayload {
  tokenId: string;
}

export interface JwtRefreshPayloadWithUser extends JwtRefreshPayload {
  user: AuthUser;
}
