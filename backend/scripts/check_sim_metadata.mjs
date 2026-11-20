import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

async function checkMetadata() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));

  const catPath = path.resolve('backend/data/simodrive_catalogue_extracted.json');
  const catEntries = JSON.parse(fs.readFileSync(catPath, 'utf8'));

  const docs = await Document.find({
    folderId: new mongoose.Types.ObjectId('6af9d05ba1a8b3b2f4ddf68b'),
    isArchived: false
  }).lean();

  console.log(`Found ${docs.length} docs in SIMODRIVE folder.`);

  let emptyOrder = 0;
  let emptyTitle = 0;
  let emptySystem = 0;
  let emptyCategory = 0;

  for (const d of docs) {
    if (!d.orderNumber || d.orderNumber === '—') emptyOrder++;
    if (!d.title || d.title === '—') emptyTitle++;
    if (!d.system || d.system === '—' || d.system === 'DOConCD') emptySystem++;
    if (!d.category || d.category === 'DOConCD_SINUMERIK_SIMODRIVE') emptyCategory++;
  }

  console.log(`Empty/Generic metadata in SIMODRIVE folder docs:`);
  console.log(`- Empty orderNumber: ${emptyOrder} / ${docs.length}`);
  console.log(`- Empty title: ${emptyTitle} / ${docs.length}`);
  console.log(`- Generic system ("DOConCD" or empty): ${emptySystem} / ${docs.length}`);
  console.log(`- Generic category ("DOConCD_SINUMERIK_SIMODRIVE" or empty): ${emptyCategory} / ${docs.length}`);

  // Sample 5
  console.log('\nSample 5 docs:');
  docs.slice(0, 5).forEach(d => {
    console.log({
      _id: d._id.toString(),
      fileName: d.fileName,
      originalFileName: d.originalFileName,
      title: d.title,
      orderNumber: d.orderNumber,
      system: d.system,
      category: d.category,
      softwareVersion: d.softwareVersion,
      edition: d.edition
    });
  });

  await mongoose.disconnect();
}

checkMetadata().catch(console.error);
