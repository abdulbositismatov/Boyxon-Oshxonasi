import { env } from '../config/env';
import { logger } from './logger';

/**
 * Kritik xatolar haqida ogohlantirish.
 *
 * Bepul yechim: Slack/Discord/Telegram webhook. Pullik monitoring (Sentry)
 * o'rniga — `ALERT_WEBHOOK_URL` bo'sh bo'lsa shunchaki logga yoziladi.
 * Bir daqiqada bir martadan ko'p yuborilmaydi (spam himoyasi).
 */

let lastSentAt = 0;

export function sendAlert(message: string, meta?: Record<string, unknown>): void {
  logger.error(meta ?? {}, message);

  if (!env.ALERT_WEBHOOK_URL) return;

  const now = Date.now();
  if (now - lastSentAt < 60_000) return;
  lastSentAt = now;

  // Discord `content`, Slack `text` ishlatadi — ikkalasini ham yuboramiz.
  const text = `🚨 Boyxon Oshxonasi: ${message}`;
  void fetch(env.ALERT_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: text, text }),
  }).catch((err) => {
    logger.warn({ err }, 'Alert webhook ga yuborilmadi');
  });
}
