import { connectDb, disconnectDb } from '../config/db';
import { loginUser } from '../services/auth.service';
import { env } from '../config/env';

async function main() {
  await connectDb();
  try {
    const r = await loginUser(env.ADMIN_EMAIL, env.ADMIN_PASSWORD, 'diag');
    console.log('OK', { hasAccess: !!r.accessToken, hasRefresh: !!r.refreshToken });
  } catch (e: any) {
    console.log('FAIL', { status: e.statusCode, code: e.code, message: e.message });
  }
  await disconnectDb();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
