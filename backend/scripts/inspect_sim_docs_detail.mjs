import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import mongoose from 'mongoose';

async function checkSimFolderDocs() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));

  const docs = await Document.find({
    folderId: new mongoose.Types.ObjectId('6af9d05ba1a8b3b2f4ddf68b'),
    isArchived: false
  }).lean();

  console.log(`Documents directly in DOConCD_SINUMERIK_SIMODRIVE folder: ${docs.length}`);

  let missingSecureUrl = 0;
  let localhostUrl = 0;
  let cloudinaryUrl = 0;
  let validExt = 0;

  for (const d of docs) {
    if (!d.secureUrl) missingSecureUrl++;
    else if (d.secureUrl.includes('localhost')) localhostUrl++;
    else if (d.secureUrl.includes('cloudinary')) cloudinaryUrl++;

    if (d.fileExtension === 'pdf' || (d.originalFileName && d.originalFileName.endsWith('.pdf'))) {
      validExt++;
    }
  }

  console.log(`URLs: Cloudinary=${cloudinaryUrl}, Localhost=${localhostUrl}, Missing=${missingSecureUrl}`);
  console.log(`PDF extension count: ${validExt} / ${docs.length}`);

  // Let's check localhost documents
  const localDocs = docs.filter(d => d.secureUrl && d.secureUrl.includes('localhost'));
  console.log(`\nLocalhost docs (${localDocs.length}):`);
  localDocs.forEach(d => {
    console.log(`- [${d._id}] ${d.title} | file: ${d.originalFileName} | url: ${d.secureUrl} | cldPubId: ${d.cloudinaryPublicId}`);
  });

  // Let's check sample Cloudinary documents
  const cldDocs = docs.filter(d => d.secureUrl && d.secureUrl.includes('cloudinary'));
  console.log(`\nCloudinary docs sample (first 10 of ${cldDocs.length}):`);
  cldDocs.slice(0, 10).forEach(d => {
    console.log(`- [${d._id}] ${d.title} | file: ${d.originalFileName} | url: ${d.secureUrl}`);
  });

  await mongoose.disconnect();
}

checkSimFolderDocs().catch(console.error);
