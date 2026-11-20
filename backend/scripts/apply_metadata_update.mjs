import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import fs from 'fs';
import mongoose from 'mongoose';

async function applyUpdates() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));

  const updates = JSON.parse(fs.readFileSync('backend/data/simodrive_proposed_updates.json', 'utf8'));
  console.log(`Applying metadata updates to ${updates.length} SIMODRIVE documents in MongoDB...`);

  let successCount = 0;
  for (const item of updates) {
    const res = await Document.updateOne(
      { _id: new mongoose.Types.ObjectId(item._id) },
      {
        $set: {
          title: item.after.title,
          orderNumber: item.after.orderNumber,
          system: item.after.system,
          category: item.after.category,
          softwareVersion: item.after.softwareVersion,
          edition: item.after.edition,
          catalogueIndex: item.after.catalogueIndex,
          availabilityStatus: item.after.availabilityStatus,
        }
      }
    );

    if (res.matchedCount === 1) {
      successCount++;
    } else {
      console.warn(`Could not match doc ${item._id} (${item.fileName})`);
    }
  }

  console.log(`Successfully updated ${successCount} / ${updates.length} documents.`);
  await mongoose.disconnect();
}

applyUpdates().catch(console.error);
