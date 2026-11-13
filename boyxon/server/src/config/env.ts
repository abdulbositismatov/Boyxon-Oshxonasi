import dotenv from 'dotenv';
import { z } from 'zod';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { isWorkersRuntime } from '../utils/runtime';

// .env — server papkasidan qat'iy joylash (CommonJS/tsc uchun xavfsiz).
// Workers'da fayl tizimi yo'q: qiymatlar `wrangler` binding'lari orqali keladi.
if (!isWorkersRuntime) {
  const candidatePaths = [
    resolve(process.cwd(), 'boyxon', 'server', '.env'),
    resolve(process.cwd(), 'server', '.env'),
    resolve(process.cwd(), '.env'),
  ];
  for (const p of candidatePaths) {
    if (existsSync(p)) {
      dotenv.config({ path: p });
      break;
    }
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  CLIENT_URL: z.string().default('http://localhost:5173'),

  /**
   * Ishonchli proksi sozlamasi. Faqat haqiqiy proksi ortida turganda 1 (yoki undan ko'p)
   * qilib qo'yiladi. Aks holda hujumchi X-Forwarded-For sarlavhasini soxtalashtirib
   * rate-limit ni chetlab o'tishi mumkin.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/boyxon'),
  JWT_ACCESS_SECRET: z.string().default(''),
  JWT_REFRESH_SECRET: z.string().default(''),
  /** Parolni tiklash tokenlari uchun alohida kalit (refresh kaliti bilan aralashmasin). */
  JWT_RESET_SECRET: z.string().default(''),
  /** Email tasdiqlash tokeni uchun alohida kalit (reset tokenidan mustaqil). */
  JWT_EMAIL_VERIFY_SECRET: z.string().default(''),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),

  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:5000/api/auth/google/callback'),

  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),

  /**
   * Media saqlash (rasmlar). O'zbekistonda Cloudinary ba'zan ishlamaydi,
   * shu sababli asosiy variant — Cloudflare Workers + R2 (`ops/media-worker`).
   * - `MEDIA_WORKER_URL`     — media worker manzili (masalan https://boyxon-media.xxx.workers.dev)
   * - `MEDIA_WORKER_SECRET`  — yuklash/o'chirish uchun umumiy sir
   * - `MEDIA_PUBLIC_URL`     — rasmlar ko'rinadigan asosiy manzil (CDN domen bo'lsa)
   */
  MEDIA_WORKER_URL: z.string().default(''),
  MEDIA_WORKER_SECRET: z.string().default(''),
  MEDIA_PUBLIC_URL: z.string().default(''),

  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_EMAIL: z.string().default('mailto:admin@boyxon.uz'),

  /**
   * Email provayderi:
   *   auto   — mavjud kalitlarga qarab (Brevo → Resend → SMTP)
   *   brevo  — Brevo HTTP API (Workers'da tavsiya etiladi)
   *   resend — Resend HTTP API
   *   smtp   — faqat Node'da (Workers'da ishlamaydi)
   *   none   — email o'chirilgan
   */
  EMAIL_PROVIDER: z.enum(['auto', 'brevo', 'resend', 'smtp', 'none']).default('auto'),
  BREVO_API_KEY: z.string().default(''),
  RESEND_API_KEY: z.string().default(''),
  /** Yuboruvchi manzil: "Boyxon Oshxonasi <no-reply@boyxon.uz>" yoki "no-reply@boyxon.uz". */
  EMAIL_FROM: z.string().default(''),
  EMAIL_FROM_NAME: z.string().default(''),

  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  /**
   * Xatlarda ko'rinadigan "From" nomi/manzili.
   *
   * Muhim: Gmail orqali yuborilganda "From" manzili baribir SMTP_USER dagi
   * hisob bo'ladi (Gmail begona from'ga ruxsat bermaydi) — shuning uchun
   * nom (display name) orqali brend ko'rsatiladi: "Boyxon Oshxonasi <gmail>".
   * O'z domeningiz SMTP'si bo'lganda bu yerga info@boyxon.uz yozing.
   */
  SMTP_FROM_NAME: z.string().default('Boyxon Oshxonasi'),
  SMTP_FROM_EMAIL: z.string().default(''),

  ADMIN_EMAIL: z.string().default('admin@boyxon.uz'),
  ADMIN_PASSWORD: z.string().default(''),
  /** Demo hisob paroli — faqat dev uchun; production'da seed bloklangan. */
  DEMO_PASSWORD: z.string().default(''),

  /**
   * Restoran koordinatalari — yetkazib berish narxi va ETA masofa bo'yicha
   * hisoblanishi uchun. Berilmasa — qat'iy (flat) tarif ishlatiladi.
   */
  RESTAURANT_LAT: z.coerce.number().default(41.311081),
  RESTAURANT_LNG: z.coerce.number().default(69.240562),

  /** Kritik xatolar haqida ogohlantirish (Slack/Discord webhook). Bo'sh bo'lsa — o'chirilgan. */
  ALERT_WEBHOOK_URL: z.string().default(''),

  /**
   * Tasdiqlanmagan email bilan kirishga ruxsat berilsinmi.
   *
   * `false` (standart production): email tasdiqlanmaguncha login ishlamaydi — eng xavfsiz.
   * `true`: kirishga ruxsat, lekin ilova "emailni tasdiqlang" deb eslatib turadi.
   *
   * SMTP sozlanmagan bo'lsa `true` qilib qo'ying, aks holda yangi mijozlar
   * ro'yxatdan o'tib, kira olmay qoladi (xat yuborilmaydi).
   */
  ALLOW_UNVERIFIED_LOGIN: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof envSchema>;

