import type { SqlDriverAdapterFactory } from '@prisma/driver-adapter-utils';
import { Logger } from '@nestjs/common';

export type DBProvider = 'mysql' | 'postgres';

export function parseDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url);

    return {
      protocol: parsed.protocol.replace(':', ''),
      host: parsed.hostname,
      port: Number(parsed.port) || undefined,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace('/', ''),
    };
  } catch {
    throw new Error(
      'Invalid DATABASE_URL format. Expected: driver://user:password@host:port/database',
    );
  }
}

export function detectProvider(url: string): DBProvider {
  if (url.startsWith('postgres')) return 'postgres';
  if (url.startsWith('mysql')) return 'mysql';

  throw new Error('Unsupported database provider');
}

async function loadPgAdapter(url: string): Promise<SqlDriverAdapterFactory> {
  try {
    const { PrismaPg } = await import('@prisma/adapter-pg');
    const db = parseDatabaseUrl(url);

    return new PrismaPg({
      host: db.host,
      port: db.port || 5432,
      user: db.user,
      password: db.password,
      database: db.database,
    });
  } catch (error) {
    Logger.error('Failed to initialize PostgreSQL adapter', error as Error);
    throw new Error('Failed to initialize PostgreSQL adapter');
  }
}

async function loadMariaDbAdapter(url: string): Promise<SqlDriverAdapterFactory> {
  try {
    const { PrismaMariaDb } = await import('@prisma/adapter-mariadb');
    const db = parseDatabaseUrl(url);

    return new PrismaMariaDb({
      host: db.host,
      port: db.port || 3306,
      user: db.user,
      password: db.password,
      database: db.database,
      connectionLimit: 10,
    });
  } catch (error) {
    Logger.error('Failed to initialize MariaDB adapter', error as Error);
    throw new Error('Failed to initialize MariaDB adapter');
  }
}

export async function createAdapter(databaseUrl: string): Promise<SqlDriverAdapterFactory> {
  const provider = detectProvider(databaseUrl);

  if (provider === 'postgres') return loadPgAdapter(databaseUrl);
  if (provider === 'mysql') return loadMariaDbAdapter(databaseUrl);

  throw new Error('Invalid DB provider');
}
