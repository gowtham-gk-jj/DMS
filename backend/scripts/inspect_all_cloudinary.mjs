import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function listAll() {
  console.log('Querying Cloudinary with cloud_name:', process.env.CLOUDINARY_CLOUD_NAME);
  
  let allRaw = [];
  let nextCursor = null;
  do {
    const res = await cloudinary.api.resources({
      resource_type: 'raw',
      max_results: 500,
      next_cursor: nextCursor,
      prefix: 'dms'
    });
    allRaw = allRaw.concat(res.resources || []);
    nextCursor = res.next_cursor;
  } while (nextCursor);

  console.log(`Total raw resources with prefix 'dms':`, allRaw.length);

  // Group raw resources by folder
  const folders = {};
  for (const r of allRaw) {
    const parts = r.public_id.split('/');
    const folder = parts.slice(0, -1).join('/');
    folders[folder] = (folders[folder] || 0) + 1;
  }
  console.log('Raw resources by folder:', folders);

  // Also check without prefix 'dms' just in case
  let allRawTotal = [];
  nextCursor = null;
  do {
    const res = await cloudinary.api.resources({
      resource_type: 'raw',
      max_results: 500,
      next_cursor: nextCursor
    });
    allRawTotal = allRawTotal.concat(res.resources || []);
    nextCursor = res.next_cursor;
  } while (nextCursor);
  console.log('Total raw resources across entire Cloudinary account:', allRawTotal.length);

  // Check image resources
  let allImages = [];
  nextCursor = null;
  do {
    const res = await cloudinary.api.resources({
      resource_type: 'image',
      max_results: 500,
      next_cursor: nextCursor
    });
    allImages = allImages.concat(res.resources || []);
    nextCursor = res.next_cursor;
  } while (nextCursor);
  console.log('Total image resources across entire Cloudinary account:', allImages.length);

  // Check sample raw public_ids
  console.log('Sample raw resources (first 10):');
  allRawTotal.slice(0, 10).forEach(r => {
    console.log(`- ${r.public_id} (${r.bytes} bytes, format=${r.format})`);
  });
}

listAll().catch(err => {
  console.error('Cloudinary listing error:', err);
});
