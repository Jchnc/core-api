import { registerAs } from '@nestjs/config';

export const securityConfig = registerAs('security', () => ({
  argon2: {
    memoryCost: parseInt(process.env.ARGON2_MEMORY_COST ?? '65536', 10),
    timeCost: parseInt(process.env.ARGON2_TIME_COST ?? '3', 10),
    parallelism: parseInt(process.env.ARGON2_PARALLELISM ?? '4', 10),
  },
  twoFactor: {
    codeTtl: parseInt(process.env.TWO_FACTOR_CODE_TTL ?? '600', 10),
    maxAttempts: parseInt(process.env.TWO_FACTOR_MAX_ATTEMPTS ?? '5', 10),
    trustedDeviceTtlDays: parseInt(process.env.TRUSTED_DEVICE_TTL_DAYS ?? '30', 10),
  },
}));