/** Sirning kuchini tekshiradi: uzunlik + ma'lum zaif/default naqshlar. */
function secretProblem(value: string, minLen = 32): string | null {
  if (!value) return 'bo‘sh';
  if (value.length < minLen) return `juda qisqa (${value.length} belgi, kamida ${minLen} kerak)`;
  const weak = [
    'change-me',
    'changeme',
    'secret',
    'boyxon-access',
    'boyxon-refresh',
    'boyxon-reset',
    'admin123',
    'password',
    'example',
    'test',
    'localhost',
    'super-secret',
    'jwt-secret',
  ];
  const lower = value.toLowerCase();
  const hit = weak.find((w) => lower.includes(w));
  if (hit) return `taxmin qilinadigan naqsh bor ("${hit}")`;
  if (new Set(value).size < 8) return 'juda kam xil belgi ishlatilgan';
  return null;
}

/**
 * Dev uchun kalitlarni diskda saqlaydi.
 *
 * Nega kerak: har ishga tushishda yangi tasdiqlash kaliti generatsiya qilinsa,
 * oldingi urinishda yuborilgan parol tiklash / email tasdiqlash havolalari
 * server qayta ishga tushishi bilan o'ladi (foydalanuvchi uchun "havola
 * yaroqsiz" xatosi sababsiz chiqadi).
 *
 * Fayl loyiha papkasida saqlanadi va `.gitignore` da (git'ga tushmaydi).
 * Faqat NODE_ENV=development uchun ishlatiladi.
 */
function devSecret(name: string): string {
  const file = resolve(process.cwd(), '.dev-secrets.json');
  let store: Record<string, string> = {};
  try {
    if (existsSync(file)) store = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
  } catch {
    store = {};
  }
  if (typeof store[name] === 'string' && store[name].length >= 32) return store[name];
  store[name] = randomBytes(48).toString('hex');
  try {
    writeFileSync(file, JSON.stringify(store, null, 2), { encoding: 'utf8', mode: 0o600 });
  } catch {
    // Yozib bo'lmasa ham davom etamiz — shunchaki har ishga tushishda yangilanadi.
  }
  return store[name];
}

/**
 * Ishlab chiqishda kalit berilmagan bo'lsa — tasodifiy xavfsiz kalit generatsiya
 * qilamiz (eski "default sir" muammosini butunlay yo'q qiladi: hech qachon
 * taxmin qilinadigan qiymat bilan ishlamaydi).
 *
 * Production'da esa: kalit majburiy va kuchli bo'lishi shart, aks holda server ishga
 * tushmaydi (fail-closed). Bu ataylab shunday — zaif kalit bilan ishga tushib,
 * buzilgandan ko'ra ishga tushmasligi afzal.
 */
