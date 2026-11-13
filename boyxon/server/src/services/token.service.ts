import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env';

/**
 * Tokenlar haqida muhim:
 * - access/refresh payload'ida `ver` (tokenVersion) bo'ladi. Foydalanuvchi parolini
 *   almashtirsa, bloklansa yoki "hammasidan chiqish" qilsa — tokenVersion oshiriladi va
 *   eski tokenlar bir zumda yaroqsiz bo'ladi.
 * - Parolni tiklash tokenlari ALOHIDA kalit (JWT_RESET_SECRET) bilan imzolanadi, shuning
 *   uchun u hech qachon sessiya tokeni sifatida ishlatilishi mumkin emas.
 */

export interface AccessPayload {
  id: string;
  role: string;
  ver: number;
  jti: string;
}

export interface RefreshPayload {
  id: string;
  ver: number;
  jti: string;
  /** Sessiya identifikatori — qurilma bo'yicha refresh (RefreshSession.model.ts). */
  sid: string;
}

export function signAccessToken(payload: { id: string; role: string; ver?: number }): string {
  return jwt.sign(
    { id: payload.id, role: payload.role, ver: payload.ver ?? 0, jti: randomUUID() },
    env.JWT_ACCESS_SECRET,
    { algorithm: 'HS256', expiresIn: env.JWT_ACCESS_EXPIRES as jwt.SignOptions['expiresIn'] },
  );
}

export function signRefreshToken(payload: { id: string; ver?: number; sid: string }): string {
  return jwt.sign(
    { id: payload.id, ver: payload.ver ?? 0, sid: payload.sid, jti: randomUUID() },
    env.JWT_REFRESH_SECRET,
    { algorithm: 'HS256', expiresIn: env.JWT_REFRESH_EXPIRES as jwt.SignOptions['expiresIn'] },
  );
}

export function verifyRefreshToken(token: string): RefreshPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as Partial<RefreshPayload>;
  // Eski tokenlarda `ver`/`sid` bo'lmasligi mumkin — 0/'' deb qabul qilamiz.
  // `sid` bo'sh bo'lsa sessiya topilmaydi va foydalanuvchi qaytadan kiradi (xavfsiz tomon).
  return {
    id: String(decoded.id),
    ver: Number(decoded.ver ?? 0),
    jti: String(decoded.jti ?? ''),
    sid: String(decoded.sid ?? ''),
  };
}

export function verifyAccessToken(token: string): AccessPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as Partial<AccessPayload>;
  return {
    id: String(decoded.id),
    role: String(decoded.role),
    ver: Number(decoded.ver ?? 0),
    jti: String(decoded.jti ?? ''),
  };
}

/**
 * Parolni tiklash tokeni — alohida kalit, 1 soat, bir marta ishlatiladi (ver orqali).
 * 15 daqiqa juda qisqa edi: foydalanuvchi xatni kech ochsa yoki Gmail thread'da
 * eski xatni bosса, havola allaqachon o'tib ketardi.
 */
export function signResetToken(userId: string, tokenVersion: number): string {
  return jwt.sign({ id: userId, ver: tokenVersion, purpose: 'reset' }, env.JWT_RESET_SECRET, {
    algorithm: 'HS256',
    expiresIn: '60m',
  });
}

export function verifyResetToken(token: string): { id: string; ver: number } {
  const decoded = jwt.verify(token, env.JWT_RESET_SECRET, { algorithms: ['HS256'] }) as {
    id?: string;
    ver?: number;
    purpose?: string;
  };
  if (decoded.purpose !== 'reset') throw new Error('Token maqsadi noto‘g‘ri');
  return { id: String(decoded.id), ver: Number(decoded.ver ?? 0) };
}

/**
 * Email tasdiqlash tokeni — 24 soat amal qiladi.
 * Alohida kalit (JWT_EMAIL_VERIFY_SECRET) bilan imzolanadi — reset tokenidan
 * mustaqil bo'lishi uchun.
 *
 * Nega `ver` (tokenVersion) ham kiradi: parol almashsa yoki hisob bloklansa,
 * eski tasdiqlash havolasi ham avtomatik kuchini yo'qotadi.
 */
export function signEmailVerifyToken(userId: string, tokenVersion: number): string {
  return jwt.sign(
    { id: userId, ver: tokenVersion, purpose: 'verify-email' },
    env.JWT_EMAIL_VERIFY_SECRET,
    { algorithm: 'HS256', expiresIn: '24h' },
  );
}

export function verifyEmailVerifyToken(token: string): { id: string; ver: number } {
  const decoded = jwt.verify(token, env.JWT_EMAIL_VERIFY_SECRET, {
    algorithms: ['HS256'],
  }) as {
    id?: string;
    ver?: number;
    purpose?: string;
  };
  if (decoded.purpose !== 'verify-email') throw new Error('Token maqsadi noto‘g‘ri');
  return { id: String(decoded.id), ver: Number(decoded.ver ?? 0) };
}

/**
 * Refresh sessiyasining "bo'sh turish" muddati (sliding) — cookie va DB'dagi
 * sessiya bir xil qiymatdan foydalanadi (ilgari faqat cookie'da hardcode edi).
 */
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Refresh cookie sozlamalari.
 * - Dev (localhost): sameSite 'lax' — OAuth top-level redirect'da cookie o'rnatiladi.
 * - Prod: sayt va API bitta origin'dan beriladi (`boyxon-server.onrender.com`),
 *   shu sababli `sameSite: 'lax'` yetarli va xavfsizroq. `'none'` faqat
 *   haqiqiy cross-site (alohida API domeni) holatida kerak bo'ladi.
 * - path '/api/auth' — cookie faqat auth yo'llariga yuboriladi (CSRF yuzasini kamaytiradi).
 */
export function refreshCookieOptions() {
  const isProd = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    maxAge: REFRESH_TTL_MS,
    path: '/api/auth',
  };
}
