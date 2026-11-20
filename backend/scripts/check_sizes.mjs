import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import mongoose from 'mongoose';

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));
  const zeroSize = await Document.countDocuments({
    isArchived: false,
    $or: [
      { fileSize: { $exists: false } },
      { fileSize: null },
      { fileSize: 0 }
    ]
  });
  console.log('Docs with 0 or missing fileSize:', zeroSize);

  // Check the 212 analysis
  const fs = await import('fs');
  const sim = JSON.parse(fs.readFileSync('backend/data/simodrive_212_analysis.json', 'utf8'));
  const noSize = [];
  for (const s of sim) {
    if (s.inMongoId) {
      const d = await Document.findById(s.inMongoId).lean();
      if (!d.fileSize) noSize.push({ index: s.index, fileName: s.fileName, size: d.fileSize });
    }
  }
  console.log('SIMODRIVE entries in Mongo with no size:', noSize.length, noSize);

  await mongoose.disconnect();
}
check().catch(console.error);
