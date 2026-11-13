import type { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, paginated } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { User } from '../models/User.model';
import { RefreshSession } from '../models/RefreshSession.model';
import { Dish } from '../models/Dish.model';
import { Order } from '../models/Order.model';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../services/cloudinary.service';
import { Category } from '../models/Category.model';
import { Promo } from '../models/Promo.model';
import { PromoRedemption } from '../models/PromoRedemption.model';
import { Notification } from '../models/Notification.model';
import { Setting } from '../models/Setting.model';
import { sendPushToUsers } from '../services/push.service';
import { notifyUser, emitNotification } from '../services/notify.service';
import { getIo } from '../socket';
import { runInBackground } from '../utils/background';
import type { AuthRequest } from '../types/express';

/** GET /api/admin/orders — barcha buyurtmalar (status/date filtri). */
export const adminOrders = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.from || req.query.to) {
    const createdAt: Record<string, Date> = {};
    if (req.query.from) createdAt.$gte = new Date(req.query.from as string);
    if (req.query.to) createdAt.$lte = new Date(req.query.to as string);
    filter.createdAt = createdAt;
  }
  const [items, total] = await Promise.all([
    Order.find(filter).populate('user', 'name email phone').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  res.json(paginated(items, page, limit, total, 'OK'));
});

/** GET /api/admin/orders/:id — buyurtma tafsiloti. */
export const adminOrderDetail = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email phone');
  if (!order) throw ApiError.notFound('Buyurtma topilmadi');
  res.json(ok(order, 'OK'));
});

/** PATCH /api/admin/orders/:id/status — status + socket + notification + push. */
export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status, note, taxi } = req.body as {
    status: string;
    note?: string;
    taxi?: { driver?: string; carNumber?: string; service?: string; note?: string };
  };
  const ALLOWED = ['pending', 'confirmed', 'packing', 'handed_to_taxi', 'delivered', 'cancelled'];
  if (!ALLOWED.includes(status)) throw ApiError.badRequest('Noto‘g‘ri status');
  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound('Buyurtma topilmadi');
  const NEXT: Record<string, string[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['packing', 'cancelled'],
    packing: ['handed_to_taxi', 'cancelled'],
    handed_to_taxi: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: [],
  };
  if (status !== order.status && !(NEXT[order.status] ?? []).includes(status)) {
    throw ApiError.badRequest('Bu holatga o‘tish mumkin emas');
  }
  const wasCancelled = order.status === 'cancelled';
  const statusChanged = status !== order.status;
  order.status = status as typeof order.status;
  order.statusHistory.push({ status, timestamp: new Date(), note });
  if (taxi) order.taxi = { ...(order.taxi ?? {}), ...taxi };
  if (status === 'handed_to_taxi' && note && !order.taxi?.note) {
    order.taxi = { ...(order.taxi ?? {}), note };
  }
  if (status === 'delivered') order.deliveredAt = new Date();
  await order.save();
  // Admin ham bekor qilsa — promo kvotani qaytaramiz (mijoz huquqi tiklansin).
  // Faqat birinchi marta "cancelled" ga o'tganda (takroriy status o'zgarishda emas).
  if (statusChanged && status === 'cancelled' && !wasCancelled && order.promoCode) {
    await Promo.findOneAndUpdate(
      { code: order.promoCode, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } },
    );
  }
  // Bekor qilishda promo "claim" va ombor qoldig'i qaytariladi.
  if (statusChanged && status === 'cancelled' && !wasCancelled) {
    await PromoRedemption.deleteOne({ order: order._id }).catch(() => undefined);
    await Promise.all(
      order.items.map((item) =>
        Dish.updateOne(
          { _id: item.dish, stock: { $type: 'number' } },
          { $inc: { stock: item.quantity } },
        ),
      ),
    ).catch(() => undefined);
  }
  if (!statusChanged) {
    res.json(ok(order, 'Yangilandi'));
    return;
  }
  const labels: Record<string, string> = {
    pending: 'Kutilmoqda', confirmed: 'Tasdiqlandi', packing: 'Qadoqlanmoqda',
    handed_to_taxi: 'Taksiga topshirildi', delivered: 'Yetkazildi', cancelled: 'Bekor qilindi',
  };
  const msg = `Buyurtma ${order.orderNumber}: ${labels[status] ?? status}`;
  const userId = order.user.toString();
  await notifyUser({ user: userId, type: 'order', title: 'Buyurtma holati', message: msg, link: `/orders/${order.id}` });
  const u = await User.findById(userId);
  if (u?.notificationPrefs?.pushEnabled) {
    runInBackground(
      sendPushToUsers([userId], { title: 'Boyxon Oshxonasi', message: msg, url: `/orders/${order.id}` }).catch(
        () => 0,
      ),
    );
  }
  getIo()?.to(`user:${userId}`).emit('order:status', { orderId: order.id, status, message: msg });
  getIo()?.to('admin').emit('order:updated', { orderId: order.id, status });
  res.json(ok(order, msg));
});

