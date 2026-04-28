import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { IsStrongPassword } from '@/common/validators/strong-password.validator';

export class ResetPasswordDto {
  @ApiProperty()
  @IsUUID(4)
  token!: string;

  @IsStrongPassword()
  password!: string;
}
