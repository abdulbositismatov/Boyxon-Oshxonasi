import { describe, it, expect } from 'vitest';
import {
  haversineKm,
  quoteDelivery,
  calcDiscount,
  DEFAULT_DELIVERY,
} from '../src/services/delivery.service';

const TASHKENT = { lat: 41.311081, lng: 69.240562 };

describe('haversineKm', () => {
  it('bir xil nuqta uchun 0', () => {
    expect(haversineKm(TASHKENT, TASHKENT)).toBeCloseTo(0, 5);
  });

  it('Toshkent markazidan ~5 km uzoqlikni to‘g‘ri baholaydi', () => {
    // Chilonzor tomonga ~0.05° kenglik.
    const target = { lat: TASHKENT.lat - 0.045, lng: TASHKENT.lng };
    const km = haversineKm(TASHKENT, target);
    expect(km).toBeGreaterThan(4.5);
    expect(km).toBeLessThan(5.5);
  });
});

describe('quoteDelivery', () => {
  it('pickup — bepul va faqat tayyorlash vaqti', () => {
    const q = quoteDelivery({ deliveryType: 'pickup', subtotal: 50_000, restaurant: TASHKENT });
    expect(q.fee).toBe(0);
    expect(q.distanceKm).toBe(0);
    expect(q.etaMinutes).toBe(DEFAULT_DELIVERY.prepTimeMin);
  });

  it('koordinatasiz — bazaviy tarif', () => {
    const q = quoteDelivery({
      deliveryType: 'delivery',
      subtotal: 10_000,
      restaurant: TASHKENT,
    });
    expect(q.fee).toBe(DEFAULT_DELIVERY.baseFee);
  });

  it('katta summada yetkazish bepul', () => {
    const q = quoteDelivery({
      deliveryType: 'delivery',
      subtotal: DEFAULT_DELIVERY.freeFrom,
      address: { lat: TASHKENT.lat - 0.02, lng: TASHKENT.lng },
      restaurant: TASHKENT,
    });
    expect(q.fee).toBe(0);
  });

  it('masofa oshgani sari narx oshadi', () => {
    const near = quoteDelivery({
      deliveryType: 'delivery',
      subtotal: 10_000,
      address: { lat: TASHKENT.lat - 0.01, lng: TASHKENT.lng },
      restaurant: TASHKENT,
    });
    const far = quoteDelivery({
      deliveryType: 'delivery',
      subtotal: 10_000,
      address: { lat: TASHKENT.lat - 0.05, lng: TASHKENT.lng },
      restaurant: TASHKENT,
    });
    expect(far.fee).toBeGreaterThan(near.fee);
    expect(far.etaMinutes).toBeGreaterThan(near.etaMinutes);
  });

  it('radiusdan tashqarida xato beradi', () => {
    expect(() =>
      quoteDelivery({
        deliveryType: 'delivery',
        subtotal: 10_000,
        address: { lat: TASHKENT.lat - 0.5, lng: TASHKENT.lng }, // ~55 km
        restaurant: TASHKENT,
        policy: { deliveryMaxKm: 15 },
      }),
    ).toThrow(/radiusi/i);
  });

  it('narx 500 so‘mga yaxlitlanadi', () => {
    const q = quoteDelivery({
      deliveryType: 'delivery',
      subtotal: 10_000,
      address: { lat: TASHKENT.lat - 0.013, lng: TASHKENT.lng },
      restaurant: TASHKENT,
    });
    expect(q.fee % 500).toBe(0);
  });
});

describe('calcDiscount', () => {
  it('foiz chegirmasi', () => {
    expect(calcDiscount('percent', 10, 100_000)).toBe(10_000);
  });

  it('maksimal chegirma bilan cheklanadi', () => {
    expect(calcDiscount('percent', 50, 100_000, 20_000)).toBe(20_000);
  });

  it('qat’iy chegirma summadan oshmaydi', () => {
    expect(calcDiscount('fixed', 50_000, 30_000)).toBe(30_000);
  });

  it('manfiy chegirma bo‘lmaydi', () => {
    expect(calcDiscount('fixed', -1000, 30_000)).toBe(0);
  });
});
