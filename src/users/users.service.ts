import { JwtPayload } from '@/auth/types/jwt-payload.type';
import { Prisma } from '@/generated/prisma/client';
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
    this.assertSelfOrAdmin(id, requester);

    try {
      return await this.usersRepository.update(id, dto);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }

  async updateRole(id: string, dto: UpdateRoleDto): Promise<UserResponse> {
    try {
      return await this.usersRepository.update(id, { role: dto.role });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.usersRepository.softDelete(id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }

  private assertSelfOrAdmin(targetId: string, requester: JwtPayload): void {
    if (requester.role !== Role.ADMIN && requester.sub !== targetId) {
      throw new ForbiddenException('Access denied');
    }
  }
}
