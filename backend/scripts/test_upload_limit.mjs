import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { v2 as cloudinary } from 'cloudinary';
import path from 'path';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const testFilePath = path.resolve('backend/temp_migration/github_downloads/MIG-1794799277928-0AB6A3/extracted/DOConCD_SINUMERIK_SIMODRIVE/English/pdf/PJTM.pdf');

async function testUpload() {
  console.log('Testing upload of 10.8MB file...');
  try {
    const res = await cloudinary.uploader.upload(testFilePath, {
      resource_type: 'raw',
      folder: 'dms/test_uploads',
    });
    console.log('Upload SUCCESS raw:', res.secure_url, res.bytes, res.public_id);
    await cloudinary.uploader.destroy(res.public_id, { resource_type: 'raw' });
    console.log('Cleaned up test asset.');
  } catch (err) {
    console.log('Upload FAILED raw:', err.message, err.http_code);
  }

  // Also test with image
  try {
    const resImg = await cloudinary.uploader.upload(testFilePath, {
      resource_type: 'image',
      folder: 'dms/test_uploads',
    });
    console.log('Upload SUCCESS image:', resImg.secure_url, resImg.bytes, resImg.public_id);
    await cloudinary.uploader.destroy(resImg.public_id, { resource_type: 'image' });
    console.log('Cleaned up test image asset.');
  } catch (err) {
    console.log('Upload FAILED image:', err.message, err.http_code);
  }
}

testUpload().catch(console.error);
