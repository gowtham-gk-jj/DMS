import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testUsers() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const Folder = mongoose.model('Folder', new mongoose.Schema({}, { strict: false }));
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));
  const Permission = mongoose.model('Permission', new mongoose.Schema({}, { strict: false }));

  const admin = await User.findOne({ role: 'ADMIN' });
  const standardUser = await User.findOne({ role: 'USER', status: 'APPROVED' });

  console.log('Admin:', admin.email);
  console.log('Standard User:', standardUser.email);
  console.log('Standard User permissions:', standardUser.permissions);

  // Check if any permissions exist in the collection for this user
  const userPerms = await Permission.find({ userId: standardUser._id });
  console.log('Permission overrides for standard user:', userPerms.length);

  await mongoose.disconnect();
}

testUsers().catch(console.error);
