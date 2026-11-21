import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db.ts';

// Runtime-generated secret fallback if SESSION_SECRET is not provided in environment
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export interface AuthTokenPayload {
  sub: number | string;
  role: 'user' | 'admin';
  exp: number;
}

export interface TaskSessionPayload {
  userId: number;
  taskId: number;
  startedAt: number;
  nonce: string;
  exp: number;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function constantTimeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function signPayload(payloadObj: object): string {
  const encoded = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

function verifySignedToken<T>(token: string): T | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  if (!constantTimeEqualString(signature, expectedSig)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T & { exp?: number };
    if (parsed.exp && Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function issueAuthToken(sub: number | string, role: 'user' | 'admin'): string {
  const payload: AuthTokenPayload = {
    sub,
    role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  return signPayload(payload);
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  return verifySignedToken<AuthTokenPayload>(token);
}

export function issueTaskSessionToken(userId: number, taskId: number): string {
  const payload: TaskSessionPayload = {
    userId,
    taskId,
    startedAt: Date.now(),
    nonce: crypto.randomBytes(8).toString('hex'),
    exp: Date.now() + 1000 * 60 * 15, // 15 minutes max session window
  };
  return signPayload(payload);
}

export function verifyTaskSessionToken(token: string): TaskSessionPayload | null {
  return verifySignedToken<TaskSessionPayload>(token);
}

export interface AuthenticatedRequest extends Request {
  userId?: number;
  isAdmin?: boolean;
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

export function requireUser(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const payload = verifyAuthToken(token);
  if (!payload || payload.role !== 'user' || typeof payload.sub !== 'number') {
    res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
    return;
  }

  const user = db
    .prepare('SELECT id, is_suspended FROM users WHERE id = ?')
    .get(payload.sub) as { id: number; is_suspended: number } | undefined;

  if (!user) {
    res.status(401).json({ error: 'Account not found.' });
    return;
  }
  if (user.is_suspended === 1) {
    res.status(403).json({ error: 'Account is suspended. Contact support.' });
    return;
  }

  req.userId = user.id;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Admin authentication required.' });
    return;
  }
  const payload = verifyAuthToken(token);
  if (!payload || payload.role !== 'admin') {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  req.isAdmin = true;
  next();
}
