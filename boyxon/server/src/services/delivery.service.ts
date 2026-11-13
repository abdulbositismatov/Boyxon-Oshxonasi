import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

/**
 * Yetkazib berish narxi va ETA hisobi.
 *
 * Ajratilgan modul — sof funksiyalar, unit test qilish oson
 * (`src/utils/pricing.test.ts`).
 */

/** Admin panelidagi qiymatlar bo'sh bo'lsa ishlatiladigan defaultlar. */
export const DEFAULT_DELIVERY = {
  baseFee: 12000,
  perKm: 1500,
  freeFrom: 150000,
  maxKm: 15,
  prepTimeMin: 30,
} as const;

/** Shahar ichidagi o'rtacha yetkazish tezligi (km/soat). */
export const AVG_DELIVERY_SPEED_KMH = 22;

export type Coords = { lat: number; lng: number };

/** Ikki nuqta orasidagi masofa (km) — Haversine formulasi. */
export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function calcDiscount(
  type: 'percent' | 'fixed',
  value: number,
  subtotal: number,
  max?: number | null,
): number {
  const raw = type === 'percent' ? Math.floor((subtotal * value) / 100) : value;
  const capped = max && max > 0 ? Math.min(raw, max) : raw;
  return Math.max(0, Math.min(capped, subtotal));
}

export type DeliveryPolicy = {
  deliveryBaseFee?: number | null;
  deliveryPerKm?: number | null;
  freeDeliveryFrom?: number | null;
  deliveryMaxKm?: number | null;
  prepTimeMin?: number | null;
};

export type DeliveryQuote = { fee: number; distanceKm: number; etaMinutes: number };

/**
 * - Pickup — bepul, faqat tayyorlash vaqti.
 * - Koordinatalar bo'lsa — masofa bo'yicha (km × tarif), radiusdan oshsa xato.
 * - Koordinatalar bo'lmasa — bazaviy tarif.
 */
export function quoteDelivery(opts: {
  deliveryType: 'delivery' | 'pickup';
  subtotal: number;
  address?: { lat?: number; lng?: number };
  policy?: DeliveryPolicy | null;
  /** Test uchun override. */
  restaurant?: Coords;
}): DeliveryQuote {
  const p = {
    baseFee: opts.policy?.deliveryBaseFee ?? DEFAULT_DELIVERY.baseFee,
    perKm: opts.policy?.deliveryPerKm ?? DEFAULT_DELIVERY.perKm,
    freeFrom: opts.policy?.freeDeliveryFrom ?? DEFAULT_DELIVERY.freeFrom,
    maxKm: opts.policy?.deliveryMaxKm ?? DEFAULT_DELIVERY.maxKm,
    prepTimeMin: opts.policy?.prepTimeMin ?? DEFAULT_DELIVERY.prepTimeMin,
  };

  if (opts.deliveryType === 'pickup') {
    return { fee: 0, distanceKm: 0, etaMinutes: p.prepTimeMin };
  }

  const hasCoords =
    typeof opts.address?.lat === 'number' && typeof opts.address?.lng === 'number';
  const restaurant = opts.restaurant ?? { lat: env.RESTAURANT_LAT, lng: env.RESTAURANT_LNG };
  const distanceKm = hasCoords
    ? haversineKm(restaurant, { lat: opts.address!.lat!, lng: opts.address!.lng! })
    : 0;

  if (hasCoords && distanceKm > p.maxKm) {
    throw ApiError.badRequest(
      `Yetkazish radiusi ${p.maxKm} km dan oshib ketdi (masofa: ${distanceKm.toFixed(1)} km)`,
    );
  }

  // 500 so'mgacha yaxlitlash — mijoz uchun o'qilishi oson.
  const fee =
    opts.subtotal >= p.freeFrom
      ? 0
      : Math.round((p.baseFee + p.perKm * Math.ceil(distanceKm)) / 500) * 500;

  const etaMinutes = p.prepTimeMin + Math.round((distanceKm / AVG_DELIVERY_SPEED_KMH) * 60);
  return { fee, distanceKm: Math.round(distanceKm * 10) / 10, etaMinutes };
}
