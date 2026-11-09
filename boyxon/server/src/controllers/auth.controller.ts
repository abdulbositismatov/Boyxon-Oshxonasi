import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { User } from '../models/User.model';
import { RefreshSession } from '../models/RefreshSession.model';
import { registerUser, loginUser, issueTokens, createRefreshSession } from '../services/auth.service';
import {
  verifyRefreshToken,
  signResetToken,
  verifyResetToken,
  verifyEmailVerifyToken,
  refreshCookieOptions,
  REFRESH_TTL_MS,
} from '../services/token.service';
import { sendResetEmail, sendVerifyCodeEmail } from '../services/email.service';
import {
  consumeVerificationCode,
  issueVerificationCode,
  canResendVerificationCode,
  VERIFY_CODE_RESEND_MS,
  VERIFY_CODE_TTL_MS,
} from '../services/verification.service';
import { env, primaryClientUrl } from '../config/env';
import { logger } from '../utils/logger';
import { runInBackground } from '../utils/background';
import type { AuthRequest } from '../types/express';
import { OAuth2Client } from 'google-auth-library';

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refreshToken', token, refreshCookieOptions());
}

/** Refresh cookie'ni o'chirish (o'rnatilgandagi option'lar bilan aynan). */
function clearRefreshCookie(res: Response): void {
  res.clearCookie('refreshToken', { ...refreshCookieOptions(), maxAge: undefined });
}

/** So'rovdagi qurilma ma'lumoti (sessiyalarni ajratish uchun, max 255 belgi). */
function userAgentOf(req: Request): string {
  return String(req.headers['user-agent'] ?? '').slice(0, 255);
}

/**
 * POST /api/auth/register — yangi hisob ochish.
 * Body: { name, email, phone?, password }
 *
 * Email uch darajada tekshiriladi (format → bir martalik domen → MX yozuvi) va
 * tasdiqlash havolasi yuboriladi. Tasdiqlanmaguncha kirish yopiq bo'ladi
 * (`ALLOW_UNVERIFIED_LOGIN` bilan boshqariladi).
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await registerUser(req.body, userAgentOf(req));

  // Tasdiqlash kodini yuboramiz. Email provayderi yo'q bo'lsa `false` qaytadi.
  const sent = await issueVerificationCodeEmail(user);

  /**
   * Muhim: email tasdiqlash majburiy bo'lsa (`ALLOW_UNVERIFIED_LOGIN=false`),
   * ro'yxatdan o'tishda token BERILMAYDI.
   *
   * Aks holda himoya chetlab o'tilardi: foydalanuvchi ro'yxatdan o'tib, login
   * qilmasdan turib to'liq API huquqiga ega bo'lardi (login'dagi tekshiruv
   * shunchaki aylanib o'tilardi).
   */
  const mustVerify = !env.ALLOW_UNVERIFIED_LOGIN && !user.emailVerified;
  if (!mustVerify) {
    setRefreshCookie(res, refreshToken);
  }

  res.status(201).json(
    ok(
      {
        accessToken: mustVerify ? null : accessToken,
        user,
        verificationSent: sent,
        verificationRequired: mustVerify,
        // Xat yuborilmagan bo'lsa frontend aniq xabar ko'rsatadi.
        emailDelivered: sent,
      },
      mustVerify
        ? 'Ro‘yxatdan o‘tdingiz! Email manzilingizga 6 xonali tasdiqlash kodi yuborildi — hisobni faollashtirish uchun kodni kiriting.'
        : 'Ro‘yxatdan o‘tdingiz!',
    ),
  );
});

/** Tasdiqlash kodini yaratib, emailga yuboradi. Yuborilgan bo'lsa `true`. */
async function issueVerificationCodeEmail(user: {
  id?: string;
  _id?: unknown;
  email: string;
}): Promise<boolean> {
  const userId = String(user.id ?? user._id);
  const code = await issueVerificationCode(userId);
  return sendVerifyCodeEmail(user.email, code);
}

