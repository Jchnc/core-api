import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@/generated/prisma/client';

export class UserDto {
  id!: string;
  email!: string;
  name!: string;
  role!: Role;
  isActive!: boolean;
  isEmailVerified!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

export class AuthTokensDto {
  access_token!: string;
}

export class LoginResponseDto extends AuthTokensDto {
  user!: UserDto;

  @ApiPropertyOptional({ description: 'Included if 2FA is required' })
  requires_2fa?: boolean;

  @ApiPropertyOptional({ description: 'Included if 2FA is required' })
  two_factor_token?: string;
}

export class GenericResponseDto<T> {
  data!: T;
  message?: string;
}

export class UserResponseDto {
  data!: UserDto;
  message?: string;
}

export class LoginGenericResponseDto {
  data!: LoginResponseDto;
  message?: string;
}

export class TokensResponseDto {
  data!: AuthTokensDto;
  message?: string;
}

export class NullResponseDto {
  @ApiProperty({ example: null, nullable: true })
  data!: any;
  message?: string;
}
