import { Test, TestingModule } from '@nestjs/testing';

import { UsersRepository } from './users.repository';
import { PrismaService } from '../prisma';
import { buildPrismaMock, PrismaMock } from '@test/mocks/prisma.mock';
import { buildUser } from '@test/factories/user.factory';
import { UserResponse } from './types/user-response.type';

function encodeTestCursor(user: UserResponse): string {
  return Buffer.from(
    JSON.stringify({ id: user.id, createdAt: user.createdAt.toISOString() }),
  ).toString('base64url');
}

describe('UsersRepository', () => {
  let repository: UsersRepository;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = buildPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersRepository, { provide: PrismaService, useValue: prisma }],
    }).compile();

    repository = module.get<UsersRepository>(UsersRepository);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('returns paginated users with nextCursor when more results exist', async () => {
      const users = Array.from({ length: 21 }, (_, i) =>
        buildUser({ id: `uuid-${i}`, email: `user${i}@example.com` }),
      );

      prisma.$transaction.mockResolvedValue([users, 50]);

      const result = await repository.findAll({ limit: 20 });

      expect(result.items).toHaveLength(20);
      // nextCursor encodes the last item of the page (users[19], 0-indexed)
      const lastPageUser = users[19];
      expect(result.nextCursor).toBe(encodeTestCursor(lastPageUser));
      expect(result.total).toBe(50);
    });

    it('returns null nextCursor when no more results', async () => {
      const users = Array.from({ length: 5 }, (_, i) =>
        buildUser({ id: `uuid-${i}`, email: `user${i}@example.com` }),
      );

      prisma.$transaction.mockResolvedValue([users, 5]);

      const result = await repository.findAll({ limit: 20 });

      expect(result.items).toHaveLength(5);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns user when found and not deleted', async () => {
      const user = buildUser();
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await repository.findById(user.id);

      expect(result).toEqual(user);
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: user.id, deletedAt: null },
        }),
      );
    });

    it('returns null when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findById('ghost-id');

      expect(result).toBeNull();
    });
  });

  describe('findByIdIncludingDeleted', () => {
    it('returns user without filtering by deletedAt', async () => {
      const user = buildUser({ deletedAt: new Date() });
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await repository.findByIdIncludingDeleted(user.id);

      expect(result).toEqual(user);
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: user.id },
        }),
      );
      // Verify it does NOT filter by deletedAt (unlike findById)
      const callArgs = prisma.user.findUnique.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(callArgs.where).not.toHaveProperty('deletedAt');
    });

    it('returns null when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findByIdIncludingDeleted('ghost-id');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('updates and returns user with safe fields', async () => {
      const user = buildUser();
      const updatedUser = { ...user, name: 'Updated Name' };
      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await repository.update(user.id, { name: 'Updated Name' });

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: user.id },
          data: { name: 'Updated Name' },
        }),
      );
    });
  });

  describe('softDelete', () => {
    it('sets deletedAt, marks inactive, and revokes tokens', async () => {
      prisma.user.update.mockResolvedValue({});
      prisma.token.deleteMany.mockResolvedValue({ count: 2 });

      await repository.softDelete('user-id');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          isActive: false,
        }),
      });
      expect(prisma.token.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
      });
    });
  });
});
