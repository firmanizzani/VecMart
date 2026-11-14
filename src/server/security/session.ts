import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { AssistantError } from '../ai/errors.js';

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new AssistantError(503, 'AUTH_NOT_CONFIGURED', 'Sesi server belum dikonfigurasi. Atur AUTH_SECRET di server.');
  return value;
}

export function signToken(purpose: string, userId: string, data: unknown = {}, ttlSeconds = 900) {
  const body = Buffer.from(JSON.stringify({ purpose, sub: userId, data, exp: Date.now() + ttlSeconds * 1000 })).toString('base64url');
  return `${body}.${createHmac('sha256', secret()).update(body).digest('base64url')}`;
}

export function readToken<T>(token: string, purpose: string): { sub: string; data: T } {
  const key = secret();
  try {
    if (!token || token.length > 16000) throw new Error();
    const parts = token.split('.');
    if (parts.length !== 2) throw new Error();
    const expected = createHmac('sha256', key).update(parts[0]).digest();
    const actual = Buffer.from(parts[1], 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (payload.purpose !== purpose || typeof payload.sub !== 'string' || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) throw new Error();
    return { sub: payload.sub, data: payload.data as T };
  } catch {
    throw purpose === 'session'
      ? new AssistantError(401, 'SESSION_EXPIRED', 'Sesi sudah tidak berlaku. Silakan masuk kembali.')
      : new AssistantError(410, 'ACTION_EXPIRED', 'Pilihan atau tindakan ini sudah tidak berlaku. Kirim ulang perintah untuk melanjutkan.');
  }
}

export async function authenticatedUser(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw new AssistantError(401, 'LOGIN_REQUIRED', 'Silakan masuk kembali untuk menggunakan Asisten AI.');
  const { sub } = readToken(authorization.slice(7), 'session');
  const [user] = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).where(eq(users.id, sub));
  if (!user) throw new AssistantError(401, 'LOGIN_REQUIRED', 'Akun tidak ditemukan. Silakan masuk kembali.');
  return user;
}

export async function requireAdmin(request: Request) {
  const user = await authenticatedUser(request);
  if (user.role !== 'admin') throw new AssistantError(403, 'ADMIN_REQUIRED', 'Asisten AI hanya tersedia untuk administrator.');
  return user;
}
