import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { JwtPayload } from '@/auth/types/jwt-payload.type';
import { Role } from '@/generated/prisma/client';
import { buildUser } from '@test/factories/user.factory';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

const buildRequester = (overrides: Partial<JwtPayload> = {}): JwtPayload => ({
  sub: 'requester-id',
  email: 'requester@example.com',
  role: Role.USER,
  ...overrides,
});

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<UsersRepository>;

  beforeEach(async () => {
    const repositoryMock: jest.Mocked<UsersRepository> = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByIdIncludingDeleted: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: UsersRepository, useValue: repositoryMock }],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(UsersRepository);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('delegates to repository and returns paginated result', async () => {
      const query = { limit: 20 };
      const expected = { items: [], nextCursor: null, total: 0 };
      repository.findAll.mockResolvedValue(expected);

      const result = await service.findAll(query);

      expect(result).toEqual(expected);
      expect(repository.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('allows admin to access any user', async () => {
      const target = buildUser({ id: 'other-user-id' });
      const admin = buildRequester({ role: Role.ADMIN });
      repository.findById.mockResolvedValue(target);

      const result = await service.findOne('other-user-id', admin);

      expect(result).toEqual(target);
    });

    it('allows user to access their own profile', async () => {
      const user = buildUser({ id: 'requester-id' });
      const requester = buildRequester({ sub: 'requester-id' });
      repository.findById.mockResolvedValue(user);

      const result = await service.findOne('requester-id', requester);

      expect(result).toEqual(user);
    });

    it('throws ForbiddenException when USER accesses another user', async () => {
      const requester = buildRequester({ sub: 'requester-id', role: Role.USER });

      await expect(service.findOne('different-user-id', requester)).rejects.toThrow(
        ForbiddenException,
      );

      expect(repository.findById).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when user does not exist', async () => {
      const admin = buildRequester({ role: Role.ADMIN });
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('ghost-id', admin)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('allows user to update their own name', async () => {
      const user = buildUser({ id: 'requester-id' });
      const requester = buildRequester({ sub: 'requester-id' });
      repository.findById.mockResolvedValue(user);
      repository.update.mockResolvedValue({ ...user, name: 'Updated Name' });

      const result = await service.update('requester-id', { name: 'Updated Name' }, requester);

      expect(result.name).toBe('Updated Name');
      expect(repository.update).toHaveBeenCalledWith('requester-id', {
        name: 'Updated Name',
      });
    });

    it('throws ForbiddenException when USER updates another user', async () => {
      const requester = buildRequester({ sub: 'requester-id', role: Role.USER });
      // Mock user existence so the check passes before the auth check
      repository.findById.mockResolvedValue(buildUser({ id: 'other-id' }));

      await expect(service.update('other-id', { name: 'Hacker' }, requester)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updateRole', () => {
    it('updates role when user exists', async () => {
      const user = buildUser();
      repository.findById.mockResolvedValue(user);
      repository.update.mockResolvedValue({ ...user, role: Role.ADMIN });

      const result = await service.updateRole(user.id, { role: Role.ADMIN });

      expect(result.role).toBe(Role.ADMIN);
    });

    it('throws NotFoundException when user does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.updateRole('ghost-id', { role: Role.ADMIN })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('soft deletes existing user', async () => {
      const user = buildUser();
      repository.findById.mockResolvedValue(user);
      repository.softDelete.mockResolvedValue(undefined);

      await service.remove(user.id);

      expect(repository.softDelete).toHaveBeenCalledWith(user.id);
    });

    it('throws NotFoundException for non-existent user', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove('ghost-id')).rejects.toThrow(NotFoundException);
    });
  });
});
