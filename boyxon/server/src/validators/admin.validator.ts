import { z } from 'zod';

export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'packing', 'handed_to_taxi', 'delivered', 'cancelled']),
  note: z.string().max(500).optional(),
  taxi: z
    .object({
      driver: z.string().max(100).optional(),
      carNumber: z.string().max(20).optional(),
      service: z.string().max(100).optional(),
      note: z.string().max(500).optional(),
    })
    .optional(),
});

/**
 * Mongo ObjectId param — CastError o'rniga toza 400 beradi.
 * Express `?id[$ne]=x` kabi obyektlarni ham rad etadi (zod string).
 */
export const objectIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Noto‘g‘ri ID formati'),
});

/** GET /api/admin/orders query — status enum, sana ISO, search string. */
export const adminOrdersQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['pending', 'confirmed', 'packing', 'handed_to_taxi', 'delivered', 'cancelled']).optional(),
  from: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  to: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  search: z.string().max(100).optional(),
});

/** GET /api/admin/users query — search faqat string ($regex injection yo'q). */
export const adminUsersQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
});

/** PATCH /api/admin/users/:id/role — rol faqat whitelist. */
export const changeRoleSchema = z.object({
  role: z.enum(['user', 'admin']),
});

/** PATCH /api/admin/users/:id/block — block faqat boolean. */
export const toggleBlockSchema = z.object({
  block: z.boolean(),
});

/** POST/PATCH /api/admin/categories — nom/slug bo'sh bo'lmasligi shart. */
export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2, 'Kategoriya nomi kamida 2 belgi').max(80),
  nameRu: z.string().trim().max(80).optional(),
  nameEn: z.string().trim().max(80).optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Slug faqat lotin harf, raqam va chiziqcha')
    .min(2)
    .max(60)
    .optional(),
  icon: z.string().trim().max(40).optional(),
  order: z.coerce.number().min(0).max(1000).default(0),
  isActive: z.boolean().optional(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

/** PATCH /api/admin/settings — oshxona holati va karta rekvizitlari. */
export const updateSettingsSchema = z
  .object({
    kitchenOpen: z.boolean().optional(),
    cardNumber: z
      .string()
      .trim()
      .max(32)
      .regex(/^[0-9 ]*$/, 'Karta raqami faqat raqam va bo‘sh joydan iborat bo‘lsin')
      .optional(),
    cardHolder: z.string().trim().max(80).optional(),
    // Yetkazib berish tarifi — admin panelidan boshqariladi.
    deliveryBaseFee: z.number().int().min(0).max(10_000_000).optional(),
    deliveryPerKm: z.number().int().min(0).max(1_000_000).optional(),
    freeDeliveryFrom: z.number().int().min(0).max(100_000_000).optional(),
    deliveryMaxKm: z.number().min(1).max(100).optional(),
    prepTimeMin: z.number().int().min(1).max(180).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Kamida bitta sozlama kiriting',
  });

/** POST /api/admin/push/send — audience whitelist, matn chegarasi. */
export const sendPushSchema = z.object({
  title: z.string().trim().min(1, 'Sarlavha kiriting').max(120),
  message: z.string().trim().min(1, 'Matn kiriting').max(500),
  audience: z
    .string()
    .regex(/^(all|active|new|user:[0-9a-fA-F]{24})$/, 'Audience: all | active | new | user:<id>'),
});