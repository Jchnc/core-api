import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus';

import { Public } from '@/common/decorators/public.decorator';
import { PrismaService } from '@/prisma';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private prismaHealth: PrismaHealthIndicator,
    private prisma: PrismaService,
  ) {}

  // Liveness probe - Tells Kubernetes the app is running and hasn't crashed
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe' })
  checkLiveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  // Readiness probe - Tells Kubernetes the app is ready to accept traffic (dependencies are up)
  @Public()
  @Get('readiness')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe' })
  checkReadiness() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      // Set reasonable memory threshold (150MB) for a basic Node.js process
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
    ]);
  }
}
