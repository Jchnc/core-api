import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export function IsStrongPassword() {
  return applyDecorators(
    ApiProperty({ example: 'P@ssw0rd123!', minLength: 8, maxLength: 64 }),
    IsString(),
    MinLength(8, { message: 'password must be at least 8 characters long' }),
    MaxLength(64, { message: 'password must be at most 64 characters long' }),
    Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, {
      message:
        'password must contain at least one uppercase letter, one lowercase letter, one number and one special character',
    }),
  );
}
