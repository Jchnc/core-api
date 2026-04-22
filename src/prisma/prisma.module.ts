import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAdapter } from '@/config';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService): Promise<PrismaService> => {
        const databaseUrl = configService.getOrThrow<string>('app.databaseUrl');
        const nodeEnv = configService.get<string>('app.nodeEnv', 'development');
        const adapter = await createAdapter(databaseUrl);
        return new PrismaService(adapter, nodeEnv);
      },
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
