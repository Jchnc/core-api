import 'reflect-metadata';

import { plainToInstance, Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

enum NodeEnvironment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return 3000;
    return Number(value);
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_ACCESS_EXPIRES_IN!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  JWT_REFRESH_EXPIRES_IN!: string;

  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return 3600;
    return Number(value);
  })
  @IsOptional()
  @IsNumber()
  @Min(60)
  PASSWORD_RESET_TOKEN_TTL: number = 3600;

  @IsString()
  MAIL_HOST!: string;

  @IsNumber()
  MAIL_PORT!: number;

  @IsString()
  MAIL_USER!: string;

  @IsString()
  MAIL_PASS!: string;

  @IsString()
  MAIL_FROM!: string;

  @IsUrl({ require_tld: false })
  FRONTEND_URL!: string;

  @IsString()
  GOOGLE_CLIENT_ID!: string;

  @IsString()
  GOOGLE_CLIENT_SECRET!: string;

  @IsUrl({ require_tld: false })
  GOOGLE_CALLBACK_URL!: string;

  @IsNumber()
  ARGON2_MEMORY_COST: number = 65536;

  @IsNumber()
  ARGON2_TIME_COST: number = 3;

  @IsNumber()
  ARGON2_PARALLELISM: number = 4;

  @IsNumber()
  @Min(60)
  TWO_FACTOR_CODE_TTL: number = 600;

  @IsNumber()
  @Min(1)
  TWO_FACTOR_MAX_ATTEMPTS: number = 5;

  @IsNumber()
  @Min(1)
  TRUSTED_DEVICE_TTL_DAYS: number = 30;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const fields = errors
      .map((e) => {
        const constraints = e.constraints ? Object.keys(e.constraints).join(',') : '';
        return constraints ? `${e.property}(${constraints})` : e.property;
      })
      .join(', ');
    throw new Error(`Config validation error — invalid fields: ${fields}`);
  }

  return validated;
}