/** GET /api/admin/categories — barcha kategoriyalar. */
export const adminCategories = asyncHandler(async (_req: Request, res: Response) => {
  res.json(ok(await Category.find().sort({ order: 1 }), 'OK'));
});

/** POST /api/admin/categories — yaratish. */
export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const item = await Category.create(req.body);
  res.status(201).json(ok(item, 'Kategoriya yaratildi'));
});

/** PATCH /api/admin/categories/:id — yangilash. */
export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const item = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!item) throw ApiError.notFound('Kategoriya topilmadi');
  res.json(ok(item, 'Kategoriya yangilandi'));
});

/** DELETE /api/admin/categories/:id — o'chirish (soft-delete: faol taomlar bo'lsa bloklanadi). */
export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw ApiError.notFound('Kategoriya topilmadi');
  // Ikki bosqichli check-then-delete o'rniga atomar yondashuv:
  // avval faol taomlarni sanaymiz, bo'sh bo'lsa soft-delete qilamiz.
  // Soft-delete (isActive=false) tanlandi — tarixiy buyurtmalar/taomlar
  // kategoriya nomini yo'qotmaydi, public ro'yxatdan esa yashiriladi.
  const used = await Dish.countDocuments({ category: category._id, isActive: true });
  if (used > 0) throw ApiError.badRequest(`Bu kategoriyada ${used} ta faol taom bor — avval ularni ko'chiring yoki o'chiring`);
  category.isActive = false;
  await category.save();
  res.json(ok(null, 'Kategoriya o‘chirildi'));
});

/** POST /api/admin/categories/:id/restore — o'chirilgan kategoriyani tiklash. */
export const restoreCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw ApiError.notFound('Kategoriya topilmadi');
  category.isActive = true;
  await category.save();
  res.json(ok(category, 'Kategoriya tiklandi'));
});

/**
 * Qidiruv uchun regex meta-belgilarini escape qilish.
 * Zod allaqachon string kafolatlaydi (obyekt injectsiya qilinmaydi), lekin
 * `.` `*` kabi belgilar noto'g'ri match yoki ReDoS xavfini oldini oladi.
 */
