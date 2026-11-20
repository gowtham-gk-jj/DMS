import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import fs from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const files = [
  '1794799688759_APPL_HB_APPL_HB.pdf',
  '1794799718561_BH_BH.pdf',
  '1794799719972_BNM_BNM.pdf',
  '1794799744492_FB1_FB1.pdf',
  '1794799756818_FB3_FB3.pdf',
  '1794825532599_PJTM_PJTM.pdf'
];

async function check() {
  console.log('--- Checking 6 Local Files ---');
  for (const fn of files) {
    const p1 = path.resolve('backend/uploads', fn);
    const p2 = path.resolve('uploads', fn);
    const localPath = fs.existsSync(p1) ? p1 : (fs.existsSync(p2) ? p2 : null);
    if (!localPath) {
      console.log(`File NOT FOUND locally: ${fn}`);
    } else {
      const stat = fs.statSync(localPath);
      console.log(`Found: ${fn} (${stat.size} bytes / ${(stat.size / (1024*1024)).toFixed(2)} MB)`);
    }
  }

  // Check Cloudinary account limits / usage
  const usage = await cloudinary.api.usage();
  console.log('\nCloudinary Usage:', {
    plan: usage.plan,
    storage: usage.storage,
    bandwidth: usage.bandwidth,
    raw_convert_limit: usage.raw_convert_limit,
  });
}

check().catch(console.error);
