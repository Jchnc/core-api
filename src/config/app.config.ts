import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
  databaseUrl: process.env.DATABASE_URL,
  passwordResetTokenTtl: parseInt(process.env.PASSWORD_RESET_TOKEN_TTL ?? '3600', 10),
}));
