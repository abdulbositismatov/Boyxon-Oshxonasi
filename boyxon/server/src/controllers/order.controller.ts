import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { Order } from '../models/Order.model';
import { Dish } from '../models/Dish.model';
import { Promo, type PromoDoc } from '../models/Promo.model';
import { Setting } from '../models/Setting.model';
import { User } from '../models/User.model';
import { sendOrderEmail } from '../services/email.service';
import { notifyUser } from '../services/notify.service';
import { getIo } from '../socket';
import { Review, recalcDishRating } from '../models/Review.model';
import { PromoRedemption } from '../models/PromoRedemption.model';
import { quoteDelivery, calcDiscount } from '../services/delivery.service';
import type { AuthRequest } from '../types/express';

/** GET /api/orders/:id — faqat o'z buyurtmasi (yoki admin). */
export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const auth = (req as AuthRequest).user!;
  const order = await Order.findById(req.params.id)
    .populate('user', 'name email phone')
    .populate('items.dish', 'image slug');
  if (!order) throw ApiError.notFound('Buyurtma topilmadi');
  // user populate qilingan bo'lishi ham mumkin (obyekt) yoki ObjectId (string) —
  // ikkala holatda ham tekshiramiz.
  const ownerId =
    typeof order.user === 'object' && order.user !== null && '_id' in (order.user as object)
      ? String((order.user as unknown as { _id: unknown })._id)
      : String(order.user);
  if (auth.role !== 'admin' && ownerId !== auth.id) throw ApiError.forbidden();
  res.json(ok(order, 'OK'));
});

/** PATCH /api/orders/:id/cancel — mijoz o'zi bekor qiladi (pending/confirmed). */
export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.id;
  const reason = (req.body as { reason?: string }).reason;
  // ATOMAR o'tish: faqat pending/confirmed holatidan cancelled ga o'tish bitta
  // operatsiyada — ikki marta bosilsa ham promo bir marta qaytarilmaydi.
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, user: userId, status: { $in: ['pending', 'confirmed'] } },
    {
      $set: { status: 'cancelled', cancelReason: reason },
      $push: { statusHistory: { status: 'cancelled', timestamp: new Date(), note: reason } },
    },
    { new: true },
  );
  if (!order) {
    const exists = await Order.exists({ _id: req.params.id, user: userId });
    if (!exists) throw ApiError.notFound('Buyurtma topilmadi');
    throw ApiError.badRequest('Bu bosqichda bekor qilib bo‘lmaydi');
  }
  // Bekor qilindi — promo kvotani qaytaramiz (mijoz huquqi yo'qolmaydi).
  // usedCount manfiy bo'lmasligi uchun $max: 0 bilan cheklaymiz.
  if (order.promoCode) {
    await Promo.findOneAndUpdate(
      { code: order.promoCode, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } },
    );
    // $inc avvaldan $gt: 0 tekshirganligi uchun usedCount allaqachon 0 bo'lsa
    // yanada tushmaydi, lekin xavfsizlik uchun qo'shimcha $max qo'shamiz:
    await Promo.findOneAndUpdate(
      { code: order.promoCode, usedCount: { $lt: 0 } },
      { $set: { usedCount: 0 } },
    );
  }

  // Promo "claim" ni bo'shatamiz — mijoz keyingi buyurtmada qayta ishlata oladi.
  await PromoRedemption.deleteOne({ order: order._id }).catch(() => undefined);

  // Ombor qoldig'ini qaytaramiz — faqat cheklangan (number) qoldiqqa ega taomlar uchun.
  // `stock: null` (cheklovsiz) taomga $inc qo'llanmaydi, aks holda "null" o'rniga son paydo bo'lardi.
  await Promise.all(
    order.items.map((item) => {
      const dishId =
        typeof item.dish === 'object' && item.dish !== null
          ? (item.dish as unknown as { _id: unknown })._id
          : item.dish;
      return Dish.updateOne(
        { _id: dishId, stock: { $type: 'number' } },
        { $inc: { stock: item.quantity } },
      );
    }),
  ).catch(() => undefined);

  getIo()?.to('admin').emit('order:updated', { orderId: order.id, status: 'cancelled' });
  res.json(ok(order, 'Buyurtma bekor qilindi'));
});

