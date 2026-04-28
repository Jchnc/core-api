import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { SqlDriverAdapterFactory } from '@prisma/driver-adapter-utils';
import { PrismaClient } from '@/generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(adapter: SqlDriverAdapterFactory, nodeEnv: string) {
    super({
      adapter,
      log: nodeEnv === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
