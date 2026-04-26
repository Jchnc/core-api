import { UserDto } from '@/auth/dto/responses.dto';

export class PaginatedUsersDto {
  items!: UserDto[];
  nextCursor!: string | null;
  total!: number;
}

export class PaginatedUsersResponseDto {
  data!: PaginatedUsersDto;
  message?: string;
}

export class UserSingleResponseDto {
  data!: UserDto;
  message?: string;
}
