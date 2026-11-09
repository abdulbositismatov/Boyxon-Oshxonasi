/**
 * Cloudflare Workers entrypoint.
 *
 * Arxitektura:
 *   - Barcha HTTP so'rovlar `ApiServer` Durable Object'ga yuboriladi. DO ichida
 *     Express ishlaydi va MongoDB ulanishi DO xotirasida saqlanadi (Workers
 *     oddiy isolate'da TCP socket'ni so'rovlar orasida qayta ishlata olmaydi).
 *   - `/ws` WebSocket upgrade `RealtimeHub` DO'ga yo'naltiriladi.
 *   - bcrypt `PasswordHasher` DO ichida bajariladi (10 ms CPU limitidan qochish).
 *
 * Modul darajasida hech qanday src/ import qilinmaydi: avval binding'lar
 * `process.env` ga ko'chiriladi, keyin hammasi dinamik yuklanadi.
 */
import { env as cfEnv } from 'cloudflare:workers';

export { ApiServer, PasswordHasher, RealtimeHub } from './durable-objects';

for (const [key, value] of Object.entries(cfEnv)) {
  if (typeof value === 'string') process.env[key] = value;
}

type ApiStub = {
  fetch(request: Request): Promise<Response>;
  verifyUser(token: string): Promise<{ id: string; role: 'user' | 'admin' } | null>;
};

type HubStub = {
  fetch(request: Request): Promise<Response>;
};

type ImagesKV = {
  getWithMetadata(
    key: string,
    type: 'arrayBuffer',
  ): Promise<{ value: ArrayBuffer | null; metadata: Record<string, string> | null }>;
};

type AssetsFetcher = {
  fetch(request: Request): Promise<Response>;
};

/** MongoDB klasteriga yaqinroq joylashuv (Atlas odatda Yevropada). */
const LOCATION_HINT = 'weur' as DurableObjectLocationHint;

type VersionMetadata = { id: string };

/**
 * Joriy deploy versiyasi. Wrangler `version_metadata` binding'i orqali keladi.
 * Lokal dev'da bo'lmasligi mumkin — `dev` ishlatiladi.
 */
const VERSION_ID =
  (cfEnv as unknown as { CF_VERSION_METADATA?: VersionMetadata }).CF_VERSION_METADATA?.id ?? 'dev';

function namespace(name: string): DurableObjectNamespace {
  return (cfEnv as unknown as Record<string, DurableObjectNamespace>)[name];
}

function apiStub(): ApiStub {
  const ns = namespace('API_SERVER');
  // Har deploy — yangi DO nomi. Eski DO tabiiy ravishda bo'shab ketadi.
  // RealtimeHub nomi o'zgarmaydi (aks holda ochiq WebSocket'lar uziladi).
  return ns.get(ns.idFromName(`api:${VERSION_ID}`), { locationHint: LOCATION_HINT }) as unknown as ApiStub;
}

function hubStub(): HubStub {
  const ns = namespace('REALTIME_HUB');
  return ns.get(ns.idFromName('global'), { locationHint: LOCATION_HINT }) as unknown as HubStub;
}

function errorResponse(request: Request, status: number, message: string): Response {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' });
  const origin = request.headers.get('Origin');
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Vary', 'Origin');
  }
  return new Response(JSON.stringify({ success: false, message, data: null }), { status, headers });
}

async function handleWebSocket(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return errorResponse(request, 401, 'Token kerak');

  const user = await apiStub().verifyUser(token);
  if (!user) return errorResponse(request, 401, 'Token yaroqsiz yoki sessiya bekor qilingan');

  const headers = new Headers(request.headers);
  headers.set('x-user-id', user.id);
  headers.set('x-user-role', user.role);

  return hubStub().fetch(new Request(request, { headers }));
}

/**
 * KV'dagi rasmni berish (`/uploads/boyxon/dishes/...`).
 * Rasm o'zgarmas (immutable) — bir yilga keshlanadi.
 */
