/**
 * Admin hisobini ishga tushishda kafolatlash.
 *
 * Muammo: `Admin panelga faqat ADMIN_EMAIL + ADMIN_PASSWORD (env)` talabi bor,
 * lekin hisobni yaratadigan yagona yo'l — qo'lda `upsert-admin` skripti.
 * Production'da u ishga tushirilmagan bo'lsa, admin panelga kirib bo'lmaydi
 * (parolni tiklash esa email provayderiga bog'liq).
 *
 * Shu sababli har ishga tushishda (idempotent):
 *  - hisob yo'q bo'lsa — yaratiladi;
 *  - mavjud bo'lsa — role=admin, emailVerified=true, isActive=true;
 *  - env'dagi parol hisobdagidan farq qilsa — yangilanadi.
 *
 * `tokenVersion` oshirilmaydi: parol env'dan boshqarilgani uchun har
 * deploy'da barcha admin sessiyalari uzilib qolmasligi kerak.
 */
import { env } from '../config/env';
import { User } from '../models/User.model';
import { logger } from './logger';

export async function ensureAdminAccount(): Promise<void> {
  if (!env.ADMIN_PASSWORD) return;

  const email = env.ADMIN_EMAIL.toLowerCase();
  const existing = await User.findOne({ email }).select('+password');

  if (!existing) {
    await User.create({
      name: 'Admin',
      email,
      password: env.ADMIN_PASSWORD,
      role: 'admin',
      emailVerified: true,
    });
    logger.info({ email }, '👑 Admin hisobi yaratildi (env asosida)');
    return;
  }

  const patch: Record<string, unknown> = {};
  if (existing.role !== 'admin') patch.role = 'admin';
  if (!existing.emailVerified) patch.emailVerified = true;
  if (!existing.isActive) patch.isActive = true;

  const passwordMatches =
    Boolean(existing.password) && (await existing.comparePassword(env.ADMIN_PASSWORD));
  if (!passwordMatches) {
    patch.password = env.ADMIN_PASSWORD; // pre('save') hook hash qiladi
  }

  if (Object.keys(patch).length > 0) {
    existing.set(patch);
    await existing.save();
    logger.info(
      { email, fields: Object.keys(patch) },
      '👑 Admin hisobi env bilan sinxronlandi',
    );
  }
}
