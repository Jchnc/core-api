import { AuthUser } from '@/common/types/user.types';
import { UserDto } from '../dto/responses.dto';

export function toUserDto(user: AuthUser): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive ?? true,
    isEmailVerified: user.isEmailVerified ?? false,
    createdAt: user.createdAt ?? new Date(),
    updatedAt: user.updatedAt ?? new Date(),
  };
}
