import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

async function dryRun() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));

  const catPath = path.resolve('backend/data/simodrive_catalogue_extracted.json');
  const catEntries = JSON.parse(fs.readFileSync(catPath, 'utf8'));

  const SIMODRIVE_ROOT_ID = '6af9d05ba1a8b3b2f4ddf68b';
  const docs = await Document.find({
    folderId: new mongoose.Types.ObjectId(SIMODRIVE_ROOT_ID),
    isArchived: false,
  }).lean();

  console.log(`Found ${docs.length} active documents in SIMODRIVE root folder.`);

  const proposedUpdates = [];

  for (const doc of docs) {
    const rawFn = (doc.fileName || '').trim().toLowerCase();
    const origBase = (doc.originalFileName || '').replace(/\.[^/.]+$/, '').trim().toLowerCase();

    const match = catEntries.find(c => {
      const cfn = (c.fileName || '').trim().toLowerCase();
      return cfn === rawFn || cfn === origBase;
    });

    if (match) {
      proposedUpdates.push({
        _id: doc._id.toString(),
        fileName: doc.fileName || doc.originalFileName,
        before: {
          title: doc.title,
          orderNumber: doc.orderNumber,
          system: doc.system,
          category: doc.category,
          softwareVersion: doc.softwareVersion,
          edition: doc.edition,
          availabilityStatus: doc.availabilityStatus,
        },
        after: {
          title: match.title,
          orderNumber: match.orderNumber,
          system: match.system || '—',
          category: match.category,
          softwareVersion: match.softwareVersion || '—',
          edition: match.edition || '—',
          catalogueIndex: match.catalogueIndex,
          availabilityStatus: 'AVAILABLE',
        }
      });
    }
  }

  console.log(`Proposed updates for ${proposedUpdates.length} documents.`);
  fs.writeFileSync('backend/data/simodrive_proposed_updates.json', JSON.stringify(proposedUpdates, null, 2));

  console.log('\nSample 3 proposed updates:');
  console.log(JSON.stringify(proposedUpdates.slice(0, 3), null, 2));

  await mongoose.disconnect();
}

dryRun().catch(console.error);
