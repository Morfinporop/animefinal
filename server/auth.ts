import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'animeworld-secret-key-change-in-production';
const JWT_EXPIRES = '30d';

export interface UserPayload {
  id: number;
  username: string;
  avatarColor: string;
  isAdmin: boolean;
  canUpload: boolean;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(user: UserPayload): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): UserPayload | null {
  try { return jwt.verify(token, JWT_SECRET) as UserPayload; } catch { return null; }
}

export function authMiddleware(req: any, res: any, next: any) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  req.user = token ? verifyToken(token) : null;
  next();
}

export function requireAuth(req: any, res: any, next: any) {
  if (!req.user) return res.status(401).json({ error: 'Требуется авторизация' });
  next();
}

export function requireAdmin(req: any, res: any, next: any) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Требуются права администратора' });
  next();
}
