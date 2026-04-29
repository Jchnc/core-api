import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@/generated/prisma/enums';

export class UserDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: Role }) role!: Role;
  @ApiProperty() isActive?: boolean;
  @ApiProperty() isEmailVerified?: boolean;
  @ApiProperty() createdAt?: Date;
  @ApiProperty() updatedAt?: Date;
}

export class AuthTokensDto {
  @ApiProperty() access_token?: string;
}

export class LoginResponseDto extends AuthTokensDto {
  @ApiProperty({ type: UserDto }) user?: UserDto;

  @ApiPropertyOptional({ description: 'Included if 2FA is required' })
  requires_2fa?: boolean;

  @ApiPropertyOptional({ description: 'Included if 2FA is required' })
  two_factor_token?: string;
}

export class GenericResponseDto<T> {
  data!: T;
  @ApiPropertyOptional() message?: string;
}

export class UserResponseDto {
  @ApiProperty({ type: UserDto }) data!: UserDto;
  @ApiPropertyOptional() message?: string;
}

export class LoginGenericResponseDto {
  @ApiProperty({ type: LoginResponseDto }) data!: LoginResponseDto;
  @ApiPropertyOptional() message?: string;
}

export class TokensResponseDto {
  @ApiProperty({ type: AuthTokensDto }) data!: AuthTokensDto;
  @ApiPropertyOptional() message?: string;
}

export class NullResponseDto {
  @ApiProperty({ example: null, nullable: true, type: Object })
  data!: null;
  @ApiPropertyOptional() message?: string;
}
