import { connectDb, disconnectDb } from '../config/db';
import { User } from '../models/User.model';
import { env } from '../config/env';
import { comparePassword } from '../services/password.service';

async function main(): Promise<void> {
  await connectDb();
  const email = env.ADMIN_EMAIL.toLowerCase();
  const u = await User.findOne({ email }).select('+password tokenVersion failedLoginAttempts lockedUntil');
  if (!u) {
    console.log('NOT FOUND:', email);
  } else {
    const passMatch = u.password ? await comparePassword(env.ADMIN_PASSWORD, u.password) : false;
    console.log(JSON.stringify({
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      emailVerified: u.emailVerified,
      tokenVersion: u.tokenVersion,
      failedLoginAttempts: u.failedLoginAttempts,
      lockedUntil: u.lockedUntil,
      hasPassword: !!u.password,
      passMatch,
      envAdminEmail: env.ADMIN_EMAIL,
    }, null, 2));
  }
  await disconnectDb();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
