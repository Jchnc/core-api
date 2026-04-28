import { AuthUser } from '../auth.service';
import { UserDto } from '../dto/responses.dto';
import { Role } from '@/generated/prisma/enums';

export function toUserDto(user: AuthUser): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    isActive: user.isActive ?? true,
    isEmailVerified: user.isEmailVerified ?? false,
    createdAt: user.createdAt ?? new Date(),
    updatedAt: user.updatedAt ?? new Date(),
  };
}
