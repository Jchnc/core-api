import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma';
import { UsersQueryDto } from './dto';
import { PaginatedUsers, UserResponse } from './types/user-response.type';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  isEmailVerified: true,
  isTwoFactorEnabled: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

function encodeCursor(id: string, createdAt: Date): string {
  return Buffer.from(JSON.stringify({ id, createdAt: createdAt.toISOString() })).toString(
    'base64url',
  );
}

interface CursorPayload {
  id: string;
  createdAt: string;
}

function isCursorPayload(value: unknown): value is CursorPayload {
  return (
    typeof value === 'object'
    && value !== null
    && 'id' in value
    && 'createdAt' in value
    && typeof (value as Record<string, unknown>).id === 'string'
    && typeof (value as Record<string, unknown>).createdAt === 'string'
  );
}

function decodeCursor(cursor: string): { id: string; createdAt: Date } | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (isCursorPayload(parsed)) {
      return { id: parsed.id, createdAt: new Date(parsed.createdAt) };
    }
    return null;
  } catch {
    return null;
  }
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: UsersQueryDto): Promise<PaginatedUsers> {
    const { limit, cursor, search } = query;

    // Decode self-contained cursor — no extra DB query needed
    const cursorData = cursor ? decodeCursor(cursor) : null;

    const conditions: Prisma.UserWhereInput[] = [{ deletedAt: null }];

    if (search) {
      conditions.push({
        OR: [{ name: { contains: search } }, { email: { contains: search } }],
      });
    }

    if (cursorData) {
      conditions.push({
        OR: [
          { createdAt: { lt: cursorData.createdAt } },
          { createdAt: cursorData.createdAt, id: { lt: cursorData.id } },
        ],
      });
    }

    const where: Prisma.UserWhereInput = { AND: conditions };

    const countWhere: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(search && {
        OR: [{ name: { contains: search } }, { email: { contains: search } }],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        take: limit + 1,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.user.count({ where: countWhere }),
    ]);

    const hasNextPage = items.length > limit;
    const page = hasNextPage ? items.slice(0, limit) : items;

    return {
      items: page,
      nextCursor: hasNextPage ? encodeCursor(page.at(-1)!.id, page.at(-1)!.createdAt) : null,
      total,
    };
  }

  async findById(id: string): Promise<UserResponse | null> {
    return this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: USER_SELECT,
    });
  }

  async findByIdIncludingDeleted(id: string): Promise<UserResponse | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<UserResponse> {
    return this.prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      }),
      this.prisma.token.deleteMany({ where: { userId: id } }),
    ]);
  }
}