/**
 * POST /api/auth/verify-email/:token — emailni tasdiqlash.
 *
 * Token bir martalik: tasdiqlangandan keyin `tokenVersion` oshiriladi, shuning uchun
 * o'sha havola qayta ishlatilmaydi.
 */
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;
  let payload: { id: string; ver: number };
  try {
    payload = verifyEmailVerifyToken(token);
  } catch {
    throw ApiError.badRequest('Havola yaroqsiz yoki muddati o‘tgan (24 soat)');
  }
  const user = await User.findById(payload.id);
  if (!user) throw ApiError.notFound('Foydalanuvchi topilmadi');
  // Avval token avlodini tekshiramiz: token bir martalik, qayta ishlatilsa eskiradi.
  if ((user.tokenVersion ?? 0) !== payload.ver) {
    // Allaqachon tasdiqlangan bo'lsa — bu xato emas, shunchaki takroriy bosish.
    if (user.emailVerified) {
      return res.json(ok({ alreadyVerified: true, email: user.email }, 'Email allaqachon tasdiqlangan'));
    }
    throw ApiError.badRequest('Bu havola eskirgan — yangisini so‘rang');
  }
  if (user.emailVerified) {
    return res.json(ok({ alreadyVerified: true, email: user.email }, 'Email allaqachon tasdiqlangan'));
  }
  user.emailVerified = true;
  // Token bir martalik bo'lishi uchun avlodni oshiramiz (boshqa sessiyalarga ta'sir qilmaydi).
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
  logger.info({ userId: user.id }, 'Email tasdiqlandi');
  res.json(ok({ email: user.email }, 'Email tasdiqlandi! Endi kirishingiz mumkin.'));
});

/**
 * POST /api/auth/verify-code — 6 xonali kod bilan emailni tasdiqlash.
 * Body: { email, code }
 *
 * Muvaffaqiyatli bo'lsa darhol token beriladi — foydalanuvchi qayta login
 * qilishi shart emas. Kod bir martalik (muvaffaqiyatdan keyin o'chiriladi).
 */
export const verifyEmailCode = asyncHandler(async (req: Request, res: Response) => {
  const { email, code } = req.body as { email: string; code: string };
  const { user, alreadyVerified } = await consumeVerificationCode(email, code);

  // Allaqachon tasdiqlangan hisobga kod orqali token bermaymiz — aks holda
  // emailni bilgan har kim parolsiz kirib ketardi.
  if (alreadyVerified) {
    res.json(ok({ alreadyVerified: true }, 'Email allaqachon tasdiqlangan — parolingiz bilan kiring'));
    return;
  }

  user.lastLoginAt = new Date();
  user.failedLoginAttempts = 0;
  await user.save();
  logger.info({ userId: user.id }, 'Email kodi bilan tasdiqlandi');

  const sid = await createRefreshSession(user.id as string, userAgentOf(req));
  const { accessToken, refreshToken } = issueTokens(
    user.id as string,
    user.role,
    user.tokenVersion ?? 0,
    sid,
  );
  setRefreshCookie(res, refreshToken);

  res.json(ok({ accessToken, user }, 'Email tasdiqlandi! Xush kelibsiz.'));
});

/**
 * POST /api/auth/resend-verification — tasdiqlash kodini qayta yuborish.
 * Body: { email }
 *
 * Javob har doim bir xil (email ro'yxatda bor-yo'qligini oshkor qilmaydi) va
 * 60 soniyalik cooldown jimgina qo'llanadi.
 */
export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  const user = await User.findOne({ email: email.toLowerCase() });
  if (user && !user.emailVerified && user.isActive) {
    if (await canResendVerificationCode(user.id as string)) {
      // Fonda yuboramiz — javob natijadan qat'i nazar bir xil (enumeration himoyasi).
      runInBackground(
        issueVerificationCodeEmail(user).catch((err) =>
          logger.error({ err, email: user.email }, 'Tasdiqlash kodi qayta yuborilmadi'),
        ),
      );
    }
  }
  res.json(ok(null, 'Agar bu email ro‘yxatda bo‘lsa va tasdiqlanmagan bo‘lsa, yangi kod yuborildi'));
});

/**
 * GET /api/auth/me — joriy foydalanuvchi (auth talab qiladi).
 */