/** POST /api/orders/:id/review — yetkazilgan buyurtmaga baho (auth). */
export const reviewOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.id;
  const order = await Order.findOne({ _id: req.params.id, user: userId });
  if (!order) throw ApiError.notFound('Buyurtma topilmadi');
  if (order.status !== 'delivered') throw ApiError.badRequest('Faqat yetkazilganda baho beriladi');
  const { reviews } = req.body as { reviews: { dish: string; rating: number; comment?: string }[] };

  // Faqat shu buyurtmadagi taomlarga baho berilishi kerak — aks holda istalgan
  // dish ga yolg'on baho yozish mumkin edi.
  const orderDishIds = new Set(order.items.map((i) => i.dish.toString()));
  const invalid = reviews.filter((r) => !orderDishIds.has(r.dish));
  if (invalid.length) throw ApiError.badRequest('Bu taom buyurtmada yo‘q');

  // Duplicate himoya: shu buyurtma + shu taomga allaqachon baho yozilganmi.
  // (order, dish, user) unique index ham bor — poyga holatida DB rad etadi.
  const existing = await Review.find({ order: order._id, user: userId }).select('dish');
  const doneDishes = new Set(existing.map((r) => r.dish.toString()));
  const dupes = reviews.filter((r) => doneDishes.has(r.dish));
  if (dupes.length) throw ApiError.badRequest('Bu taomga allaqachon baho bergansiz');

  let created;
  try {
    created = await Review.insertMany(
      reviews.map((r) => ({ user: userId, dish: r.dish, order: order._id, rating: r.rating, comment: r.comment })),
    );
  } catch (e: unknown) {
    // Poyga holatida ikkinchi so'rov unique index'ga uriladi.
    if (e && typeof e === 'object' && 'code' in e && (e as { code: number }).code === 11000) {
      throw ApiError.badRequest('Bu taomga allaqachon baho bergansiz');
    }
    throw e;
  }

  // insertMany post('save') hook'ini ishga tushirmaydi — reytingni qo'lda yangilaymiz.
  const dishIds = [...new Set(reviews.map((r) => r.dish))];
  await Promise.all(dishIds.map((id) => recalcDishRating(id)));

  res.status(201).json(ok(created, 'Rahmat! Bahoyingiz saqlandi'));
});


type CreateBody = {
  items: { dish: string; quantity: number; customizations?: string }[];
  deliveryType: 'delivery' | 'pickup';
  address?: { label?: string; address?: string; lat?: number; lng?: number };
  paymentMethod: 'payme' | 'click' | 'uzum' | 'cash' | 'card';
  promoCode?: string;
  notes?: string;
};

