import { connectDb, disconnectDb } from '../config/db';
import { User } from '../models/User.model';
import { env } from '../config/env';

async function main(): Promise<void> {
  await connectDb();
  const u = await User.findOne({ email: env.ADMIN_EMAIL.toLowerCase() }).lean();
  console.log(JSON.stringify({
    found: !!u,
    email: (u as any)?.email,
    role: (u as any)?.role,
    isActive: (u as any)?.isActive,
    emailVerified: (u as any)?.emailVerified,
  }, null, 2));
  await disconnectDb();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