function escapeRegex(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** GET /api/admin/users — barcha userlar. */
export const adminUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const filter: Record<string, unknown> = {};
  if (req.query.search) {
    const term = escapeRegex(String(req.query.search));
    filter.$or = [{ name: { $regex: term, $options: 'i' } }, { email: { $regex: term, $options: 'i' } }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json(paginated(items, page, limit, total, 'OK'));
});

/** PATCH /api/admin/users/:id/role — rol o'zgartirish. */
export const changeRole = asyncHandler(async (req: Request, res: Response) => {
  const currentAdminId = (req as AuthRequest).user!.id;
  if (req.params.id === currentAdminId) {
    throw ApiError.badRequest('O‘z rolingizni o‘zgartira olmaysiz');
  }
  const targetRole = (req.body as { role: string }).role;
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('Foydalanuvchi topilmadi');
  if (user.role === 'admin' && targetRole !== 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
    if (adminCount <= 1) {
      throw ApiError.badRequest('Tizimda kamida bitta faol admin bo‘lishi shart');
    }
  }
  user.role = targetRole as 'user' | 'admin';
  await user.bumpTokenVersion();
  await user.save();
  res.json(ok(user, 'Rol yangilandi'));
});

/** PATCH /api/admin/users/:id/block — bloklash/ochish.
 *
 * Semantika: `block: true` = foydalanuvchini bloklash; `block: false` = blokdan chiqarish.
 * Bloklashda tokenVersion oshiriladi VA barcha refresh sessiyalari o'chiriladi —
 * bloklangan qurilmalar mavjud cookie bilan qayta kira olmaydi.
 */
export const toggleBlock = asyncHandler(async (req: Request, res: Response) => {
  const currentAdminId = (req as AuthRequest).user!.id;
  if (req.params.id === currentAdminId) {
    throw ApiError.badRequest('O‘zingizni bloklay olmaysiz');
  }
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('Foydalanuvchi topilmadi');
  const shouldBlock = (req.body as { block?: boolean }).block === true;
  user.isActive = !shouldBlock;
  if (shouldBlock) {
    await user.bumpTokenVersion();
  }
  await user.save();
  if (shouldBlock) {
    await RefreshSession.deleteMany({ user: user._id });
  }
  res.json(ok(user, user.isActive ? 'Blokdan chiqarildi' : 'Bloklandi'));
});

/** GET /api/admin/promos — barcha promolar. */
export const adminPromos = asyncHandler(async (_req: Request, res: Response) => {
  res.json(ok(await Promo.find().sort({ createdAt: -1 }), 'OK'));
});

/** POST /api/admin/promos — yaratish. */
export const createPromo = asyncHandler(async (req: Request, res: Response) => {
  const item = await Promo.create({ ...(req.body as object), code: (req.body as { code: string }).code.toUpperCase() });
  res.status(201).json(ok(item, 'Promo yaratildi'));
});

/** PATCH /api/admin/promos/:id — yangilash. */
export const updatePromo = asyncHandler(async (req: Request, res: Response) => {
  const body = { ...(req.body as Record<string, unknown>) };
  if (typeof body.code === 'string') body.code = body.code.toUpperCase();
  const item = await Promo.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (!item) throw ApiError.notFound('Promo topilmadi');
  res.json(ok(item, 'Promo yangilandi'));
});

/** DELETE /api/admin/promos/:id — o'chirish. */
export const deletePromo = asyncHandler(async (req: Request, res: Response) => {
  await Promo.findByIdAndDelete(req.params.id);
  res.json(ok(null, 'Promo o‘chirildi'));
});

/** POST /api/admin/push/send — auditoriyaga push + in-app (foydalanuvchi sozlamalariga hurmat). */
export const sendPush = asyncHandler(async (req: Request, res: Response) => {
  const { title, message, audience } = req.body as { title: string; message: string; audience: string };
  type Row = { _id: unknown; notificationPrefs?: { pushEnabled?: boolean } };
  let users: Row[] = [];
  if (audience === 'all') users = await User.find({ isActive: true }, '_id notificationPrefs');
  else if (audience === 'active') users = await User.find({ isActive: true, lastLoginAt: { $gte: new Date(Date.now() - 30 * 864e5) } }, '_id notificationPrefs');
  else if (audience === 'new') users = await User.find({ isActive: true, createdAt: { $gte: new Date(Date.now() - 7 * 864e5) } }, '_id notificationPrefs');
  else if (audience.startsWith('user:')) users = [{ _id: audience.slice(5) }];
  else throw ApiError.badRequest('Audience: all | active | new | user:<id>');

  // In-app: sayt bildirishnomasi yoqilganlar (pushEnabled). Push ham shu odamlarga.
  const inAppIds = users
    .filter((u) => u.notificationPrefs?.pushEnabled !== false)
    .map((u) => String(u._id));
  const docs = await Notification.insertMany(
    inAppIds.map((id) => ({ user: id, type: 'promo', title, message })),
  );
  for (const n of docs) emitNotification(n);

  const pushIds = inAppIds;
  const sent = await sendPushToUsers(pushIds, { title, message }).catch(() => 0);
  res.json(ok({ recipients: inAppIds.length, sent }, `${inAppIds.length} kishiga yuborildi`));
});

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch { /* plain */ }
    return raw.split(',').map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

/** GET /api/admin/stats — dashboard KPI lar. */
export const stats = asyncHandler(async (_req: Request, res: Response) => {
  const [users, dishes, pendingOrders, revenueAgg, recentOrders] = await Promise.all([
    User.countDocuments({ isActive: true }),
    Dish.countDocuments({ isActive: true }),
    Order.countDocuments({ status: { $in: ['pending', 'confirmed', 'packing', 'handed_to_taxi'] } }),
    Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
    ]),
    Order.find().populate('user', 'name').sort({ createdAt: -1 }).limit(10),
  ]);
  res.json(
    ok(
      { users, dishes, pendingOrders, revenue: revenueAgg[0]?.total ?? 0, ordersCount: revenueAgg[0]?.count ?? 0, recentOrders },
      'OK',
    ),
  );
});

