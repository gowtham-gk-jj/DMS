import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function check188Docs() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Folder = mongoose.model('Folder', new mongoose.Schema({}, { strict: false }));
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));

  const root = await Folder.findOne({ name: 'DOConCD SINUMERIK - SINAMICS 09/2011 English' });
  const allSub = await Folder.find({
    isArchived: false,
    path: new RegExp(`^${root.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  });
  const subIds = allSub.map(s => s._id);

  const docs = await Document.find({ folderId: { $in: subIds }, isArchived: false }).lean();
  console.log('Total documents under DOConCD root tree:', docs.length);

  const catalogue = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/catalogue_matched.json'), 'utf8'));
  console.log('Total catalogue entries:', catalogue.length);

  // Match each doc
  let matchedCatalogue = 0;
  const nonCatalogueDocs = [];

  for (const d of docs) {
    const dFn = (d.originalFileName || d.fileName || '').replace(/\.pdf$/i, '').toLowerCase();
    const dOrder = (d.orderNumber || '').trim().toLowerCase();
    const dTitle = (d.title || '').trim().toLowerCase();

    const isCat = catalogue.some(c => {
      const cFn = (c.fileName || '').replace(/\.pdf$/i, '').toLowerCase();
      const cOrder = (c.orderNo || '').trim().toLowerCase();
      const cTitle = (c.title || '').trim().toLowerCase();
      return (cFn && dFn === cFn) || (cOrder && dOrder === cOrder) || (cTitle && dTitle === cTitle);
    });

    if (isCat) {
      matchedCatalogue++;
    } else {
      nonCatalogueDocs.push({
        id: d._id,
        title: d.title,
        fileName: d.originalFileName || d.fileName,
        category: d.category,
        subcategory: d.subcategory,
      });
    }
  }

  console.log(`Matched catalogue docs: ${matchedCatalogue}`);
  console.log(`Non-catalogue docs in this folder tree: ${nonCatalogueDocs.length}`);
  nonCatalogueDocs.forEach(nc => console.log('  Additional doc:', nc));

  await mongoose.disconnect();
}

check188Docs().catch(console.error);
