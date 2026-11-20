import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import mongoose from 'mongoose';

async function checkNonSeedDocs() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));

  const realDocs = await Document.find({
    cloudinaryPublicId: { $not: /^seed/ },
    isArchived: false
  }).lean();

  console.log('Total non-seed active documents in DB:', realDocs.length);

  // Group by folderId or category
  const folderCounts = {};
  const cldPrefixes = {};
  for (const d of realDocs) {
    folderCounts[d.folderId?.toString()] = (folderCounts[d.folderId?.toString()] || 0) + 1;
    if (d.cloudinaryPublicId) {
      const pfx = d.cloudinaryPublicId.split('/')[0];
      cldPrefixes[pfx] = (cldPrefixes[pfx] || 0) + 1;
    }
  }
  console.log('Folder counts for real docs:', folderCounts);
  console.log('Cloudinary publicId prefixes for real docs:', cldPrefixes);

  // Sample 10 real docs
  console.log('\nSample 10 real docs:');
  realDocs.slice(0, 10).forEach(d => {
    console.log({
      id: d._id.toString(),
      fileName: d.fileName,
      originalFileName: d.originalFileName,
      title: d.title,
      orderNumber: d.orderNumber,
      secureUrl: d.secureUrl,
      cloudinaryPublicId: d.cloudinaryPublicId,
      folderId: d.folderId?.toString(),
      availabilityStatus: d.availabilityStatus
    });
  });

  await mongoose.disconnect();
}

checkNonSeedDocs().catch(console.error);
