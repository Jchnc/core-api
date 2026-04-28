import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ExchangeCodeDto {
  @ApiProperty({ description: 'The authorization code returned from OAuth callback' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
