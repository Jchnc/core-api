import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../generated/prisma/client';
import {
  UpdateRoleDto,
  UpdateUserDto,
  UsersQueryDto,
  PaginatedUsersResponseDto,
  UserSingleResponseDto,
} from './dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /api/v1/users
  @Roles(Role.ADMIN)
  @Get()
  @ApiOperation({ summary: 'List all users with cursor-based pagination' })
  @ApiResponse({ status: 200, description: 'Paginated user list' })
  async findAll(@Query() query: UsersQueryDto): Promise<PaginatedUsersResponseDto> {
    const result = await this.usersService.findAll(query);
    return { data: result };
  }

  // GET /api/v1/users/:id
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (admin or self)' })
  @ApiResponse({ status: 200, description: 'User data' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<UserSingleResponseDto> {
    const user = await this.usersService.findOne(id, requester);
    return { data: user };
  }

  // PATCH /api/v1/users/:id
  @Patch(':id')
  @ApiOperation({ summary: 'Update user name (admin or self)' })
  @ApiResponse({ status: 200, description: 'Updated user' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() requester: JwtPayload,
  ): Promise<UserSingleResponseDto> {
    const user = await this.usersService.update(id, dto, requester);
    return { data: user, message: 'User updated successfully' };
  }

  // PATCH /api/v1/users/:id/role
  @Roles(Role.ADMIN)
  @Patch(':id/role')
  @ApiOperation({ summary: 'Update user role (admin only)' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<UserSingleResponseDto> {
    const user = await this.usersService.updateRole(id, dto);
    return { data: user, message: 'Role updated successfully' };
  }

  // DELETE /api/v1/users/:id
  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete user (admin only)' })
  @ApiResponse({ status: 204, description: 'User deleted' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.usersService.remove(id);
  }
}
