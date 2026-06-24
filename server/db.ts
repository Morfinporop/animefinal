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

// Миграции — добавляют недостающие колонки
const MIGRATIONS = [
  // anime
  `ALTER TABLE anime ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE anime ADD COLUMN IF NOT EXISTS year INT NOT NULL DEFAULT 2024`,
  `ALTER TABLE anime ADD COLUMN IF NOT EXISTS age_rating VARCHAR(8) NOT NULL DEFAULT '12+'`,
  `ALTER TABLE anime ADD COLUMN IF NOT EXISTS genres TEXT[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE anime ADD COLUMN IF NOT EXISTS poster_data BYTEA`,
  `ALTER TABLE anime ADD COLUMN IF NOT EXISTS poster_mime VARCHAR(50)`,
  `ALTER TABLE anime ADD COLUMN IF NOT EXISTS video_data BYTEA`,
  `ALTER TABLE anime ADD COLUMN IF NOT EXISTS video_mime VARCHAR(50)`,
  `ALTER TABLE anime ADD COLUMN IF NOT EXISTS views_count INT NOT NULL DEFAULT 0`,
  `ALTER TABLE anime ADD COLUMN IF NOT EXISTS likes_count INT NOT NULL DEFAULT 0`,
  `ALTER TABLE anime ADD COLUMN IF NOT EXISTS dislikes_count INT NOT NULL DEFAULT 0`,
  `ALTER TABLE anime ADD COLUMN IF NOT EXISTS author_id INT REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE anime ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`,
  // comments
  `ALTER TABLE comments ADD COLUMN IF NOT EXISTS likes INT NOT NULL DEFAULT 0`,
  `ALTER TABLE comments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`,
  // ratings
  `ALTER TABLE ratings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,
];

export async function initDatabase() {
  if (!pool) return;
  try {
    // Сначала миграции
    for (const m of MIGRATIONS) {
      try { await pool.query(m); } catch (err: any) {
        if (!err.message.includes('already exists')) console.warn('[db] migrate:', err.message.slice(0, 80));
      }
    }

    // Создание таблиц (если их нет)
    const schema = readFileSync(join(process.cwd(), 'server', 'schema.sql'), 'utf-8');
    const statements = schema.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      try { await pool.query(stmt); } catch (err: any) {
        if (!err.message.includes('already exists')) console.warn('[db] skip:', err.message.slice(0, 80));
      }
    }

    // Индексы
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_comments_anime ON comments(anime_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_ratings_anime ON ratings(anime_id)`,
      `CREATE INDEX IF NOT EXISTS idx_anime_created ON anime(created_at DESC)`,
    ];
    for (const idx of indexes) {
      try { await pool.query(idx); } catch {}
    }

    console.log('[db] Schema and migrations applied');
  } catch (err: any) { console.error('[db] init error:', err.message); }
}

export async function query(text: string, params?: unknown[]) {
  if (!pool) throw new Error('Database not configured');
  return pool.query(text, params);
}
