import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import mongoose from 'mongoose';

async function listAllLocal() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));
  const docs = await Document.find({
    isArchived: false,
    $or: [
      { storageProvider: 'LOCAL_PERSISTED' },
      { cloudinaryPublicId: /^local_/ },
      { secureUrl: /localhost/ }
    ]
  }).lean();

  console.log(`Total active local docs in entire DB: ${docs.length}`);
  docs.forEach(d => {
    console.log(`[${d._id}] ${d.fileName || d.originalFileName} | Title: "${d.title}" | Order: ${d.orderNumber} | Folder: ${d.folderId} | PublicId: ${d.cloudinaryPublicId}`);
  });

  await mongoose.disconnect();
}
listAllLocal().catch(console.error);
