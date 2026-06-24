import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { initDatabase, query } from './db';
import { hashPassword, verifyPassword, signToken, authMiddleware, requireAuth, requireAdmin, UserPayload } from './auth';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000');
const NODE_ENV = process.env.NODE_ENV || 'development';

// CORS для Railway: разрешаем все origins (там frontend и backend на одном домене)
app.use(cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true,
}));
app.use(express.json({ limit: '1gb' }));
app.use(cookieParser());
app.use(authMiddleware);

app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));

// ============= AUTH =============
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });
    if (username.length < 3) return res.status(400).json({ error: 'Имя пользователя минимум 3 символа' });
    if (password.length < 4) return res.status(400).json({ error: 'Пароль минимум 4 символа' });

    const hash = await hashPassword(password);
    // Только никнейм Morfin = админ
    const isAdmin = username === 'Morfin';
    const avatarColor = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899'][Math.floor(Math.random() * 6)];

    try {
      const r = await query(
        `INSERT INTO users (username, password_hash, avatar_color, is_admin, can_upload)
         VALUES ($1, $2, $3, $4, $4) RETURNING id, username, avatar_color, is_admin, can_upload`,
        [username, hash, avatarColor, isAdmin]
      );
      const u = r.rows[0];
      const payload: UserPayload = { id: u.id, username: u.username, avatarColor: u.avatar_color, isAdmin: u.is_admin, canUpload: u.can_upload };
      const token = signToken(payload);
      res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
      res.json({ user: payload, token });
    } catch (err: any) {
      if (err.code === '23505') return res.status(409).json({ error: 'Пользователь уже существует' });
      throw err;
    }
  } catch (err: any) {
    console.error('[register]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });
    const r = await query(`SELECT id, username, password_hash, avatar_color, is_admin, can_upload FROM users WHERE username = $1`, [username]);
    const u = r.rows[0];
    if (!u) return res.status(401).json({ error: 'Неверные данные' });
    const valid = await verifyPassword(password, u.password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверные данные' });
    const payload: UserPayload = { id: u.id, username: u.username, avatarColor: u.avatar_color, isAdmin: u.is_admin, canUpload: u.can_upload };
    const token = signToken(payload);
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
    res.json({ user: payload, token });
  } catch (err: any) {
    console.error('[login]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const u = req.user as UserPayload | null;
  if (!u) return res.json({ user: null });
  res.json({ user: { id: u.id, nickname: u.username, color: u.avatarColor, isAdmin: u.isAdmin, canUpload: u.canUpload } });
});

app.post('/api/auth/change-password', requireAuth, async (req: any, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Заполните оба поля' });
    if (newPassword.length < 4) return res.status(400).json({ error: 'Пароль минимум 4 символа' });

    const r = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const u = r.rows[0];
    if (!u) return res.status(404).json({ error: 'Пользователь не найден' });
    const valid = await verifyPassword(oldPassword, u.password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверный старый пароль' });

    const newHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[change-password]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============= ANIME =============
app.get('/api/anime', async (req, res) => {
  try {
    const r = await query(`
      SELECT a.id, a.title, a.description, a.year, a.poster_mime, a.video_mime,
        a.genres, a.views_count, a.likes_count, a.dislikes_count, a.created_at
      FROM anime a
      ORDER BY a.created_at DESC
    `);
    const items = r.rows.map((a: any) => ({
      id: a.id,
      title: a.title,
      description: a.description || '',
      year: a.year,
      genres: Array.isArray(a.genres) ? a.genres : [],
      viewsCount: a.views_count || 0,
      likesCount: a.likes_count || 0,
      dislikesCount: a.dislikes_count || 0,
      hasPoster: !!a.poster_mime,
      hasVideo: !!a.video_mime,
    }));
    res.json({ items });
  } catch (err: any) {
    console.error('[anime list]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/anime/:id', async (req, res) => {
  try {
    const r = await query(`SELECT * FROM anime WHERE id = $1`, [req.params.id]);
    const a = r.rows[0];
    if (!a) return res.status(404).json({ error: 'Не найдено' });
    res.json({
      anime: {
        id: a.id, title: a.title, description: a.description || '',
        year: a.year, genres: Array.isArray(a.genres) ? a.genres : [],
        viewsCount: a.views_count || 0, likesCount: a.likes_count || 0, dislikesCount: a.dislikes_count || 0,
        hasPoster: !!a.poster_mime, hasVideo: !!a.video_mime,
      }
    });
  } catch (err: any) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// Загрузка аниме (с файлами в base64)
app.post('/api/anime/upload', requireAuth, async (req: any, res) => {
  try {
    const { title, description, year, genres, poster, posterMime, video, videoMime } = req.body || {};
    if (!title) return res.status(400).json({ error: 'Название обязательно' });
    if (!req.user.canUpload && !req.user.isAdmin) return res.status(403).json({ error: 'Нет прав на загрузку' });

    const genreList = genres ? genres.split(',').map((g: string) => g.trim()).filter(Boolean) : [];
    const posterBuf = poster ? Buffer.from(poster, 'base64') : null;
    const videoBuf = video ? Buffer.from(video, 'base64') : null;

    const r = await query(
      `INSERT INTO anime (title, description, year, genres, poster_data, poster_mime, video_data, video_mime, author_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [title, description || '', Number(year) || new Date().getFullYear(), genreList, posterBuf, posterMime || null, videoBuf, videoMime || null, req.user.id]
    );
    res.json({ animeId: r.rows[0].id });
  } catch (err: any) { console.error('[upload anime]', err.message); res.status(500).json({ error: err.message }); }
});

// Файлы — отдача по ID
app.get('/api/files/anime/:id/poster', async (req, res) => {
  try {
    const r = await query('SELECT poster_data, poster_mime FROM anime WHERE id = $1', [req.params.id]);
    const a = r.rows[0];
    if (!a || !a.poster_data) return res.status(404).json({ error: 'Постер не найден' });
    res.setHeader('Content-Type', a.poster_mime || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(a.poster_data);
  } catch (err: any) { res.status(500).json({ error: 'Ошибка' }); }
});

app.get('/api/files/anime/:id/video', async (req, res) => {
  try {
    const r = await query('SELECT video_data, video_mime FROM anime WHERE id = $1', [req.params.id]);
    const a = r.rows[0];
    if (!a || !a.video_data) return res.status(404).json({ error: 'Видео не найдено' });
    res.setHeader('Content-Type', a.video_mime || 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(a.video_data);
  } catch (err: any) { res.status(500).json({ error: 'Ошибка' }); }
});

// ============= COMMENTS =============
app.get('/api/anime/:id/comments', async (req, res) => {
  try {
    const r = await query(
      `SELECT c.id, c.text, c.created_at, c.likes, c.user_id, u.username, u.avatar_color
       FROM comments c LEFT JOIN users u ON u.id = c.user_id
       WHERE c.anime_id = $1 ORDER BY c.created_at DESC`,
      [req.params.id]
    );
    const comments = r.rows.map((c: any) => ({
      id: c.id, text: c.text, date: c.created_at, likes: c.likes || 0,
      author: c.username, avatarColor: c.avatar_color, userId: c.user_id,
    }));
    res.json({ comments });
  } catch (err: any) { res.status(500).json({ error: 'Ошибка' }); }
});

app.post('/api/anime/:id/comments', requireAuth, async (req: any, res) => {
  try {
    const { text } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ error: 'Комментарий не может быть пустым' });
    const r = await query(
      `INSERT INTO comments (anime_id, user_id, text) VALUES ($1, $2, $3) RETURNING id, text, created_at, likes`,
      [req.params.id, req.user.id, text.trim()]
    );
    const c = r.rows[0];
    res.json({
      id: c.id, text: c.text, date: c.created_at, likes: c.likes || 0,
      author: req.user.username, avatarColor: req.user.avatarColor, userId: req.user.id,
    });
  } catch (err: any) { res.status(500).json({ error: 'Ошибка' }); }
});

app.delete('/api/admin/comments/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM comments WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: 'Ошибка' }); }
});

// ============= VOTES =============
app.get('/api/anime/:id/votes', requireAuth, async (req: any, res) => {
  try {
    const r = await query(
      `SELECT 
        COALESCE(SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END), 0) as likes,
        COALESCE(SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END), 0) as dislikes
       FROM user_votes WHERE anime_id = $1`,
      [req.params.id]
    );
    const uv = await query(`SELECT vote FROM user_votes WHERE anime_id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    res.json({
      likes: Number(r.rows[0]?.likes || 0),
      dislikes: Number(r.rows[0]?.dislikes || 0),
      userVote: uv.rows[0]?.vote || 0,
    });
  } catch (err: any) { res.status(500).json({ error: 'Ошибка' }); }
});

app.post('/api/anime/:id/vote', requireAuth, async (req: any, res) => {
  try {
    const { vote } = req.body || {};
    if (vote !== 1 && vote !== -1 && vote !== 0) return res.status(400).json({ error: 'Неверный голос' });
    await query('DELETE FROM user_votes WHERE anime_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (vote !== 0) {
      await query('INSERT INTO user_votes (anime_id, user_id, vote) VALUES ($1, $2, $3)', [req.params.id, req.user.id, vote]);
    }
    const r = await query(
      `SELECT 
        COALESCE(SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END), 0) as likes,
        COALESCE(SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END), 0) as dislikes
       FROM user_votes WHERE anime_id = $1`,
      [req.params.id]
    );
    await query('UPDATE anime SET likes_count = $1, dislikes_count = $2 WHERE id = $3',
      [Number(r.rows[0]?.likes || 0), Number(r.rows[0]?.dislikes || 0), req.params.id]);
    res.json({ likes: Number(r.rows[0]?.likes || 0), dislikes: Number(r.rows[0]?.dislikes || 0), userVote: vote });
  } catch (err: any) { res.status(500).json({ error: 'Ошибка' }); }
});

// ============= RATINGS =============
app.get('/api/anime/:id/rating', requireAuth, async (req: any, res) => {
  try {
    const r = await query(`SELECT COALESCE(AVG(score), 0) as average, COUNT(*) as count FROM ratings WHERE anime_id = $1`, [req.params.id]);
    const ur = await query(`SELECT score FROM ratings WHERE anime_id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    res.json({
      average: Number(r.rows[0]?.average || 0),
      count: Number(r.rows[0]?.count || 0),
      userScore: ur.rows[0]?.score || null,
    });
  } catch (err: any) { res.status(500).json({ error: 'Ошибка' }); }
});

app.post('/api/anime/:id/rate', requireAuth, async (req: any, res) => {
  try {
    const { score } = req.body || {};
    const numScore = Number(score);
    if (numScore < 1 || numScore > 10) return res.status(400).json({ error: 'Оценка от 1 до 10' });
    await query('DELETE FROM ratings WHERE anime_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    await query('INSERT INTO ratings (anime_id, user_id, score) VALUES ($1, $2, $3)', [req.params.id, req.user.id, numScore]);
    const r = await query(`SELECT COALESCE(AVG(score), 0) as average, COUNT(*) as count FROM ratings WHERE anime_id = $1`, [req.params.id]);
    res.json({ average: Number(r.rows[0]?.average || 0), count: Number(r.rows[0]?.count || 0), userScore: numScore });
  } catch (err: any) { res.status(500).json({ error: 'Ошибка' }); }
});

// ============= HISTORY/VIEWS =============
app.post('/api/history/:id', requireAuth, async (req: any, res) => {
  try {
    const epId = Number(req.params.id);
    const { watchedSeconds = 0 } = req.body || {};
    // Добавляем просмотр (если аниме)
    await query(
      `UPDATE anime SET views_count = views_count + 1 WHERE id = $1`,
      [epId]
    );
    const r = await query('SELECT views_count FROM anime WHERE id = $1', [epId]);
    res.json({ views: Number(r.rows[0]?.views_count || 0) });
  } catch (err: any) { res.status(500).json({ error: 'Ошибка' }); }
});

// ============= ADMIN =============
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const r = await query(`SELECT id, username, avatar_color, is_admin, can_upload, created_at FROM users ORDER BY id DESC`);
    const users = r.rows.map((u: any) => ({
      id: u.id, username: u.username, avatarColor: u.avatar_color,
      isAdmin: u.is_admin, canUpload: u.can_upload, createdAt: u.created_at,
    }));
    res.json({ users });
  } catch (err: any) { res.status(500).json({ error: 'Ошибка' }); }
});

app.post('/api/admin/users/:id/admin', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { isAdmin } = req.body || {};
    await query('UPDATE users SET is_admin = $1 WHERE id = $2', [Boolean(isAdmin), req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: 'Ошибка' }); }
});

app.post('/api/admin/users/:id/upload-permission', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { canUpload } = req.body || {};
    await query('UPDATE users SET can_upload = $1 WHERE id = $2', [Boolean(canUpload), req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: 'Ошибка' }); }
});

app.delete('/api/admin/anime/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM anime WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: 'Ошибка' }); }
});

// ============= STATIC + SPA FALLBACK =============
const distPath = path.join(process.cwd(), 'dist');
const indexPath = path.join(distPath, 'index.html');
console.log(`[static] dist path: ${distPath}, exists: ${fs.existsSync(distPath)}, index.html: ${fs.existsSync(indexPath)}`);

if (fs.existsSync(distPath)) {
  // Сначала раздаём статику (CSS, JS, изображения)
  app.use(express.static(distPath, {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      // index.html — не кешируем (всегда свежий)
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));
}

// SPA fallback — все не-API запросы отдают index.html
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).type('html').send(`
      <!DOCTYPE html>
      <html><body style="font-family:sans-serif;padding:20px;background:#fafafa">
        <h1>AnimeWorld API</h1>
        <p>Frontend not built. Run <code>npm run build</code> first.</p>
        <p>API available at <a href="/api/health">/api/health</a></p>
      </body></html>
    `);
  }
});

async function start() {
  console.log(`[server] Starting on port ${PORT}...`);
  try {
    await initDatabase();
    console.log('[init] Database ready');
  } catch (err: any) {
    console.error('[init] DB init error:', err.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] Running on port ${PORT} (${NODE_ENV})`);
  });
}

start();
