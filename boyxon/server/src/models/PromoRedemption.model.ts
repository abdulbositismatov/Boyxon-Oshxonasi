import { Schema, model, type Document, type Types } from 'mongoose';

/**
 * Promo kod ishlatilishi — `perUserLimit` ni ATOMAR qilish uchun.
 *
 * Muammo: avval `Order.countDocuments({ user, promoCode })` tekshirilardi,
 * keyin buyurtma yaratilardi. Ikki parallel so'rov bir vaqtda count=0 ni
 * ko'rib, ikkalasi ham o'tib ketishi mumkin edi (race condition).
 *
 * Yechim: har bir ishlatish uchun yozuv yaratamiz. `(promo, user, seq)`
 * unique indeks bo'lgani uchun ikki so'rov bir xil `seq` ni olishga urinsa,
 * MongoDB ikkinchisini `E11000` bilan rad etadi — ya'ni limit buzilmaydi.
 */
export interface PromoRedemptionDoc extends Document {
  promo: Types.ObjectId;
  user: Types.ObjectId;
  order?: Types.ObjectId;
  /** Foydalanuvchi uchun nechanchi ishlatish (0-based). */
  seq: number;
}

const PromoRedemptionSchema = new Schema<PromoRedemptionDoc>(
  {
    promo: { type: Schema.Types.ObjectId, ref: 'Promo', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    seq: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

PromoRedemptionSchema.index({ promo: 1, user: 1, seq: 1 }, { unique: true });
PromoRedemptionSchema.index({ user: 1, promo: 1 });
PromoRedemptionSchema.index({ order: 1 });

export const PromoRedemption = model<PromoRedemptionDoc>(
  'PromoRedemption',
  PromoRedemptionSchema,
);
