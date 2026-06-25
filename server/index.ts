import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { initDatabase, query } from './db';
import { hashPassword, verifyPassword, signToken, authMiddleware, requireAuth, requireAdmin, UserPayload } from './auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000');
const NODE_ENV = process.env.NODE_ENV || 'development';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '800mb' }));
app.use(cookieParser());
app.use(authMiddleware);

// Раздача статики (собранный vite)
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Загрузка видео
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage, limits: { fileSize: 750 * 1024 * 1024 } });

// === AUTH ===
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username?.trim() || !password?.trim() || password.length < 3) {
      return res.status(400).json({ error: 'Username and password (min 3) required' });
    }
    const existing = await query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Username taken' });
    const isAdmin = username.toLowerCase() === 'morfin';
    const hash = await hashPassword(password);
    const avatarColor = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899'][Math.floor(Math.random() * 6)];
    const result = await query(
      'INSERT INTO users (username, password_hash, avatar_color, is_admin, can_upload) VALUES ($1,$2,$3,$4,$5) RETURNING id, username, avatar_color, is_admin, can_upload',
      [username.trim(), hash, avatarColor, isAdmin, isAdmin]
    );
    const u = result.rows[0];
    const token = signToken({ id: u.id, username: u.username, avatarColor: u.avatar_color, isAdmin: u.is_admin, canUpload: u.can_upload });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
    res.json({ user: { id: u.id, nickname: u.username, color: u.avatar_color, isAdmin: u.is_admin, canUpload: u.can_upload }, token });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Неверный логин или пароль' });
    const u = result.rows[0];
    const valid = await verifyPassword(password, u.password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверный логин или пароль' });
    const token = signToken({ id: u.id, username: u.username, avatarColor: u.avatar_color, isAdmin: u.is_admin, canUpload: u.can_upload });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
    res.json({ user: { id: u.id, nickname: u.username, color: u.avatar_color, isAdmin: u.is_admin, canUpload: u.can_upload }, token });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/auth/me', async (req, res) => {
  const u = req.user as UserPayload | null;
  if (!u) return res.json({ user: null });
  res.json({ user: { id: u.id, nickname: u.username, color: u.avatarColor, isAdmin: u.isAdmin, canUpload: u.canUpload } });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.post('/api/auth/change-password', requireAuth, async (req: any, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword || newPassword.length < 3) {
      return res.status(400).json({ error: 'Старый и новый пароль (мин. 3 символа) обязательны' });
    }
    
    // Get current user's password hash
    const userResult = await query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    const currentHash = userResult.rows[0].password_hash;
    const valid = await verifyPassword(oldPassword, currentHash);
    if (!valid) {
      return res.status(401).json({ error: 'Неверный текущий пароль' });
    }
    
    const newHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash=$1 WHERE id=$2', [newHash, req.user.id]);
    
    res.json({ ok: true, message: 'Пароль успешно изменён' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// === ANIME ===
app.get('/api/anime', async (req, res) => {
  try {
    const result = await query('SELECT * FROM anime ORDER BY created_at DESC');
    // Calculate average rating for each anime
    const ratings = await query('SELECT anime_id, AVG(score) as avg_score FROM ratings GROUP BY anime_id');
    const ratingMap = new Map<number, number>();
    ratings.rows.forEach((r: any) => ratingMap.set(r.anime_id, parseFloat(r.avg_score)));
    
    const list = result.rows.map(a => ({
      id: a.id, title: a.title, description: a.description,
      image: a.poster_data || '', views: a.views_count, rating: ratingMap.get(a.id) || 0,
      genres: a.genres, year: a.year, videoSrc: a.video_url,
    }));
    res.json(list);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/anime', requireAuth, (req: any, res, next) => {
  if (!req.user?.canUpload && !req.user?.isAdmin) {
    return res.status(403).json({ error: 'Требуется право на загрузку' });
  }
  next();
}, upload.fields([{ name: 'video', maxCount: 1 }, { name: 'poster', maxCount: 1 }]), async (req: any, res) => {
  try {
    const { title, description, year, genres } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
    const videoFile = req.files?.video?.[0];
    const posterFile = req.files?.poster?.[0];
    const videoUrl = videoFile ? '/uploads/' + videoFile.filename : '';
    let posterData = '';
    if (posterFile) {
      posterData = 'data:' + (posterFile.mimetype || 'image/png') + ';base64,' + fs.readFileSync(posterFile.path).toString('base64');
    }
    const genreList = typeof genres === 'string' ? genres.split(',').map((g: string) => g.trim()).filter(Boolean) : [];
    const result = await query(
      'INSERT INTO anime (title, description, poster_data, genres, year, video_url, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [title.trim(), description || '', posterData, genreList, parseInt(year) || 2024, videoUrl, req.user.id]
    );
    const a = result.rows[0];
    res.json({ id: a.id, title: a.title, description: a.description, image: posterData, views: 0, rating: 0, genres: a.genres, year: a.year, videoSrc: videoUrl });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/anime/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM anime WHERE id=$1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Аниме не найдено' });
    
    const anime = result.rows[0];
    
    // Get average rating
    const ratingResult = await query('SELECT AVG(score) as avg_score FROM ratings WHERE anime_id=$1', [id]);
    const avgRating = ratingResult.rows[0]?.avg_score ? parseFloat(ratingResult.rows[0].avg_score) : 0;
    
    // Get creator info if available
    let creator = null;
    if (anime.created_by) {
      const creatorResult = await query('SELECT username, avatar_color FROM users WHERE id=$1', [anime.created_by]);
      if (creatorResult.rows.length > 0) {
        creator = { nickname: creatorResult.rows[0].username, color: creatorResult.rows[0].avatar_color };
      }
    }
    
    res.json({
      id: anime.id, title: anime.title, description: anime.description,
      image: anime.poster_data || '', views: anime.views_count, rating: avgRating,
      genres: anime.genres, year: anime.year, videoSrc: anime.video_url,
      creator: creator,
      createdAt: anime.created_at
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/anime/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM comment_likes WHERE comment_id IN (SELECT id FROM comments WHERE anime_id=$1)', [id]);
    await query('DELETE FROM comments WHERE anime_id=$1', [id]);
    await query('DELETE FROM ratings WHERE anime_id=$1', [id]);
    await query('DELETE FROM views WHERE anime_id=$1', [id]);
    await query('DELETE FROM anime WHERE id=$1', [id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// === COMMENTS ===
app.get('/api/anime/:id/comments', async (req, res) => {
  try {
    const result = await query(
      `SELECT c.*, u.username as author, u.avatar_color as avatar_color,
        (SELECT COUNT(*) FROM comment_likes WHERE comment_id=c.id) as likes
       FROM comments c JOIN users u ON c.user_id=u.id
       WHERE c.anime_id=$1 AND c.parent_id IS NULL ORDER BY c.created_at DESC`,
      [req.params.id]
    );
    const replies = await query(
      `SELECT c.*, u.username as author, u.avatar_color as avatar_color,
        (SELECT COUNT(*) FROM comment_likes WHERE comment_id=c.id) as likes
       FROM comments c JOIN users u ON c.user_id=u.id
       WHERE c.anime_id=$1 AND c.parent_id IS NOT NULL ORDER BY c.created_at ASC`,
      [req.params.id]
    );
    const replyMap = new Map<number, any[]>();
    replies.rows.forEach((r: any) => {
      if (!replyMap.has(r.parent_id)) replyMap.set(r.parent_id, []);
      replyMap.get(r.parent_id)!.push({
        id: r.id, author: r.author, avatarColor: r.avatar_color,
        text: r.text, date: r.created_at, likes: parseInt(r.likes), dislikes: 0, replies: [],
      });
    });
    const comments = result.rows.map((c: any) => ({
      id: c.id, author: c.author, avatarColor: c.avatar_color,
      text: c.text, date: c.created_at, likes: parseInt(c.likes), dislikes: 0,
      replies: replyMap.get(c.id) || [],
    }));
    res.json(comments);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/anime/:id/comments', requireAuth, async (req: any, res) => {
  try {
    const { text, parentId } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Text required' });
    const result = await query(
      'INSERT INTO comments (anime_id, user_id, parent_id, text) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.id, req.user.id, parentId || null, text.trim()]
    );
    const c = result.rows[0];
    res.json({ id: c.id, author: req.user.username, avatarColor: req.user.avatarColor, text: c.text, date: c.created_at, likes: 0, dislikes: 0, replies: [] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/comments/:id', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM comment_likes WHERE comment_id=$1', [req.params.id]);
    await query('DELETE FROM comments WHERE id=$1 OR parent_id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/comments/:id/like', requireAuth, async (req: any, res) => {
  try {
    const existing = await query('SELECT * FROM comment_likes WHERE user_id=$1 AND comment_id=$2', [req.user.id, req.params.id]);
    if (existing.rows.length > 0) {
      await query('DELETE FROM comment_likes WHERE user_id=$1 AND comment_id=$2', [req.user.id, req.params.id]);
    } else {
      await query('INSERT INTO comment_likes (user_id, comment_id) VALUES ($1,$2)', [req.user.id, req.params.id]);
    }
    const count = await query('SELECT COUNT(*) FROM comment_likes WHERE comment_id=$1', [req.params.id]);
    res.json({ likes: parseInt(count.rows[0].count) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// === RATINGS ===
app.post('/api/anime/:id/rate', requireAuth, async (req: any, res) => {
  try {
    const { score } = req.body;
    if (!score || score < 1 || score > 10) return res.status(400).json({ error: 'Score 1-10 required' });
    await query(
      'INSERT INTO ratings (user_id, anime_id, score) VALUES ($1,$2,$3) ON CONFLICT (user_id, anime_id) DO UPDATE SET score=$3, updated_at=NOW()',
      [req.user.id, req.params.id, score]
    );
    res.json({ ok: true, score });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// === VIEWS ===
app.post('/api/anime/:id/view', requireAuth, async (req: any, res) => {
  try {
    await query('INSERT INTO views (user_id, anime_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, req.params.id]);
    await query('UPDATE anime SET views_count = views_count + 1 WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// === ADMIN ===
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const result = await query('SELECT id, username, avatar_color, is_admin, can_upload, created_at FROM users ORDER BY id');
    res.json(result.rows.map((u: any) => ({
      id: u.id, nickname: u.username, username: u.username, avatarColor: u.avatar_color,
      isAdmin: u.is_admin, canUpload: u.can_upload, createdAt: u.created_at,
    })));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/users/:id/admin', requireAdmin, async (req, res) => {
  try {
    const { isAdmin } = req.body;
    await query('UPDATE users SET is_admin=$1, can_upload=TRUE WHERE id=$2', [isAdmin, req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/users/:id/upload', requireAdmin, async (req, res) => {
  try {
    const { canUpload } = req.body;
    await query('UPDATE users SET can_upload=$1 WHERE id=$2', [canUpload, req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await query('SELECT is_admin FROM users WHERE id=$1', [req.params.id]);
    if (user.rows[0]?.is_admin) return res.status(403).json({ error: 'Cannot delete admin' });
    await query('DELETE FROM comment_likes WHERE user_id=$1', [req.params.id]);
    await query('DELETE FROM comments WHERE user_id=$1', [req.params.id]);
    await query('DELETE FROM ratings WHERE user_id=$1', [req.params.id]);
    await query('DELETE FROM views WHERE user_id=$1', [req.params.id]);
    await query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Отдача загруженных файлов
app.use('/uploads', express.static(uploadsDir));

// SPA fallback — только для не-API запросов
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(200).send('AnimeWorld API running');
});

async function start() {
  console.log(`[server] Starting on port ${PORT}...`);
  await initDatabase();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] Running on port ${PORT} (${NODE_ENV})`);
  });
}

start();
