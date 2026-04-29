import { JwtPayload } from '@/auth/types/jwt-payload.type';
import { Role } from '@/generated/prisma/client';
import { PaginatedUsers, UserResponse } from '@/users/types/user-response.type';
import { UsersRepository } from '@/users/users.repository';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateRoleDto, UpdateUserDto, UsersQueryDto } from './dto';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findAll(query: UsersQueryDto): Promise<PaginatedUsers> {
    return this.usersRepository.findAll(query);
  }

  async findOne(id: string, requester: JwtPayload): Promise<UserResponse> {
    this.assertSelfOrAdmin(id, requester);

    const user = await this.usersRepository.findById(id);

    if (!user) throw new NotFoundException('User not found');

    return user;
  }

  async update(id: string, dto: UpdateUserDto, requester: JwtPayload): Promise<UserResponse> {
    const existing = await this.usersRepository.findById(id);
    if (!existing) throw new NotFoundException('User not found');

    this.assertSelfOrAdmin(id, requester);

    return this.usersRepository.update(id, dto);
  }

  async updateRole(id: string, dto: UpdateRoleDto): Promise<UserResponse> {
    const existing = await this.usersRepository.findById(id);
    if (!existing) throw new NotFoundException('User not found');

    return this.usersRepository.update(id, { role: dto.role });
  }

  async remove(id: string): Promise<void> {
    const existing = await this.usersRepository.findById(id);
    if (!existing) throw new NotFoundException('User not found');

    await this.usersRepository.softDelete(id);
  }

  private assertSelfOrAdmin(targetId: string, requester: JwtPayload): void {
    if (requester.role !== Role.ADMIN && requester.sub !== targetId) {
      throw new ForbiddenException('Access denied');
    }
  }
}
