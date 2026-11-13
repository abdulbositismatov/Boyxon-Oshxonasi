/**
 * Boyxon media worker — Cloudflare KV (yoki R2) ustida rasm saqlash.
 *
 * Nega alohida worker?
 *  - Render diski ephemeral: deploy/restart'da rasmlar o'chadi.
 *  - Cloudinary O'zbekistonda beqaror ishlaydi.
 *  - Cloudflare KV bepul: 1GB saqlash, 100k o'qish/kun, 1k yozish/kun.
 *    (R2 ham qo'llab-quvvatlanadi — binding nomi bir xil: MEDIA.)
 *
 * API:
 *   PUT    /<key>   — rasm yuklash (X-Media-Key sarlavhasi bilan)
 *   GET    /<key>   — rasmni olish (public, uzoq kesh)
 *   DELETE /<key>   — rasmni o'chirish (X-Media-Key bilan)
 */

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function normalizeKey(rawPath) {
  let key = rawPath.replace(/^\/+/, '');
  try {
    key = decodeURIComponent(key);
  } catch {
    return null;
  }
  if (!key || key.includes('..') || key.length > 400) return null;
  return key;
}

/** R2 bucket'da multipart API bor; KV'da yo'q. */
function isR2(store) {
  return typeof store.createMultipartUpload === 'function';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = normalizeKey(url.pathname);
    if (!key) return json(400, { success: false, message: 'Noto‘g‘ri kalit' });

    // CORS — brauzerdan to'g'ridan-to'g'ri o'qish uchun.
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, HEAD, PUT, DELETE, OPTIONS',
          'access-control-allow-headers': 'content-type, x-media-key',
          'access-control-max-age': '86400',
        },
      });
    }

    const store = env.MEDIA;

    if (request.method === 'GET' || request.method === 'HEAD') {
      if (isR2(store)) {
        const object = await store.get(key);
        if (!object) return json(404, { success: false, message: 'Topilmadi' });

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag ?? '');
        headers.set('cache-control', 'public, max-age=31536000, immutable');
        headers.set('access-control-allow-origin', '*');
        headers.set('x-content-type-options', 'nosniff');
        if (!headers.has('content-type')) headers.set('content-type', 'application/octet-stream');
        return new Response(request.method === 'HEAD' ? null : object.body, { headers });
      }

      // KV yo'li
      const { value, metadata } = await store.getWithMetadata(key, 'arrayBuffer');
      if (!value) return json(404, { success: false, message: 'Topilmadi' });

      const headers = new Headers();
      headers.set('content-type', metadata?.contentType ?? 'application/octet-stream');
      headers.set('cache-control', 'public, max-age=31536000, immutable');
      headers.set('access-control-allow-origin', '*');
      headers.set('x-content-type-options', 'nosniff');
      return new Response(request.method === 'HEAD' ? null : value, { headers });
    }

    // Yozish/o'chirish — faqat maxfiy kalit bilan.
    const provided = request.headers.get('x-media-key');
    if (!provided || provided !== env.MEDIA_SECRET) {
      return json(401, { success: false, message: 'Ruxsat yo‘q' });
    }

    if (request.method === 'PUT') {
      const contentType = (request.headers.get('content-type') ?? '').split(';')[0].trim();
      if (!ALLOWED.has(contentType)) {
        return json(415, { success: false, message: 'Faqat rasm yuklash mumkin' });
      }
      const body = await request.arrayBuffer();
      if (body.byteLength === 0) return json(400, { success: false, message: 'Bo‘sh fayl' });
      if (body.byteLength > MAX_BYTES) return json(413, { success: false, message: 'Fayl juda katta' });

      if (isR2(store)) {
        await store.put(key, body, {
          httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
        });
      } else {
        await store.put(key, body, { metadata: { contentType } });
      }
      return json(201, { success: true, key });
    }

    if (request.method === 'DELETE') {
      await store.delete(key);
      return new Response(null, { status: 204 });
    }

    return json(405, { success: false, message: 'Metod qo‘llanmaydi' });
  },
};
