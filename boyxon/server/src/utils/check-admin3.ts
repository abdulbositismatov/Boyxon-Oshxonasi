import { connectDb, disconnectDb } from '../config/db';
import { User } from '../models/User.model';
import { env } from '../config/env';
import bcrypt from 'bcryptjs';

async function main() {
  await connectDb();
  const u = await User.findOne({ email: env.ADMIN_EMAIL.toLowerCase() }).select('+password failedLoginAttempts lockedUntil tokenVersion').lean() as any;
  console.log(JSON.stringify({
    email: u?.email, role: u?.role, isActive: u?.isActive, emailVerified: u?.emailVerified,
    tokenVersion: u?.tokenVersion, failedLoginAttempts: u?.failedLoginAttempts, lockedUntil: u?.lockedUntil,
    hashPrefix: u?.password?.slice(0, 7), hashLen: u?.password?.length,
    directCompare: u?.password ? await bcrypt.compare(env.ADMIN_PASSWORD, u.password) : null,
  }, null, 2));
  await disconnectDb(); process.exit(0);
}
main().catch((e)=>{console.error(e);process.exit(1);});
