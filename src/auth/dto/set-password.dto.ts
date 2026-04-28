import { IsStrongPassword } from '@/common/validators/strong-password.validator';

export class SetPasswordDto {
  @IsStrongPassword()
  password!: string;
}