/**
 * POST /api/orders — buyurtma yaratish (auth).
 * Promo tekshiriladi, jami hisoblanadi, email + notification + socket yuboriladi.
 */
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.id;
  const { items, deliveryType, address, paymentMethod, promoCode, notes } = req.body as CreateBody;

  // Oshxona yopiq bo'lsa yangi buyurtma yaratilmaydi. Bu tekshiruv serverda —
  // client UI'ni chetlab o'tish yoki eskirgan holat bilan buyurtma berish mumkin emas.
  const settings = await Setting.findOne({ key: 'main' }).lean();
  if (settings?.kitchenOpen === false) throw ApiError.kitchenClosed();

  const dishIds = items.map((i) => i.dish);
  const dishes = await Dish.find({ _id: { $in: dishIds }, isActive: true });
  if (dishes.length !== items.length) throw ApiError.badRequest('Ba’zi taomlar topilmadi');

  // Ombor oldindan tekshiriladi (tez xato), aniq kamaytirish esa atomar —
  // pastda, buyurtma yozilishidan oldin.
  for (const i of items) {
    const d = dishes.find((x) => x.id === i.dish);
    if (!d) throw ApiError.badRequest('Taom topilmadi');
    if (typeof d.stock === 'number' && d.stock < i.quantity) {
      throw ApiError.badRequest(`"${d.name}" tugagan yoki yetarli emas`);
    }
  }

  const orderItems = items.map((i) => {
    const d = dishes.find((x) => x.id === i.dish);
    if (!d) throw ApiError.badRequest('Taom topilmadi');
    return { dish: d._id, name: d.name, nameRu: d.nameRu, nameEn: d.nameEn, price: d.price, quantity: i.quantity, customizations: i.customizations };
  });
  const subtotal = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);

  // Yetkazish narxi va ETA — masofa bo'yicha (settings + restoran koordinatalari).
  // Ilgari 12 000 so'm va 45 daqiqa qat'iy yozilgan edi.
  const delivery = quoteDelivery({ deliveryType, subtotal, address, policy: settings });
  const deliveryFee = delivery.fee;

  let discount = 0;
  let promoDoc: PromoDoc | null = null;
  let redemptionSeq: number | null = null;
  if (promoCode) {
    const code = promoCode.toUpperCase().trim();
    promoDoc = await Promo.findOne({ code });
    if (!promoDoc || !promoDoc.isActive) throw ApiError.badRequest('Promo kod noto‘g‘ri');
    const now = new Date();
    if (promoDoc.validFrom && promoDoc.validFrom > now) throw ApiError.badRequest('Promo hali boshlanmagan');
    if (promoDoc.validUntil && promoDoc.validUntil < now) throw ApiError.badRequest('Promo muddati o‘tgan');
    if (subtotal < promoDoc.minOrderAmount) throw ApiError.badRequest('Minimal summa yetmadi');
    // ATOMAR perUserLimit: har bir ishlatish uchun PromoRedemption yozuvi
    // yaratiladi. `(promo, user, seq)` unique bo'lgani uchun ikki parallel
    // so'rov bir xil seq'ni olishga urinsa — ikkinchisi E11000 bilan rad etiladi.
    const myCount = await PromoRedemption.countDocuments({ promo: promoDoc._id, user: userId });
    if (myCount >= promoDoc.perUserLimit) throw ApiError.badRequest('Bu promodan foydalangansiz');
    try {
      await PromoRedemption.create({ promo: promoDoc._id, user: userId, seq: myCount });
      redemptionSeq = myCount;
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw ApiError.badRequest('Bu promodan foydalangansiz');
      }
      throw err;
    }
    // ATOMAR limit: usedCount++ va limit tekshiruvi BITTA operatsiyada.
    // Ikki mijoz bir vaqtda olsa ham usageLimit oshib ketmaydi —
    // Mongo faqat usedCount < usageLimit bo'lsa yangilaydi.
    if (promoDoc.usageLimit != null) {
      const claimed = await Promo.findOneAndUpdate(
        { _id: promoDoc._id, $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }] },
        { $inc: { usedCount: 1 } },
        { new: true },
      );
      if (!claimed) throw ApiError.badRequest('Promo limiti tugagan');
      promoDoc = claimed;
    } else {
      await Promo.findByIdAndUpdate(promoDoc._id, { $inc: { usedCount: 1 } });
    }
    // perUserLimit ham atomar bo'lishi kerak — Order yaratilganda faqat bitta
    // so'rov Muvaffaqiyatli bo'lishi uchun unique index (user, promoCode) kerak.
    // Mongoose schema'da bu index mavjud emas, shuning uchunController oldindan
    // countDocuments tekshiradi (yuqorida) — race ehtimoli kam, lekin 100% himoya
    // uchun DB index qo'shish tavsiya etiladi (Promo.model.ts ga qўshilishi kerak).
    discount = calcDiscount(promoDoc.type, promoDoc.value, subtotal, promoDoc.maxDiscount);
  }

  const total = subtotal + deliveryFee - discount;

  // Ombor: har bir taom atomar kamaytiriladi. `stock: { $gte: qty }` sharti
  // Mongo tomonida tekshiriladi — ikki parallel buyurtma bir dona qoldiqni
  // ikki marta sotib olmaydi. Xato bo'lsa hammasi qaytariladi.
  const stockClaims: { id: string; quantity: number }[] = [];
  const releaseStock = async (): Promise<void> => {
    await Promise.all(
      stockClaims.map((c) => Dish.updateOne({ _id: c.id }, { $inc: { stock: c.quantity } })),
    );
  };

  let order;
  try {
    for (const i of items) {
      const d = dishes.find((x) => x.id === i.dish)!;
      if (typeof d.stock !== 'number') continue;
      const claimed = await Dish.findOneAndUpdate(
        { _id: d._id, stock: { $gte: i.quantity } },
        { $inc: { stock: -i.quantity } },
        { new: true },
      );
      if (!claimed) throw ApiError.badRequest(`"${d.name}" tugagan`);
      stockClaims.push({ id: d.id, quantity: i.quantity });
    }

    order = await Order.create({
      user: userId,
      items: orderItems,
      subtotal,
      deliveryFee,
      discount,
      total,
      promoCode: promoDoc?.code,
      deliveryType,
      address: deliveryType === 'delivery' ? address : undefined,
      paymentMethod,
      notes,
      deliveryDistanceKm: delivery.distanceKm,
      estimatedDeliveryAt: new Date(Date.now() + delivery.etaMinutes * 60 * 1000),
    });

    // Promo "claim" ni buyurtmaga bog'laymiz — bekor qilinganda shu orqali topiladi.
    if (promoDoc && redemptionSeq !== null) {
      await PromoRedemption.updateOne(
        { promo: promoDoc._id, user: userId, seq: redemptionSeq },
        { order: order._id },
      );
    }
  } catch (err) {
    await releaseStock().catch(() => undefined);
    if (promoDoc) {
      await Promo.findOneAndUpdate(
        { _id: promoDoc._id, usedCount: { $gt: 0 } },
        { $inc: { usedCount: -1 } },
      );
      if (redemptionSeq !== null) {
        await PromoRedemption.deleteOne({ promo: promoDoc._id, user: userId, seq: redemptionSeq });
      }
    }
    throw err;
  }

  await Dish.updateMany({ _id: { $in: dishIds } }, { $inc: { orderCount: 1 } });
  const user = await User.findById(userId);
  if (user) {
    await notifyUser({
      user: userId,
      type: 'order',
      title: 'Buyurtma qabul qilindi',
      message: `${order.orderNumber} qabul qilindi!`,
      link: `/orders/${order.id}`,
    });
    sendOrderEmail(user.email, order.orderNumber, total).catch(() => undefined);
  }
  getIo()?.to('admin').emit('order:created', { orderId: order.id, orderNumber: order.orderNumber, total });
  res.status(201).json(ok(order, 'Buyurtmangiz qabul qilindi!'));
});
