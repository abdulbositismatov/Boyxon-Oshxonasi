import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import { sendAlert } from '../utils/alert';

/** Markaziy xato ushlagich — oxirgi middleware. */
 // eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.code ? { code: err.code } : {}),
      data: null,
    });
    return;
  }
  // Multer xatolari (fayl hajmi, formati, kutilmagan maydon)
  if (err && typeof err === 'object' && 'name' in err) {
    const name = (err as { name: string }).name;

    /**
     * Buzuq JSON / juda katta tana — body-parser xatolari.
     *
     * Ilgari bular 500 bo'lib chiqardi va logga to'liq stack yozilardi. Bu noto'g'ri:
     * bu mijoz xatosi (400), va stack logini to'ldirib, haqiqiy xatolarni ko'rinmas
     * holga keltiradi. Endi aniq 400 qaytaramiz.
     */
    if (name === 'SyntaxError' && (err as { type?: string }).type === 'entity.parse.failed') {
      res.status(400).json({ success: false, message: 'So‘rov tanasi buzuq JSON', data: null });
      return;
    }
    if (name === 'PayloadTooLargeError' || (err as { type?: string }).type === 'entity.too.large') {
      res.status(413).json({ success: false, message: 'So‘rov tanasi juda katta', data: null });
      return;
    }

    if (name === 'MulterError') {
      const code = (err as { code?: string }).code;
      const msg =
        code === 'LIMIT_FILE_SIZE'
          ? 'Rasm hajmi 5MB dan oshmasligi kerak'
          : code === 'LIMIT_FILE_COUNT'
            ? 'Faqat bitta rasm yuklash mumkin'
            : code === 'LIMIT_UNEXPECTED_FILE'
              ? 'Kutilmagan fayl maydoni (maydon nomi: image bo‘lishi kerak)'
              : (err as Error).message || 'Fayl yuklashda xato';
      res.status(400).json({ success: false, message: msg, data: null });
      return;
    }
    // Multer fileFilter dagi oddiy Error ("Faqat rasm...")
    if (name === 'Error' && /rasm/i.test((err as Error).message)) {
      res.status(400).json({ success: false, message: (err as Error).message, data: null });
      return;
    }
    // Mongoose noto'g'ri ObjectId (masalan category)
    if (name === 'CastError') {
      const path = (err as { path?: string }).path ?? 'maydon';
      res.status(400).json({ success: false, message: `Noto‘g‘ri qiymat: ${path}`, data: null });
      return;
    }
  }
  if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
    res.status(409).json({ success: false, message: 'Bu qiymat allaqachon mavjud', data: null });
    return;
  }
  if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'ValidationError') {
    res.status(400).json({ success: false, message: (err as Error).message, data: null });
    return;
  }
  if (env.NODE_ENV !== 'production') console.error('❌ Server xatosi:', err);
  sendAlert('Kutilmagan server xatosi', {
    err: (err as Error)?.message,
    path: _req.method ? `${_req.method} ${_req.originalUrl}` : undefined,
  });
  res.status(500).json({ success: false, message: 'Serverda kutilmagan xato', data: null });
}
