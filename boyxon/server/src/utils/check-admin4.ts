import { connectDb, disconnectDb } from '../config/db';
import { User } from '../models/User.model';
import { env } from '../config/env';
import bcrypt from 'bcryptjs';

async function main() {
  await connectDb();
  const email = env.ADMIN_EMAIL.toLowerCase();
  // reset attempts/lock from my failed test
  await User.updateOne({ email }, { $set: { failedLoginAttempts: 0, lockedUntil: null } });
  const u = await User.findOne({ email }).select('+password');
  if (!u || !u.password) { console.log('no user/pass'); process.exit(1); }
  console.log('method:', await (u as any).comparePassword(env.ADMIN_PASSWORD));
  console.log('bcrypt:', await bcrypt.compare(env.ADMIN_PASSWORD, u.password));
  console.log('wrong :', await bcrypt.compare('WRONGpass1!', u.password));
  await disconnectDb(); process.exit(0);
}
main().catch((e)=>{console.error(e);process.exit(1);});
