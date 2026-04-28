import { UserResponse } from '@/common/types/user.types';
export { UserResponse };

export interface PaginatedUsers {
  items: UserResponse[];
  nextCursor: string | null;
  total: number;
}
