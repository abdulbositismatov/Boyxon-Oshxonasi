import { Schema, model, type Document } from 'mongoose';

export interface SettingDoc extends Document {
  key: string;
  kitchenOpen: boolean;
  /** Karta o'tkazmasi uchun rekvizitlar (bo'sh bo'lsa — karta usuli ko'rsatilmaydi). */
  cardNumber?: string;
  cardHolder?: string;
  // ---- Yetkazib berish tarifi (admin panelidan boshqariladi) ----
  /** Boshlang'ich narx (so'm). */
  deliveryBaseFee: number;
  /** Har bir km uchun qo'shimcha (so'm). */
  deliveryPerKm: number;
  /** Shu summadan yuqori buyurtmaga yetkazish bepul. */
  freeDeliveryFrom: number;
  /** Maksimal yetkazish radiusi (km). */
  deliveryMaxKm: number;
  /** Oshxona tayyorlash vaqti (daqiqa) — ETA hisobida. */
  prepTimeMin: number;
}

const SettingSchema = new Schema<SettingDoc>(
  {
    key: { type: String, required: true, unique: true, default: 'main' },
    kitchenOpen: { type: Boolean, default: true },
    cardNumber: { type: String, default: '', trim: true, maxlength: 32 },
    cardHolder: { type: String, default: '', trim: true, maxlength: 80 },
    deliveryBaseFee: { type: Number, default: 12000, min: 0 },
    deliveryPerKm: { type: Number, default: 1500, min: 0 },
    freeDeliveryFrom: { type: Number, default: 150000, min: 0 },
    deliveryMaxKm: { type: Number, default: 15, min: 1, max: 100 },
    prepTimeMin: { type: Number, default: 30, min: 1, max: 180 },
  },
  { timestamps: true },
);

export const Setting = model<SettingDoc>('Setting', SettingSchema);
