import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError';

type Schemas = { body?: z.ZodSchema; query?: z.ZodSchema; params?: z.ZodSchema };

/** Zod maydon nomlarini foydalanuvchiga ko'rinadigan nomlarga aylantirish. */
const FIELD_LABELS: Record<string, string> = {
  password: 'Parol',
  newPassword: 'Yangi parol',
  oldPassword: 'Eski parol',
  email: 'Email',
  name: 'Ism',
  phone: 'Telefon',
  code: 'Kod',
};

function label(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** Zod validatsiya middleware — xato bo'lsa 400 qaytaradi. */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query) as typeof req.query;
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      next();
    } catch (e) {
      if (e instanceof z.ZodError) {
        /**
         * Xato matnini toza va o'zbekcha qilamiz:
         * - bizning sxemalarda xabar allaqachon maydon nomini o'z ichiga oladi
         *   ("Parol kamida 8 belgi...") — takror yozmaymiz;
         * - Zod'ning standart inglizcha xabarlari uchun maydon nomini qo'shamiz;
         * - "password" kabi texnik nomlar o'rniga "Parol" ishlatiladi.
         */
        const seen = new Set<string>();
        const parts: string[] = [];
        for (const issue of e.issues) {
          const field = issue.path.join('.');
          const msg = issue.message;
          if (seen.has(msg)) continue; // bir xil xabarni takrorlamaymiz
          seen.add(msg);
          const alreadyNamed = field && msg.toLowerCase().includes(field.toLowerCase());
          parts.push(!field || alreadyNamed ? msg : `${label(field)}: ${msg}`);
        }
        const text = parts.join('. ');
        throw ApiError.badRequest(text.charAt(0).toUpperCase() + text.slice(1));
      }
      throw e;
    }
  };
}
