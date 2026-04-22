import type { SqlDriverAdapterFactory } from '@prisma/driver-adapter-utils';

export type DBProvider = 'mysql' | 'postgres';

export function parseDatabaseUrl(url: string) {
  const parsed = new URL(url);

  return {
    protocol: parsed.protocol.replace(':', ''),
    host: parsed.hostname,
    port: Number(parsed.port),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace('/', ''),
  };
}

export function detectProvider(url: string): DBProvider {
  if (url.startsWith('postgres')) return 'postgres';
  if (url.startsWith('mysql')) return 'mysql';

  throw new Error('Unsupported database provider');
}

async function loadPgAdapter(url: string): Promise<SqlDriverAdapterFactory> {
  const { PrismaPg } = await import('@prisma/adapter-pg');

  return new PrismaPg({ connectionString: url });
}

async function loadMariaDbAdapter(url: string): Promise<SqlDriverAdapterFactory> {
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
}

export async function createAdapter(databaseUrl: string): Promise<SqlDriverAdapterFactory> {
  const provider = detectProvider(databaseUrl);

  if (provider === 'postgres') return loadPgAdapter(databaseUrl);
  if (provider === 'mysql') return loadMariaDbAdapter(databaseUrl);

  throw new Error('Invalid DB provider');
}
