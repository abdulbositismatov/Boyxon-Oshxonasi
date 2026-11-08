import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { corsOrigins, env, isProd } from './config/env';
import { initPassport } from './config/passport';
import { errorHandler } from './middlewares/error.middleware';
import { jsonBody } from './middlewares/body.middleware';
import { apiLimiter } from './middlewares/rateLimit.middleware';
import { isWorkersRuntime } from './utils/runtime';
import { authRouter } from './routes/auth.routes';
import { categoryRouter } from './routes/category.routes';
import { dishRouter } from './routes/dish.routes';
import { orderRouter } from './routes/order.routes';
import { promoRouter } from './routes/promo.routes';
import { userRouter } from './routes/user.routes';
import { notificationRouter } from './routes/notification.routes';
import { pushRouter } from './routes/push.routes';
import { chatRouter } from './routes/chat.routes';
import { settingsRouter } from './routes/setting.routes';
import { adminRouter } from './routes/admin.routes';
import { apiRobots, sitemap } from './controllers/seo.controller';

/**
 * SPA HTML va statik fayllar uchun CSP. Ilgari bu Render static site
 * sozlamasida (`render.yaml`) turardi; endi frontend backend'dan beriladi.
 * `connect-src 'self'` API va WebSocket'ni (wss) ham qamrab oladi.
 */
const SITE_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com https://tile.openstreetmap.org",
  "font-src 'self' data:",
  "connect-src 'self' https://boyxon-server.onrender.com wss://boyxon-server.onrender.com https://nominatim.openstreetmap.org",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
  "trusted-types 'safe-script' 'safe-url' 'html'",
].join('; ');

export function createApp() {
  const app = express();

  /**
   * Ishonchli proksi FAQAT sozlangan bo'lsa yoqiladi.
   *
   * Ilgari bu shartsiz `1` edi — bu xavfli: proksi ortida bo'lmaganda hujumchi
   * `X-Forwarded-For: <tasodifiy IP>` sarlavhasini yuborib, har bir so'rovda yangi
   * "IP" ko'rsatib rate-limit ni butunlay chetlab o'tishi mumkin edi.
   */
  if (env.TRUST_PROXY > 0) app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
      // CSP faqat API javoblariga qo'llanadi (pastda). SPA HTML uchun sayt CSP'si
      // ishlatiladi — aks holda `default-src 'none'` butun frontend'ni bloklaydi.
      contentSecurityPolicy: false,
      referrerPolicy: { policy: 'no-referrer' },
      hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    }),
  );

  // API javoblari uchun qat'iy CSP (HTML emas — API hech narsa render qilmaydi).
  app.use(
    '/api',
    helmet.contentSecurityPolicy({
      useDefaults: true,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    }),
  );

  // CORS: faqat aniq ro'yxatdagi domenlar (CLIENT_URL).
  // `*` hech qachon ishlatilmaydi, chunki credentials: true bilan birga xavfli.
  const allowedOrigins = corsOrigins();
  app.use(
    cors({
      origin: (origin, cb) => {
        // Origin yo'q (server-to-server, curl) — ruxsat.
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin.replace(/\/$/, ''))) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400,
    }),
  );

  // Javoblarda Express versiyasini oshkor qilmaymiz.
  app.disable('x-powered-by');

  app.use(jsonBody);
  app.use(cookieParser());

  // Rasm yuklash papkasini ochiq qilamiz (faqat Node — Workers'da fayl tizimi yo'q).
  if (!isWorkersRuntime) {
    app.use(
      '/uploads/dishes',
      express.static(path.resolve(process.cwd(), 'uploads', 'dishes')),
    );
  }

  initPassport();
  app.use(passport.initialize());

  /**
   * Client Google OAuth'dan oldin shu endpoint orqali Render server
   * uyg'onganini tekshiradi. Javob keshlanmasligi kerak — aks holda
   * server uxlab qolgan bo'lsa ham eski 200 qaytishi mumkin.
   */
  app.get('/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.json({ success: true, message: 'Boyxon API ishlayapti', data: { time: new Date().toISOString() } });
  });

  // SEO: sitemap va API robots.txt (client robots.txt shu manzilga ishora qiladi).
  app.get('/sitemap.xml', sitemap);
  app.get('/robots.txt', apiRobots);

  app.use('/api', (_req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  });
  app.use('/api', apiLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api/categories', categoryRouter);
  app.use('/api/dishes', dishRouter);
  app.use('/api/orders', orderRouter);
  app.use('/api/promos', promoRouter);
  app.use('/api/users', userRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/push', pushRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/admin', adminRouter);

  /**
   * Production'da SPA'ni shu serverning o'zidan beramiz (bitta origin).
   *
   * Sabab: `onrender.com` public suffix ro'yxatida, shuning uchun
   * `boyxon-client.onrender.com` va `boyxon-server.onrender.com` brauzer uchun
   * cross-site hisoblanadi va refresh-cookie ba'zi brauzerlarda bloklanadi.
   * Bitta origin (`boyxon-server.onrender.com`) bu muammoni butunlay yo'q qiladi.
   */
  if (!isWorkersRuntime && isProd) {
    // dist/app.js → ../../client/dist = boyxon/client/dist
    const clientDist = path.resolve(__dirname, '../../client/dist');
    const indexHtml = path.join(clientDist, 'index.html');

    if (existsSync(indexHtml)) {
      app.use(
        express.static(clientDist, {
          index: false,
          setHeaders(res, filePath) {
            res.setHeader('Content-Security-Policy', SITE_CSP);
            if (filePath.endsWith('index.html')) {
              res.setHeader('Cache-Control', 'no-cache');
            } else if (/[\\/]assets[\\/]/.test(filePath)) {
              // Vite hash'li asset'lar — abadiy keshlanadi.
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            } else {
              res.setHeader('Cache-Control', 'public, max-age=3600');
            }
          },
        }),
      );

      // SPA fallback: API/health/ws/uploads/SEO yo'llaridan tashqari hamma GET.
      app.get('*', (req, res, next) => {
        if (
          req.path.startsWith('/api') ||
          req.path.startsWith('/uploads') ||
          req.path === '/health' ||
          req.path === '/ws' ||
          req.path === '/sitemap.xml' ||
          req.path === '/robots.txt' ||
          // Fayl kengaytmasi bor yo'l topilmasa — HTML emas, 404 qaytaramiz
          // (aks holda brauzer JS/CSS o'rniga HTML olib MIME xatosi beradi).
          path.extname(req.path) !== ''
        ) {
          return next();
        }
        res.setHeader('Content-Security-Policy', SITE_CSP);
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(indexHtml);
      });
    } else {
      console.warn(`⚠️  Client dist topilmadi: ${clientDist} — SPA berilmaydi`);
    }
  }

  app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Topilmadi', data: null });
  });
  app.use(errorHandler);

  return app;
}
