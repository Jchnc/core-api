import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { minutes, seconds, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import 'dotenv/config';

import { HealthModule } from '@/health';

import { AllExceptionsFilter } from '@/common/filters/http-exception.filter';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { RequestIdMiddleware } from '@/common/middleware/request-id.middleware';
import {
  appConfig,
  googleConfig,
  jwtConfig,
  mailConfig,
  securityConfig,
  validateEnv,
} from '@/config';
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
      load: [appConfig, googleConfig, jwtConfig, mailConfig, securityConfig],
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: seconds(1), limit: 5 },
        { name: 'medium', ttl: seconds(10), limit: 20 },
        { name: 'long', ttl: minutes(1), limit: 100 },
      ],
    }),
    PrismaModule,
    HealthModule,
    UsersModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    ThrottlerGuard,
    { provide: APP_GUARD, useExisting: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('{*path}');
  }
}