/**
 * POST /api/auth/login — email + parol bilan kirish.
 *
 * Email tasdiqlanmagan bo'lsa 403 + `code: 'EMAIL_NOT_VERIFIED'` qaytadi.
 * Frontend shu kodga qarab "qayta yuborish" tugmasini ko'rsatadi.
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  try {
    const { accessToken, refreshToken } = await loginUser(email, password, userAgentOf(req));
    const user = await User.findOne({ email: email.toLowerCase() });
    setRefreshCookie(res, refreshToken);
    res.json(
      ok(
        {
          accessToken,
          user,
        },
        'Xush kelibsiz!',
      ),
    );
  } catch (e) {
    // Maxsus holat: parol to'g'ri, lekin email tasdiqlanmagan.
    if (e instanceof ApiError && e.code === 'EMAIL_NOT_VERIFIED') {
      res.status(403).json({
        success: false,
        message: 'Email manzilingiz hali tasdiqlanmagan. Pochtangizga yuborilgan 6 xonali kodni kiriting.',
        code: 'EMAIL_NOT_VERIFIED',
        data: { email: email.toLowerCase() },
      });
      return;
    }
    throw e;
  }
});

/** POST /api/auth/logout — faqat shu qurilma sessiyasini yopish (cookie ni ham tozalash). */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken as string | undefined;
  if (token) {
    // Cookie buzilgan/imzosi noto'g'ri bo'lsa ham xato bermaymiz — baribir tozalanadi.
    try {
      const payload = verifyRefreshToken(token);
      if (payload.sid) await RefreshSession.deleteOne({ user: payload.id, sid: payload.sid });
    } catch {
      /* jim */
    }
  }
  // clearCookie aynan o'rnatilgan option'lar bilan bo'lishi kerak (path + sameSite + secure),
  // aks holda brauzer cookie'ni o'chirmaydi va refresh qayta login qilib qo'yadi.
  clearRefreshCookie(res);
  res.json(ok(null, 'Chiqish muvaffaqiyatli'));
});

/**
 * POST /api/auth/logout-all — barcha qurilmalardan chiqish.
 * tokenVersion oshiriladi + barcha refresh sessiyalari o'chiriladi — hamma token darhol o'ladi.
 */
export const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.id;
  const user = await User.findById(userId);
  if (user) await user.bumpTokenVersion();
  await RefreshSession.deleteMany({ user: userId });
  clearRefreshCookie(res);
  res.json(ok(null, 'Barcha qurilmalardan chiqdingiz'));
});

/**
 * POST /api/auth/refresh — cookie dagi refresh token orqali yangi access token.
 *
 * Har qurilma O'Z sessiyasiga ega (`sid`): bu so'rov faqat shu sessiyani tekshiradi
 * va muddatini cho'zadi — boshqa qurilmalarning sessiyalari TEGILMAYDI
 * (ilgari global tokenVersion oshirilardi va telefon + noutbuk bir-birini
 * chiqarib yuborardi — regressiya testi: test-e2e.ts "ko'p qurilma" bloki).
 *
 * Sessiya o'chirilgan bo'lsa (logout qilingan qurilma, bloklangan hisob,
 * parol almashgan) — 401. `ver` mos kelsa ham sessiya majburiy.
 */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken as string | undefined;
  // Cookie yo'q — bu xato emas, shunchaki mehmon sessiyasi. 200 qaytaramiz:
  // aks holda birinchi tashrifda brauzer konsolida 401 "xato" paydo bo'ladi
  // (Lighthouse Best Practices: errors-in-console).
  if (!token) {
    res.json(ok({ accessToken: null, user: null }, 'Sessiya yo‘q'));
    return;
  }
  let payload: { id: string; ver: number; sid: string };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw ApiError.unauthorized('Refresh token yaroqsiz');
  }
  const user = await User.findById(payload.id);
  if (!user || !user.isActive) throw ApiError.unauthorized('Foydalanuvchi topilmadi');
  // Global bekor qilish: parol almashgan / hammasidan chiqilgan / bloklangan holatlar.
  if ((user.tokenVersion ?? 0) !== payload.ver) {
    throw ApiError.unauthorized('Sessiya bekor qilingan — qaytadan kiring');
  }
  const session = payload.sid
    ? await RefreshSession.findOne({ user: user._id, sid: payload.sid })
    : null;
  if (!session) {
    // Sessiya topilmadi: logout qilingan, muddati o'tgan yoki eski (deploy oldidan)
    // token. Qaytadan kirish talab qilinadi — boshqa qurilmalar zarar ko'rmaydi.
    throw ApiError.unauthorized('Sessiya topilmadi — qaytadan kiring');
  }

  // Sliding expiry: faol qurilma har yangilanishda yana 7 kun oladi.
  session.expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  session.lastUsedAt = new Date();
  await session.save();

  // tokenVersion OSHIRILMAYDI — aks holda boshqa qurilmalar o'lardi.
  const tokens = issueTokens(user.id as string, user.role, user.tokenVersion ?? 0, payload.sid);
  setRefreshCookie(res, tokens.refreshToken);
  res.json(
    ok(
      {
        accessToken: tokens.accessToken,
        user,
      },
      'Token yangilandi',
    ),
  );
});

