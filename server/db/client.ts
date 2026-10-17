/**
 * PostgreSQL connection and migrations.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import * as schema from './schema.ts';

export type DB = NodePgDatabase<typeof schema>;

const here = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.join(here, 'migrations');

export interface Database {
  db: DB;
  pool: pg.Pool;
  close(): Promise<void>;
}

export function connect(databaseUrl: string): Database {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Point it at a PostgreSQL database, e.g. postgresql://postgres:postgres@localhost:5432/leadflow'
    );
  }
  const needsSsl = /sslmode=require/.test(databaseUrl) || /supabase\.co|neon\.tech|render\.com/.test(databaseUrl);
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 10,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
  pool.on('error', (err) => console.error('[db] idle client error:', err.message));
  const db = drizzle(pool, { schema });
  return { db, pool, close: () => pool.end() };
}

export async function runMigrations(db: DB): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
}