/** PATCH /api/admin/settings — oshxona holati va karta rekvizitlarini yangilash. */
export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const {
    kitchenOpen,
    cardNumber,
    cardHolder,
    deliveryBaseFee,
    deliveryPerKm,
    freeDeliveryFrom,
    deliveryMaxKm,
    prepTimeMin,
  } = req.body as {
    kitchenOpen?: boolean;
    cardNumber?: string;
    cardHolder?: string;
    deliveryBaseFee?: number;
    deliveryPerKm?: number;
    freeDeliveryFrom?: number;
    deliveryMaxKm?: number;
    prepTimeMin?: number;
  };
  const update: Record<string, unknown> = {};
  if (kitchenOpen !== undefined) update.kitchenOpen = kitchenOpen;
  if (cardNumber !== undefined) update.cardNumber = cardNumber.replace(/\s+/g, ' ').trim();
  if (cardHolder !== undefined) update.cardHolder = cardHolder.trim();
  if (deliveryBaseFee !== undefined) update.deliveryBaseFee = deliveryBaseFee;
  if (deliveryPerKm !== undefined) update.deliveryPerKm = deliveryPerKm;
  if (freeDeliveryFrom !== undefined) update.freeDeliveryFrom = freeDeliveryFrom;
  if (deliveryMaxKm !== undefined) update.deliveryMaxKm = deliveryMaxKm;
  if (prepTimeMin !== undefined) update.prepTimeMin = prepTimeMin;

  const settings = await Setting.findOneAndUpdate(
    { key: 'main' },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  );
  res.json(
    ok(
      {
        kitchenOpen: settings.kitchenOpen,
        cardNumber: settings.cardNumber ?? '',
        cardHolder: settings.cardHolder ?? '',
        deliveryBaseFee: settings.deliveryBaseFee,
        deliveryPerKm: settings.deliveryPerKm,
        freeDeliveryFrom: settings.freeDeliveryFrom,
        deliveryMaxKm: settings.deliveryMaxKm,
        prepTimeMin: settings.prepTimeMin,
      },
      'Sozlamalar yangilandi',
    ),
  );
});

/** GET /api/admin/dishes — barcha taomlar (filtr + pagination). */
export const adminDishes = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const filter: Record<string, unknown> = {};
  if (req.query.search) {
    const s = String(req.query.search);
    filter.$or = [
      { name: { $regex: s, $options: 'i' } },
      { nameRu: { $regex: s, $options: 'i' } },
      { nameEn: { $regex: s, $options: 'i' } },
    ];
  }
  if (req.query.category) filter.category = req.query.category;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
  const [items, total] = await Promise.all([
    Dish.find(filter).populate('category', 'name slug').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Dish.countDocuments(filter),
  ]);
  res.json(paginated(items, page, limit, total, 'OK'));
});

/** POST /api/admin/dishes — taom yaratish (multipart, rasm ixtiyoriy). */
export const createDish = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as Record<string, string>;
  // Kategoriya mavjudligini erta tekshiramiz va ObjectId ga o'giramiz — CastError (500) o'rniga tushunarli 400 qaytadi.
  let categoryId = body.category;
  if (body.category) {
    const cat = isValidObjectId(body.category)
      ? await Category.findById(body.category).lean()
      : await Category.findOne({ $or: [{ slug: body.category }, { name: body.category }] }).lean();
    if (!cat) throw ApiError.badRequest('Kategoriya topilmadi. Iltimos, ro‘yxatdan tanlang.');
    categoryId = String(cat._id);
  }
  let image: string | null = null;
  let imagePublicId: string | undefined;
  let imageWarning = '';
  if (req.file) {
    try {
      const up = await uploadBufferToCloudinary(req.file.buffer);
      image = up.url;
      imagePublicId = up.publicId;
    } catch (e) {
      // Cloudinary sozlanmagan bo'lsa ham taom yaratilishiga to'sqinlik qilmaymiz —
      // rasmsiz saqlaymiz va ogohlantirishni javob xabariga qo'shamiz.
      if (e instanceof ApiError && e.statusCode === 400) {
        imageWarning = ' (Rasm yuklanmadi: Cloudinary sozlanmagan, taom rasmsiz saqlandi)';
      } else throw e;
    }
  }
  const dish = await Dish.create({
    name: body.name,
    nameRu: body.nameRu,
    nameEn: body.nameEn,
    description: body.description,
    descriptionRu: body.descriptionRu,
    descriptionEn: body.descriptionEn,
    price: Number(body.price),
    oldPrice: body.oldPrice ? Number(body.oldPrice) : undefined,
    category: categoryId,
    deliveryTime: body.deliveryTime ? Number(body.deliveryTime) : 30,
    calories: body.calories ? Number(body.calories) : undefined,
    tags: parseTags(body.tags),
    image,
    imagePublicId,
    isActive: body.isActive !== 'false',
    isFeatured: body.isFeatured === 'true',
  });
  res.status(201).json(ok(dish, `Taom yaratildi${imageWarning}`));
});