/** GET /api/auth/me — joriy foydalanuvchi (auth talab qiladi). */
export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById((req as AuthRequest).user!.id);
  if (!user) throw ApiError.notFound('Foydalanuvchi topilmadi');
  res.json(ok(user, 'OK'));
});

/**
 * GET /api/auth/google/callback — Passport Google dan qaytganda.
 *
 * Xavfsizlik: access token endi URL'da BERILMAYDI. Buning o'rniga bir martalik,
 * 60 soniya yashaydigan kod beriladi; frontend uni POST /api/auth/google/exchange
 * orqali tokenga almashtiradi. Sabab: URL manzillar brauzer tarixiga, server
 * loglariga va Referer sarlavhasi orqali uchinchi tomonlarga tushib qoladi.
 */
const googleCodes = new Map<string, { userId: string; expiresAt: number }>();

export function takeGoogleCode(code: string): string | null {
  const entry = googleCodes.get(code);
  if (!entry) return null;
  googleCodes.delete(code); // bir martalik — qayta ishlatilmaydi
  if (entry.expiresAt < Date.now()) return null;
  return entry.userId;
}

export const googleCallback = asyncHandler(async (req: Request, res: Response) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = req.user as any;
  const userDoc = user?._id ? user : await User.findOne({ email: user?.email });
  if (!userDoc) throw ApiError.unauthorized('Google login xatosi');
  const base = `${primaryClientUrl()}/auth`;
  if (!userDoc.isActive) {
    return res.redirect(`${base}?error=blocked`);
  }
  // TALAB: admin panel faqat ADMIN_EMAIL + parol bilan kiradi — Google orqali emas.
  // Aks holda Google hisobi egasi parolisiz kira olardi.
  if (userDoc.role === 'admin') {
    return res.redirect(`${base}?error=admin_password_only`);
  }
  userDoc.lastLoginAt = new Date();
  await userDoc.save();

  const code = randomCode();
  googleCodes.set(code, { userId: userDoc.id as string, expiresAt: Date.now() + 60_000 });
  // Eskirgan kodlarni tozalash (xotira o'sib ketmasligi uchun).
  if (googleCodes.size > 500) {
    for (const [k, v] of googleCodes) if (v.expiresAt < Date.now()) googleCodes.delete(k);
  }

  res.redirect(`${base}/callback?code=${code}`);
});

/**
 * POST /api/auth/google/exchange — bir martalik kodni tokenga almashtirish.
 * Body: { code }
 */
export const googleExchange = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body as { code?: string };
  if (!code) throw ApiError.badRequest('Kod kerak');
  const userId = takeGoogleCode(code);
  if (!userId) throw ApiError.unauthorized('Kod yaroqsiz yoki muddati o‘tgan');
  const user = await User.findById(userId);
  if (!user || !user.isActive) throw ApiError.unauthorized('Foydalanuvchi topilmadi');
  const sid = await createRefreshSession(user.id as string, userAgentOf(req));
  const tokens = issueTokens(user.id as string, user.role, user.tokenVersion ?? 0, sid);
  setRefreshCookie(res, tokens.refreshToken);
  res.json(
    ok(
      {
        accessToken: tokens.accessToken,
        user,
      },
      'Kirdingiz',
    ),
  );
});

