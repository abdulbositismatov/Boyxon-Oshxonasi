import { Schema, model, type Document, type Types } from 'mongoose';

export type OrderStatus = 'pending' | 'confirmed' | 'packing' | 'handed_to_taxi' | 'delivered' | 'cancelled';

export interface OrderItem {
  dish: Types.ObjectId;
  name: string;
  nameRu?: string;
  nameEn?: string;
  price: number;
  quantity: number;
  customizations?: string;
}

export interface OrderDoc extends Document {
  orderNumber: string;
  user: Types.ObjectId;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  promoCode?: string;
  deliveryType: 'delivery' | 'pickup';
  address?: { label?: string; address?: string; lat?: number; lng?: number };
  paymentMethod: 'payme' | 'click' | 'uzum' | 'cash' | 'card';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  status: OrderStatus;
  statusHistory: { status: string; timestamp: Date; note?: string }[];
  courier?: { name?: string; phone?: string };
  /** Taksi orqali yuborilganda — haydovchi/mashina/taksi xizmati izohi. */
  taxi?: { driver?: string; carNumber?: string; service?: string; note?: string };
  estimatedDeliveryAt?: Date;
  deliveredAt?: Date;
  /** Hisoblangan masofa (km) — yetkazish narxi va ETA uchun. */
  deliveryDistanceKm?: number;
  cancelReason?: string;
  notes?: string;
}

const OrderItemSchema = new Schema<OrderItem>(
  {
    dish: { type: Schema.Types.ObjectId, ref: 'Dish', required: true },
    name: { type: String, required: true },
    nameRu: { type: String },
    nameEn: { type: String },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    customizations: { type: String },
  },
  { _id: false },
);

const OrderSchema = new Schema<OrderDoc>(
  {
    orderNumber: { type: String, unique: true, sparse: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [OrderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    promoCode: { type: String, uppercase: true, trim: true },
    deliveryType: { type: String, enum: ['delivery', 'pickup'], required: true },
    address: {
      label: String,
      address: String,
      lat: Number,
      lng: Number,
    },
    paymentMethod: { type: String, enum: ['payme', 'click', 'uzum', 'cash', 'card'], required: true },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'packing', 'handed_to_taxi', 'delivered', 'cancelled'],
      default: 'pending',
      index: true,
    },
    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String,
      },
    ],
    courier: { name: String, phone: String },
    taxi: { driver: String, carNumber: String, service: String, note: String },
    estimatedDeliveryAt: { type: Date },
    deliveredAt: { type: Date },
    deliveryDistanceKm: { type: Number, min: 0 },
    cancelReason: { type: String },
    notes: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

// ---------------------------------------------------------------------------
// So'rov indekslari. Ilgari Order'da birorta ham indeks yo'q edi — admin
// panelidagi ro'yxat, "mening buyurtmalarim" va promo hisoblash hammasi
// collection scan qilardi (buyurtmalar ko'payganda sezilarli sekinlashadi).
// ---------------------------------------------------------------------------
OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ promoCode: 1, user: 1, status: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ paymentStatus: 1, createdAt: -1 });

OrderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    // Format: BYX-YYYYMMDD-XXXX (kunlik, o'qilishi oson, kolliziya ehtimoli past).
    // Bir kunda 10k+ buyurtma bo'lsa ham random 4 xonali + retry himoya qiladi.
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    for (let i = 0; i < 10; i++) {
      const candidate = `BYX-${day}-${Math.floor(1000 + Math.random() * 9000)}`;
      const exists = await (this.constructor as typeof Order).findOne({ orderNumber: candidate });
      if (!exists) {
        this.orderNumber = candidate;
        break;
      }
    }
    // Juda kam holatda (bir kunda bir xil raqam 10 marta tushsa) — millis + random.
    if (!this.orderNumber) {
      this.orderNumber = `BYX-${day}-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 10)}`;
    }
  }
  if (this.isNew && this.statusHistory.length === 0) {
    this.statusHistory.push({ status: 'pending', timestamp: new Date() });
  }
  next();
});

export const Order = model<OrderDoc>('Order', OrderSchema);
