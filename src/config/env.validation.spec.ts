import 'reflect-metadata';
import { validateEnv } from './env.validation';

describe('Environment Validation', () => {
  const validConfig = {
    NODE_ENV: 'development',
    PORT: '3000',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_ACCESS_SECRET: 'access',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_SECRET: 'refresh',
    JWT_REFRESH_EXPIRES_IN: '30d',
    PASSWORD_RESET_TOKEN_TTL: '3600',
    MAIL_HOST: 'smtp.mailtrap.io',
    MAIL_PORT: '2525',
    MAIL_USER: 'user',
    MAIL_PASS: 'pass',
    MAIL_FROM: 'noreply@example.com',
    FRONTEND_URL: 'http://localhost:3000',
    GOOGLE_CLIENT_ID: 'google-client-id',
    GOOGLE_CLIENT_SECRET: 'google-client-secret',
    GOOGLE_CALLBACK_URL: 'http://localhost:3000/api/v1/auth/google/callback',
  };

  it('should validate and return parsed configuration when valid', () => {
    const result = validateEnv(validConfig);
    expect(result).toBeDefined();
    expect(result.PORT).toBe(3000);
    expect(result.PASSWORD_RESET_TOKEN_TTL).toBe(3600);
    expect(result.NODE_ENV).toBe('development');
  });

  it('should throw error when a required string field is missing', () => {
    const invalidConfig: Record<string, string> = { ...validConfig };
    delete invalidConfig.DATABASE_URL;

    expect(() => validateEnv(invalidConfig)).toThrow('Config validation error —');
    expect(() => validateEnv(invalidConfig)).toThrow('DATABASE_URL');
  });

  it('should throw error when a number field is out of bounds', () => {
    const invalidConfig = { ...validConfig, PORT: '99999' };

    expect(() => validateEnv(invalidConfig)).toThrow('Config validation error —');
    expect(() => validateEnv(invalidConfig)).toThrow('PORT');
    expect(() => validateEnv(invalidConfig)).toThrow('max');
  });

  it('should throw error when frontend URL is invalid', () => {
    const invalidConfig = { ...validConfig, FRONTEND_URL: 'invalid::::url' };

    expect(() => validateEnv(invalidConfig)).toThrow('Config validation error —');
    expect(() => validateEnv(invalidConfig)).toThrow('FRONTEND_URL');
  });

  it('should throw error when environment is invalid enum', () => {
    const invalidConfig = { ...validConfig, NODE_ENV: 'invalid-env' };

    expect(() => validateEnv(invalidConfig)).toThrow('Config validation error —');
    expect(() => validateEnv(invalidConfig)).toThrow('NODE_ENV');
    expect(() => validateEnv(invalidConfig)).toThrow('isEnum');
  });
});