/**
 * POST /api/auth/google/mobile — Google ID token bilan mobil ilovadan kirish.
 * Body: { idToken: string }
 *
 * Mobil ilova `google_sign_in` paketi orqali Google ID tokenini oladi,
 * shu endpointga yuboradi. Server tokenni tekshiradi, foydalanuvchini
 * topadi/yaratadi va access/refresh tokenlarini qaytaradi.
 */
export const googleMobile = asyncHandler(async (req: Request, res: Response) => {
  const { idToken } = req.body as { idToken?: string };
  if (!idToken) throw ApiError.badRequest('ID token kerak');

  // Google Client ID ni tekshirish uchun OAuth2Client yaratamiz
  const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (e) {
    logger.warn({ err: e }, 'Google ID token tasdiqlanmadi');
    throw ApiError.unauthorized('Yaroqsiz Google token');
  }

  if (!payload) throw ApiError.unauthorized('Token payload yo‘q');

  // Email tasdiqlanganligini tekshiramiz (Google o'zi tasdiqlagan bo'lsa)
  const email = payload.email?.toLowerCase();
  const emailVerified = payload.email_verified === true;
  const googleId = payload.sub;
  const name = payload.name || email?.split('@')[0] || 'Foydalanuvchi';
  const avatar = payload.picture ?? null;

  if (!email) throw ApiError.badRequest('Google email bermadi');
  if (!emailVerified) throw ApiError.badRequest('Google email tasdiqlanmagan');

  // Foydalanuvchini googleId yoki email bo'yicha topamiz
  let user = await User.findOne({
    $or: [{ googleId }, { email }],
  });

  if (user && !user.isActive) {
    throw ApiError.unauthorized('Hisob bloklangan');
  }

  if (!user) {
    // Yangi foydalanuvchi yaratamiz
    user = await User.create({
      name,
      email,
      googleId,
      avatar,
      role: 'user',
      emailVerified: true, // Google tasdiqlagan
    });
  } else {
    // Mavjud foydalanuvchini yangilaymiz
    if (!user.googleId) {
      user.googleId = googleId;
      // Agar email oldin tasdiqlanmagan bo'lsa, endi tasdiqlaymiz
      // va parolni o'chiramiz (xavfsizlik uchun)
      if (!user.emailVerified) {
        user.password = undefined;
        user.name = name;
        user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      }
    }
    if (!user.avatar) user.avatar = avatar;
    user.emailVerified = true;
    user.lastLoginAt = new Date();
    await user.save();
  }

  // Admin panel faqat parol bilan kiradi — Google orqali emas
  if (user.role === 'admin') {
    throw ApiError.forbidden('Admin paneli faqat parol bilan kiriladi');
  }

  const sid = await createRefreshSession(user.id as string, userAgentOf(req));
  const tokens = issueTokens(user.id as string, user.role, user.tokenVersion ?? 0, sid);
  setRefreshCookie(res, tokens.refreshToken);

  res.json(
    ok(
      {
        accessToken: tokens.accessToken,
        user,
      },
      'Google bilan kirdingiz',
    ),
  );
});

function randomCode(): string {
  // crypto.randomUUID — kriptografik jihatdan xavfsiz, taxmin qilinmaydi.
  return randomUUID();
}

/** POST /api/auth/forgot-password — reset havolasini emailga yuborish. */
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  const user = await User.findOne({ email: email.toLowerCase() });
  if (user) {
    const token = signResetToken(user.id as string, user.tokenVersion ?? 0);
    const link = `${primaryClientUrl()}/reset-password/${token}`;
    // Xatni KUTMAYDIM — fonda yuboramiz. Gmail SMTP sekin bo'lishi mumkin
    // (2-10s), foydalanuvchi tugmani bosgach javobni DARHOL ko'radi. Xato
    // bo'lsa logga yoziladi; javob baribir bir xil (enumeration himoyasi saqlanadi).
    runInBackground(
      sendResetEmail(user.email, link).catch((err) =>
        logger.error({ err, email: user.email }, 'Parol tiklash xati yuborilmadi'),
      ),
    );
  }
  // Javob har doim bir xil — email ro'yxatda bor-yo'qligini aniqlash imkoni bo'lmasin.
  res.json(ok(null, 'Agar email ro‘yxatda bo‘lsa, havola yuborildi'));
});