async function serveImage(url: URL): Promise<Response> {
  const key = decodeURIComponent(url.pathname.replace(/^\/uploads\//, ''));
  if (!key || key.includes('..')) return new Response('Not found', { status: 404 });

  const images = (cfEnv as unknown as { IMAGES?: ImagesKV }).IMAGES;
  if (!images) return new Response('Not found', { status: 404 });

  const { value, metadata } = await images.getWithMetadata(key, 'arrayBuffer');
  if (!value) return new Response('Not found', { status: 404 });

  return new Response(value, {
    headers: {
      'content-type': metadata?.contentType || 'image/jpeg',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

/**
 * Statik fayllar (SPA HTML, JS/CSS, ikonkalar).
 *
 * HTML'ni hech qachon keshlab qoldirmaymiz: aks holda yangi deploydan keyin
 * brauzer eski `index.html` ni olib, undagi eski chunk nomlarini so'raydi va
 * ular o'rniga yana HTML qaytadi (MIME xatosi + oq ekran). Hashed `/assets/*`
 * esa bir yilga immutable — tez va xavfsiz.
 */
async function serveAsset(request: Request, url: URL): Promise<Response> {
  const assets = (cfEnv as unknown as { ASSETS?: AssetsFetcher }).ASSETS;
  if (!assets) return new Response('Not found', { status: 404 });

  const res = await assets.fetch(request);
  const contentType = res.headers.get('content-type') || '';
  const isHtml = contentType.includes('text/html');

  // SPA fallback mavjud bo'lmagan /assets/* uchun index.html qaytaradi.
  // Modul skript text/html MIME bilan yuklanmaydi — aniq JS 404 qaytaramiz.
  if (url.pathname.startsWith('/assets/') && isHtml) {
    return new Response('/* Boyxon: bu fayl eski deployga tegishli */', {
      status: 404,
      headers: {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }

  const headers = new Headers(res.headers);
  if (isHtml) {
    // `no-store` — brauzer ham, Cloudflare edge ham HTML'ni saqlamaydi.
    // `no-cache` bilan edge nusxasi qolib ketib, eski chunk nomlari berilardi.
    headers.set('cache-control', 'no-store, max-age=0');
    headers.set('cdn-cache-control', 'no-store');
    headers.set('pragma', 'no-cache');
    headers.set('expires', '0');
    headers.delete('etag');
    headers.delete('last-modified');
  } else if (url.pathname.startsWith('/assets/')) {
    headers.set('cache-control', 'public, max-age=31536000, immutable');
  }

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request): Promise<Response> {    try {
      const url = new URL(request.url);
      if (url.pathname === '/ws') return await handleWebSocket(request);
      if (url.pathname.startsWith('/uploads/')) return await serveImage(url);

      // Dinamik API faqat shu yo'llarda; qolgani — statik fayl yoki SPA.
      if (
        url.pathname.startsWith('/api/') ||
        url.pathname === '/api' ||
        url.pathname === '/health' ||
        url.pathname === '/sitemap.xml'
      ) {
        return await apiStub().fetch(request);
      }

      return await serveAsset(request, url);
    } catch (err) {
      console.error('Worker xatosi:', err);
      return errorResponse(request, 500, 'Server xatosi');
    }
  },

  /**
   * Cron (har 2 daqiqa): Durable Object'ni va MongoDB ulanishini iliq tutadi.
   *
   * Cloudflare'da "uxlash" tushunchasi yo'q, lekin Durable Object uzoq vaqt
   * so'rov olmasa xotiradan chiqariladi. Keyingi so'rovda u qaytadan ishga
   * tushadi: dinamik import + Atlas'ga ulanish — foydalanuvchi buni 1–3 soniya
   * kutish (yoki "server uyg'onmoqda" xabari) sifatida ko'radi.
   */
  async scheduled(_controller: ScheduledController, _env: unknown, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      apiStub()
        .fetch(new Request('https://boyxon.internal/health'))
        .then((res) => res.text())
        .then(() => undefined)
        .catch(() => undefined),
    );
  },
};
