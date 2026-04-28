import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserDto } from '@/auth/dto/responses.dto';

export class PaginatedUsersDto {
  @ApiProperty({ type: [UserDto] }) items!: UserDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty() total!: number;
}

export class PaginatedUsersResponseDto {
  @ApiProperty({ type: PaginatedUsersDto }) data!: PaginatedUsersDto;
  @ApiPropertyOptional() message?: string;
}

export class UserSingleResponseDto {
  @ApiProperty({ type: UserDto }) data!: UserDto;
  @ApiPropertyOptional() message?: string;
}