/**
 * Reset tokenini tekshirish. Muddati o'tganini "yaroqsiz"dan ajratamiz —
 * foydalanuvchi nima qilish kerakligini tushunsin.
 */
function verifyResetTokenOrThrow(token: string): { id: string; ver: number } {
  try {
    return verifyResetToken(token);
  } catch (e) {
    if ((e as { name?: string }).name === 'TokenExpiredError') {
      throw ApiError.badRequest('Havolaning muddati o‘tgan. Yangi havola so‘rang.');
    }
    throw ApiError.badRequest('Havola yaroqsiz. Yangi havola so‘rang.');
  }
}

/**
 * GET /api/auth/reset-password/:token/info — havola yaroqliligini tekshirish
 * va qaysi email uchunligini ko'rsatish (parolni o'zgartirmaydi).
 *
 * Email'ni yashirish kerakmi? Yo'q — bu havola faqat shu email egasining
 * pochtasiga kelgan, shuning uchun emailni ko'rsatish enumeration emas.
 * Aksincha, foydalanuvchi "qaysi hisobim uchun" ekanini ko'rib ishonch hosil qiladi.
 */
export const resetPasswordInfo = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;
  const payload = verifyResetTokenOrThrow(token);
  const user = await User.findById(payload.id).select('email tokenVersion isActive');
  if (!user || !user.isActive) throw ApiError.notFound('Foydalanuvchi topilmadi');
  if ((user.tokenVersion ?? 0) !== payload.ver) {
    throw ApiError.badRequest('Bu havola allaqachon ishlatilgan');
  }
  res.json(ok({ email: user.email }));
});

/**
 * POST /api/auth/reset-password/:token — yangi parol o'rnatish.
 *
 * Xavfsizlik: token alohida kalit bilan imzolangan, 1 soat amal qiladi va
 * bir marta ishlatiladi (tokenVersion oshiriladi). Parol almashgach barcha eski
 * sessiyalar o'ladi.
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;
  const { password } = req.body as { password: string };
  const payload = verifyResetTokenOrThrow(token);
  const user = await User.findById(payload.id);
  if (!user) throw ApiError.notFound('Foydalanuvchi topilmadi');
  // Token bir marta ishlaydi: tokenVersion o'zgargan bo'lsa, havola eskirgan.
  if ((user.tokenVersion ?? 0) !== payload.ver) {
    throw ApiError.badRequest('Bu havola allaqachon ishlatilgan');
  }
  user.password = password;
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();
  // Parol almashdi — barcha qurilmalar sessiyalari o'chadi (o'g'irlangan sessiyalar o'ladi).
  await RefreshSession.deleteMany({ user: user._id });
  logger.info({ userId: user.id }, 'Parol tiklandi — barcha eski sessiyalar bekor qilindi');
  res.json(ok(null, 'Parol yangilandi. Endi qaytadan kiring.'));
});

/** PATCH /api/auth/change-password — auth talab qiladi. */
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { oldPassword, newPassword } = req.body as { oldPassword: string; newPassword: string };
  const user = await User.findById((req as AuthRequest).user!.id).select('+password');
  if (!user) throw ApiError.notFound('Foydalanuvchi topilmadi');
  if (!user.password || !(await user.comparePassword(oldPassword))) {
    throw ApiError.badRequest('Eski parol noto‘g‘ri');
  }
  if (oldPassword === newPassword) {
    throw ApiError.badRequest('Yangi parol eskisidan farq qilishi kerak');
  }
  user.password = newPassword;
  // Parol almashdi — barcha eski tokenlar va sessiyalar bekor qilinadi
  // (o'g'irlangan sessiyalar o'ladi), joriy qurilma yangi sessiya oladi.
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
  await RefreshSession.deleteMany({ user: user._id });
  const sid = await createRefreshSession(user.id as string, userAgentOf(req));
  const tokens = issueTokens(user.id as string, user.role, user.tokenVersion, sid);
  setRefreshCookie(res, tokens.refreshToken);
  res.json(
    ok(
      {
        accessToken: tokens.accessToken,
      },
      'Parol o‘zgartirildi',
    ),
  );
});
