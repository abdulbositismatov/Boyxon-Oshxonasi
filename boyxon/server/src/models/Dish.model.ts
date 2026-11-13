import { Schema, model, type Document, type Types } from 'mongoose';

export interface DishDoc extends Document {
  name: string;
  nameRu?: string;
  nameEn?: string;
  slug: string;
  description: string;
  descriptionRu?: string;
  descriptionEn?: string;
  price: number;
  oldPrice?: number;
  category: Types.ObjectId;
  image: string | null;
  imagePublicId?: string;
  deliveryTime: number;
  calories?: number;
  tags: string[];
  rating: number;
  reviewCount: number;
  orderCount: number;
  isActive: boolean;
  isFeatured: boolean;
  stock?: number | null;
}

const DishSchema = new Schema<DishDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameRu: { type: String, trim: true },
    nameEn: { type: String, trim: true },
    slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    descriptionRu: { type: String, trim: true },
    descriptionEn: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    oldPrice: { type: Number, min: 0 },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    image: { type: String, default: null },
    imagePublicId: { type: String },
    /**
     * Ombor qoldig'i. `null` — cheklovsiz (default). Son bo'lsa, buyurtma
     * yaratishda atomar kamaytiriladi va bekor qilinsa qaytariladi.
     */
    stock: { type: Number, default: null, min: 0 },
    deliveryTime: { type: Number, default: 30, min: 1 },
    calories: { type: Number, min: 0 },
    tags: { type: [String], default: [] },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    orderCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true },
);

DishSchema.index({ name: 'text', nameRu: 'text', nameEn: 'text', description: 'text', descriptionRu: 'text', descriptionEn: 'text' });
DishSchema.index({ category: 1, isActive: 1 });
DishSchema.index({ isFeatured: 1, rating: -1 });

DishSchema.pre('save', function (next) {
  if (!this.slug && this.name) {
    this.slug =
      this.name
        .toLowerCase()
        .replace(/['"]/g, '')
        .replace(/[^a-z0-9\u0400-\u04FF]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) + '-' + Math.random().toString(36).slice(2, 7);
  }
  next();
});

DishSchema.virtual('hasImage').get(function (this: DishDoc) {
  return Boolean((this as unknown as { image?: string | null }).image);
});

export const Dish = model<DishDoc>('Dish', DishSchema);