function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ .env validatsiya xatosi:', parsed.error.flatten().fieldErrors);
    throw new Error('.env validatsiyadan o‘tmadi');
  }
  const e = parsed.data;
  const isProd = e.NODE_ENV === 'production';

  // Dev/test: kalitlar `.dev-secrets.json` da saqlanadi (qayta ishga tushganda ham barqaror).
  if (!isProd) {
    e.JWT_ACCESS_SECRET ||= devSecret('JWT_ACCESS_SECRET');
    e.JWT_REFRESH_SECRET ||= devSecret('JWT_REFRESH_SECRET');
    e.JWT_RESET_SECRET ||= devSecret('JWT_RESET_SECRET');
    if (!e.ADMIN_PASSWORD) e.ADMIN_PASSWORD = devSecret('ADMIN_PASSWORD').slice(0, 20);


    /**
     * Dev'da email ko'pincha sozlanmagan bo'ladi, ya'ni tasdiqlash xati yuborilmaydi.
     * Bunday holatda email tasdiqlashni majburiy qilib qo'ysak, yangi hisoblar
     * umuman kira olmay qolardi. Shu sababli faqat shu holatda ruxsat beramiz.
     */
    const hasEmailProvider =
      e.EMAIL_PROVIDER !== 'none' &&
      (Boolean(e.BREVO_API_KEY) || Boolean(e.RESEND_API_KEY) || Boolean(e.SMTP_USER && e.SMTP_PASS));
    if (!hasEmailProvider && process.env.ALLOW_UNVERIFIED_LOGIN === undefined) {
      e.ALLOW_UNVERIFIED_LOGIN = true;
      console.warn('⚠️  Email provayderi sozlanmagan — email tasdiqlash vaqtincha majburiy emas (faqat dev)');
    }
  }

  if (isProd) {
    const failures: string[] = [];
    const secrets: [string, string][] = [
      ['JWT_ACCESS_SECRET', e.JWT_ACCESS_SECRET],
      ['JWT_REFRESH_SECRET', e.JWT_REFRESH_SECRET],
      ['JWT_RESET_SECRET', e.JWT_RESET_SECRET],
    ];
    for (const [name, value] of secrets) {
      const problem = secretProblem(value);
      if (problem) failures.push(`${name}: ${problem}`);
    }
    // Kalitlar bir-biridan farq qilishi shart — biri oqsa, qolganlari ham ochilmasin.
    if (e.JWT_ACCESS_SECRET && e.JWT_ACCESS_SECRET === e.JWT_REFRESH_SECRET) {
      failures.push('JWT_ACCESS_SECRET va JWT_REFRESH_SECRET bir xil bo‘lmasligi kerak');
    }

    const adminProblem = secretProblem(e.ADMIN_PASSWORD, 12);
    if (adminProblem) failures.push(`ADMIN_PASSWORD: ${adminProblem}`);
    if (!/@/.test(e.ADMIN_EMAIL)) failures.push('ADMIN_EMAIL: email formati noto‘g‘ri');
    if (/localhost|127\.0\.0\.1/.test(e.CLIENT_URL)) {
      failures.push('CLIENT_URL: production uchun haqiqiy domen kerak');
    }
    if (/localhost|127\.0\.0\.1/.test(e.MONGODB_URI)) {
      console.warn('⚠️  MONGODB_URI lokal bazaga ishora qilyapti — production uchun tekshiring');
    }

    // Workers'da SMTP ishlamaydi. Email provayderi bo'lmasa yangi mijozlar
    // tasdiqlash xatini olmaydi va (ALLOW_UNVERIFIED_LOGIN=false bo'lsa)
    // ro'yxatdan o'tgach kira olmaydi.
    const httpEmail = Boolean(e.BREVO_API_KEY || e.RESEND_API_KEY);
    const smtpEmail = !isWorkersRuntime && Boolean(e.SMTP_USER && e.SMTP_PASS);
    if (e.EMAIL_PROVIDER === 'none' || (!httpEmail && !smtpEmail)) {
      console.warn(
        '⚠️  Email provayderi sozlanmagan — tasdiqlash/parol tiklash xatlari yuborilmaydi. ' +
          (isWorkersRuntime ? 'BREVO_API_KEY yoki RESEND_API_KEY qo‘shing.' : 'SMTP yoki HTTP provayder qo‘shing.'),
      );
    }

    /**
     * Rasm saqlash. Render diski ephemeral — lokal `uploads/` papkasi har
     * deploy/restart'da o'chadi va barcha taom rasmlari yo'qoladi.
     * Shu sababli production'da lokal fayl saqlash butunlay o'chiriladi:
     * saqlash sozlanmagan bo'lsa, rasm yuklash aniq xato qaytaradi
     * (jimgina yo'qotishdan ko'ra yaxshiroq).
     */
    const hasMediaStorage =
      Boolean(e.MEDIA_WORKER_URL && e.MEDIA_WORKER_SECRET) ||
      Boolean(e.CLOUDINARY_CLOUD_NAME && e.CLOUDINARY_API_KEY && e.CLOUDINARY_API_SECRET);
    if (!hasMediaStorage) {
      console.warn(
        '⚠️  Rasm saqlash sozlanmagan — rasm yuklash o‘chirilgan. ' +
          'MEDIA_WORKER_URL + MEDIA_WORKER_SECRET (tavsiya) yoki CLOUDINARY_* ni qo‘shing.',
      );
    }

    if (failures.length > 0) {
      console.error('❌ PRODUCTION xavfsizlik tekshiruvi muvaffaqiyatsiz:');
      for (const f of failures) console.error(`   • ${f}`);
      console.error('\n💡 Kuchli kalit generatsiya qilish:  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
      throw new Error('Production uchun xavfsizlik sozlamalari yetarli emas (yuqoriga qarang)');
    }
  } else {
    // Dev'da ham ogohlantiramiz — e'tiborsiz qolmasin.
    for (const [name, value] of [
      ['JWT_ACCESS_SECRET', e.JWT_ACCESS_SECRET],
      ['JWT_REFRESH_SECRET', e.JWT_REFRESH_SECRET],
      ['JWT_RESET_SECRET', e.JWT_RESET_SECRET],
    ] as [string, string][]) {
      const problem = secretProblem(value);
      if (problem && process.env[name]) {
        console.warn(`⚠️  ${name} zaif: ${problem} — production'dan oldin almashtiring`);
      }
    }
  }

  return e;
}

