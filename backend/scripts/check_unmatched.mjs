import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkUnmatched() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));
  const catalogueData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/catalogue_matched.json'), 'utf8'));

  const allDocs = await Document.find({ isArchived: false }).lean();
  console.log('Total documents in DB:', allDocs.length);

  const unmatched = [];
  for (const item of catalogueData) {
    const cleanFn = (item.fileName || '').replace(/\.pdf$/i, '').toLowerCase();
    const cleanOrder = (item.orderNo || '').trim().toLowerCase();
    const cleanTitle = (item.title || '').trim().toLowerCase();

    const found = allDocs.find(d => {
      const dFn = (d.originalFileName || d.fileName || '').replace(/\.pdf$/i, '').toLowerCase();
      const dOrder = (d.orderNumber || '').trim().toLowerCase();
      const dTitle = (d.title || '').trim().toLowerCase();

      return (
        (cleanFn && dFn === cleanFn) ||
        (cleanOrder && dOrder === cleanOrder) ||
        (cleanTitle && dTitle === cleanTitle)
      );
    });

    if (!found) {
      unmatched.push(item);
    } else {
      // console.log(`Matched: ${item.title}`);
    }
  }

  console.log(`Unmatched items count: ${unmatched.length}`);
  unmatched.forEach(u => {
    console.log('Unmatched:', {
      fileName: u.fileName,
      orderNo: u.orderNo,
      title: u.title,
      system: u.system
    });
  });

  await mongoose.disconnect();
}

checkUnmatched();
