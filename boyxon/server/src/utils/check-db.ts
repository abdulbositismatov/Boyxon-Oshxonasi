import { connectDb, disconnectDb } from '../config/db';
import { env } from '../config/env';
import mongoose from 'mongoose';

async function main() {
  await connectDb();
  console.log(JSON.stringify({ db: mongoose.connection.name, host: mongoose.connection.host, uriHasAtlas: env.MONGODB_URI.includes('mongodb+srv'), envAdmin: env.ADMIN_EMAIL }));
  await disconnectDb(); process.exit(0);
}
main().catch(e=>{console.error(e);process.exit(1);});