/** PATCH /api/admin/dishes/:id — taomni yangilash. */
export const updateDish = asyncHandler(async (req: Request, res: Response) => {
  const dish = await Dish.findById(req.params.id);
  if (!dish) throw ApiError.notFound('Taom topilmadi');
  const body = req.body as Record<string, string>;
  // Kategoriya o'zgartirilayotgan bo'lsa — mavjudligini tekshiramiz va ObjectId saqlaymiz.
  if (body.category !== undefined) {
    const cat = isValidObjectId(body.category)
      ? await Category.findById(body.category).lean()
      : await Category.findOne({ $or: [{ slug: body.category }, { name: body.category }] }).lean();
    if (!cat) throw ApiError.badRequest('Kategoriya topilmadi. Iltimos, ro‘yxatdan tanlang.');
    dish.category = cat._id as unknown as typeof dish.category;
  }
  if (req.file) {
    if (dish.imagePublicId) await deleteFromCloudinary(dish.imagePublicId);
    try {
      const up = await uploadBufferToCloudinary(req.file.buffer);
      dish.image = up.url;
      dish.imagePublicId = up.publicId;
    } catch (e) {
      if (!(e instanceof ApiError && e.statusCode === 400)) throw e;
      // Cloudinary yo'q bo'lsa — rasmni o'zgarishsiz qoldiramiz, lekin taomni yangilaymiz.
    }
  }
  const fields = ['name', 'nameRu', 'nameEn', 'description', 'descriptionRu', 'descriptionEn'];
  for (const f of fields) if (body[f] !== undefined) (dish as unknown as Record<string, unknown>)[f] = body[f];
  if (body.price !== undefined) dish.price = Number(body.price);
  if (body.oldPrice !== undefined) dish.oldPrice = body.oldPrice ? Number(body.oldPrice) : undefined;
  if (body.deliveryTime !== undefined) dish.deliveryTime = Number(body.deliveryTime);
  if (body.calories !== undefined) dish.calories = body.calories ? Number(body.calories) : undefined;
  if (body.tags !== undefined) dish.tags = parseTags(body.tags);
  if (body.isActive !== undefined) dish.isActive = body.isActive === 'true' || body.isActive === '1';
  if (body.isFeatured !== undefined) dish.isFeatured = body.isFeatured === 'true' || body.isFeatured === '1';
  await dish.save();
  res.json(ok(dish, 'Taom yangilandi'));
});

/** DELETE /api/admin/dishes/:id — soft delete. */
export const deleteDish = asyncHandler(async (req: Request, res: Response) => {
  const dish = await Dish.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!dish) throw ApiError.notFound('Taom topilmadi');
  res.json(ok(dish, 'Taom o‘chirildi'));
});

/** PATCH /api/admin/dishes/:id/toggle — aktiv/deaktiv. */
export const toggleDish = asyncHandler(async (req: Request, res: Response) => {
  const dish = await Dish.findById(req.params.id);
  if (!dish) throw ApiError.notFound('Taom topilmadi');
  dish.isActive = !dish.isActive;
  await dish.save();
  res.json(ok(dish, dish.isActive ? 'Faollashtirildi' : 'Deaktiv qilindi'));
});
