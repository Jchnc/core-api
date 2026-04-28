import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'john@example.com' })
  @Transform(({ value }: { value: string }) => value.toLowerCase().trim())
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'P@ssw0rd123!', minLength: 8, maxLength: 64 })
  @IsString()
  @MinLength(8, {
    message: 'password must be at least 8 characters long',
  })
  @MaxLength(64, {
    message: 'password must be at most 64 characters long',
  })
  password!: string;
}
