import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/ApiResponse';
import { Setting } from '../models/Setting.model';

/**
 * GET /api/settings — public holat.
 * Oshxona holati admin panelidan boshqariladi; yozuv hali yaratilmagan
 * bo'lsa, default "ochiq" qaytaramiz.
 */
export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await Setting.findOne({ key: 'main' });
  // Holat tez o'zgaradi — brauzer keshiga tushmasin.
  res.setHeader('Cache-Control', 'no-store');
  res.json(
    ok(
      {
        kitchenOpen: settings?.kitchenOpen ?? true,
        cardNumber: settings?.cardNumber ?? '',
        cardHolder: settings?.cardHolder ?? '',
        deliveryBaseFee: settings?.deliveryBaseFee ?? 12000,
        deliveryPerKm: settings?.deliveryPerKm ?? 1500,
        freeDeliveryFrom: settings?.freeDeliveryFrom ?? 150000,
        deliveryMaxKm: settings?.deliveryMaxKm ?? 15,
        prepTimeMin: settings?.prepTimeMin ?? 30,
      },
      'OK',
    ),
  );
});
