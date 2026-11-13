import { cloudinary, cloudinaryConfigured } from '../config/cloudinary';
import { env, isProd } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { isWorkersRuntime } from '../utils/runtime';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Rasm saqlash.
 *
 * Ustuvorlik:
 *   1. Media worker + Cloudflare R2 (`MEDIA_WORKER_URL` + `MEDIA_WORKER_SECRET`)
 *      — O'zbekistonda ishlaydi, bepul limiti katta (10GB, egress bepul).
 *   2. Cloudinary (agar sozlangan bo'lsa).
 *   3. Lokal `uploads/dishes` — FAQAT dev. Production'da bu yo'l yopiq:
 *      Render diski ephemeral, rasm restartda o'chib ketadi.
 */

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'dishes');

/**
 * Muqobil saqlash adapteri (Cloudflare Workers'da KV yoki boshqa storage).
 * Worker `installRuntimeBindings()` paytida o'rnatadi.
 */
export interface ImageStorageAdapter {
  upload(buffer: Buffer, folder: string): Promise<{ url: string; publicId: string }>;
  delete(publicId: string): Promise<void>;
}

let storageAdapter: ImageStorageAdapter | null = null;

export function setImageStorageAdapter(adapter: ImageStorageAdapter | null): void {
  storageAdapter = adapter;
}

// Workers'da fayl tizimi yo'q — papka yaratish faqat Node'da.
if (!isWorkersRuntime && !fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/** Media worker sozlanganmi? */
function mediaWorkerConfigured(): boolean {
  return Boolean(env.MEDIA_WORKER_URL && env.MEDIA_WORKER_SECRET);
}

/** Buffer ichidan haqiqiy rasm turini aniqlaydi (kengaytma/mimetype'ga ishonmaymiz). */
function detectImage(buffer: Buffer): { ext: string; mime: string } {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buffer.length >= 6 && buffer.subarray(0, 3).toString('ascii') === 'GIF') {
    return { ext: 'gif', mime: 'image/gif' };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  if (buffer.length >= 12 && buffer.subarray(4, 12).toString('ascii').includes('ftypavif')) {
    return { ext: 'avif', mime: 'image/avif' };
  }
  throw ApiError.badRequest('Rasm formati aniqlanmadi (JPEG, PNG, WebP, GIF yoki AVIF yuboring)');
}

function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

function publicBaseUrl(): string {
  const base = env.MEDIA_PUBLIC_URL || env.MEDIA_WORKER_URL;
  return base.replace(/\/+$/, '');
}

async function uploadToMediaWorker(
  buffer: Buffer,
  folder: string,
): Promise<{ url: string; publicId: string }> {
  const { ext, mime } = detectImage(buffer);
  const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '') || 'dishes';
  const key = `${safeFolder}/${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;

  const res = await fetch(`${publicBaseUrl()}/${encodeKey(key)}`, {
    method: 'PUT',
    headers: {
      'x-media-key': env.MEDIA_WORKER_SECRET,
      'content-type': mime,
      'cache-control': 'public, max-age=31536000, immutable',
    },
    body: buffer,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw ApiError.badRequest(
      `Rasmni saqlashda xato (${res.status}): ${text.slice(0, 200) || 'media worker javob bermadi'}`,
    );
  }

  return { url: `${publicBaseUrl()}/${encodeKey(key)}`, publicId: key };
}

async function deleteFromMediaWorker(publicId: string): Promise<void> {
  await fetch(`${publicBaseUrl()}/${encodeKey(publicId)}`, {
    method: 'DELETE',
    headers: { 'x-media-key': env.MEDIA_WORKER_SECRET },
  }).catch(() => undefined);
}

/**
 * Rasmni yuklash.
 * Cloudinary'dan farqli o'laroq, bu yerda `data:image/jpeg` deb qat'iy belgilanmaydi —
 * haqiqiy format buffer'dan aniqlanadi (PNG/WebP avval buzib yuborilardi).
 */
export async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder = 'boyxon/dishes',
): Promise<{ url: string; publicId: string }> {
  if (storageAdapter) {
    return storageAdapter.upload(buffer, folder);
  }

  if (mediaWorkerConfigured()) {
    return uploadToMediaWorker(buffer, folder);
  }

  if (cloudinaryConfigured) {
    try {
      const { mime } = detectImage(buffer);
      const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;
      const res = await cloudinary.uploader.upload(dataUri, { folder });
      return { url: res.secure_url as string, publicId: res.public_id as string };
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw ApiError.badRequest(
        `Rasmni yuklashda xato: ${(e as Error)?.message ?? 'Cloudinary ga ulanib bo‘lmadi'}`,
      );
    }
  }

  if (isWorkersRuntime || isProd) {
    throw ApiError.badRequest(
      'Rasm saqlash sozlanmagan. MEDIA_WORKER_URL + MEDIA_WORKER_SECRET (yoki CLOUDINARY_*) ni qo‘shing.',
    );
  }

  // Fallback: lokal saqlash (faqat dev)
  const { ext } = detectImage(buffer);
  const fileName = `${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, fileName), buffer);

  const baseUrl = env.CLIENT_URL.split(',')[0] ?? 'http://localhost:5000';
  return { url: `${baseUrl.replace(/\/api$/, '')}/uploads/dishes/${fileName}`, publicId: fileName };
}

/** Rasmni o'chirish — media worker, Cloudinary yoki lokal papkadan. */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  if (storageAdapter) {
    await storageAdapter.delete(publicId).catch(() => undefined);
    return;
  }

  if (mediaWorkerConfigured()) {
    await deleteFromMediaWorker(publicId);
    return;
  }

  if (cloudinaryConfigured) {
    await cloudinary.uploader.destroy(publicId).catch(() => undefined);
  }

  if (isWorkersRuntime) return;

  // Lokal faylni ham o'chirish
  try {
    const filePath = path.join(UPLOAD_DIR, publicId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Fayl o'chirishda xato bo'lsa — asosiy jarayon to'xtamaydi
  }
}