export const env = loadEnv();
export const isProd = env.NODE_ENV === 'production';

/** Redirect/email havolalari uchun birinchi CLIENT_URL (vergul bilan ajratilgan ro'yxatdan). */
export function primaryClientUrl(): string {
  const first = env.CLIENT_URL.split(',')[0]?.trim().replace(/\/$/, '') ?? '';
  return first || 'http://localhost:5173';
}

/**
 * CORS uchun ruxsat etilgan manbalar: CLIENT_URL ro'yxati (vergul bilan ajratilgan).
 *
 * `*` ishlatilmaydi — credentials: true bilan birga xavfli.
 */
export function corsOrigins(): string[] {
  return Array.from(
    new Set(
      env.CLIENT_URL.split(',')
        .map((s) => s.trim().replace(/\/$/, ''))
        .filter(Boolean),
    ),
  );
}

/**
 * Media (rasm) origin'i — CSP `img-src` va client uchun.
 * Bo'sh bo'lsa `''` (sozlanmagan).
 */
export function mediaOrigin(): string {
  const raw = env.MEDIA_PUBLIC_URL || env.MEDIA_WORKER_URL;
  if (!raw) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
}

/** Production'da rasm saqlash umuman sozlanganmi? */
export function mediaStorageConfigured(): boolean {
  return (
    Boolean(env.MEDIA_WORKER_URL && env.MEDIA_WORKER_SECRET) ||
    Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET)
  );
}
