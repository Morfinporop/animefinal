import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) console.warn('[db] DATABASE_URL не задан');

export const pool = DATABASE_URL ? new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
}) : null;

pool?.on('error', (err) => console.error('[db.error]', err.message));

// Миграции для исправления старых таблиц (если anime был создан без колонок)
const MIGRATIONS = [
  `ALTER TABLE anime ADD COLUMN IF NOT EXISTS poster_mime VARCHAR(50)`,
  `ALTER TABLE anime ADD COLUMN IF NOT EXISTS video_mime VARCHAR(50)`,
  `ALTER TABLE anime ADD COLUMN IF NOT EXISTS video_data BYTEA`,
  `ALTER TABLE anime ADD COLUMN IF NOT EXISTS poster_data BYTEA`,
];

export async function initDatabase() {
  if (!pool) return;
  try {
    // Сначала миграции
    for (const m of MIGRATIONS) {
      try { await pool.query(m); } catch {}
    }

    // Потом схема
    const schema = readFileSync(join(process.cwd(), 'server', 'schema.sql'), 'utf-8');
    const statements = schema.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      try { await pool.query(stmt); } catch (err: any) {
        if (!err.message.includes('already exists')) console.warn('[db] skip:', err.message.slice(0, 80));
      }
    }
    console.log('[db] Schema applied');
  } catch (err: any) { console.error('[db] init error:', err.message); }
}

export async function query(text: string, params?: unknown[]) {
  if (!pool) throw new Error('Database not configured');
  return pool.query(text, params);
}
