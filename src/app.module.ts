import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { minutes, seconds, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import 'dotenv/config';

import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';

import { AllExceptionsFilter } from '@/common/filters/http-exception.filter';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { appConfig, jwtConfig, mailConfig, securityConfig, validateEnv } from '@/config';
import { PrismaModule } from '@/prisma';
import { AuthModule } from '@/auth';
import { UsersModule } from '@/users';

@Module({
  imports: [
    AuthModule,
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [appConfig, jwtConfig, mailConfig, securityConfig],
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: seconds(1), limit: 5 },
        { name: 'medium', ttl: seconds(10), limit: 20 },
        { name: 'long', ttl: minutes(1), limit: 100 },
      ],
    }),
    PrismaModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    ThrottlerGuard,
    { provide: APP_GUARD, useExisting: ThrottlerGuard },
    AppService,
  ],
})
export class AppModule {}
