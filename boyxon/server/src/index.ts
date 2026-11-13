import http from 'http';
import mongoose from 'mongoose';
import { createApp } from './app';
import { connectDb } from './config/db';
import { env } from './config/env';
import { attachRealtimeServer } from './realtime-node';
import { logger } from './utils/logger';
import { sendAlert } from './utils/alert';
import { ensureAdminAccount } from './utils/ensure-admin';

async function main(): Promise<void> {
  await connectDb();

  // Admin panelga kirish env'dagi ADMIN_EMAIL/ADMIN_PASSWORD orqali kafolatlanadi.
  // Xato bo'lsa serverni to'xtatmaymiz — faqat logga yozamiz.
  await ensureAdminAccount().catch((err) => {
    logger.error({ err: (err as Error)?.message }, 'Admin hisobini sinxronlashda xato');
  });
  const app = createApp();
  const server = http.createServer(app);

  // Socket.IO o'rniga native WebSocket (`/ws`) — Workers'dagi protokol bilan bir xil.
  attachRealtimeServer(server);

  server.listen(env.PORT, () => {
    logger.info(`✅ Boyxon API: http://localhost:${env.PORT}`);
  });

  /**
   * Graceful shutdown: Render deploy qilganda SIGTERM yuboradi.
   * Ochilgan ulanishlar (WebSocket, DB) yopiladi — so'rovlar yarim yo'lda
   * uzilib qolmaydi va deploy "toza" hisoblanadi.
   */
  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Server to‘xtatilmoqda...');

    const force = setTimeout(() => {
      logger.error('Majburiy chiqish (10s kutildi)');
      process.exit(1);
    }, 10_000);
    force.unref();

    server.close((err) => {
      void mongoose.connection
        .close(false)
        .catch(() => undefined)
        .then(() => process.exit(err ? 1 : 0));
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    sendAlert('unhandledRejection', { reason: String(reason) });
  });
  process.on('uncaughtException', (err) => {
    sendAlert('uncaughtException', { err: err.message, stack: err.stack });
  });
}

main().catch((e) => {
  console.error('❌ Server ishga tushmadi:', e);
  sendAlert('Server ishga tushmadi', { err: (e as Error)?.message });
  process.exit(1);
});
