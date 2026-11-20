import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import mongoose from 'mongoose';

async function analyzeSimodriveDocs() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Folder = mongoose.model('Folder', new mongoose.Schema({}, { strict: false }));
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));

  // Find all folders with SIMODRIVE
  const simFolders = await Folder.find({
    $or: [
      { name: /SIMODRIVE/i },
      { path: /SIMODRIVE/i }
    ]
  }).lean();

  console.log('SIMODRIVE Folders:', simFolders.map(f => ({ id: f._id.toString(), name: f.name, path: f.path, parent: f.parentFolderId?.toString() })));

  const simFolderIds = simFolders.map(f => f._id);

  // Find all documents in these folders
  const docs = await Document.find({
    $or: [
      { folderId: { $in: simFolderIds } },
      { category: /SIMODRIVE/i },
      { path: /SIMODRIVE/i },
      { cloudinaryPublicId: /SIMODRIVE/i },
      { secureUrl: /SIMODRIVE/i }
    ]
  }).lean();

  console.log(`Found ${docs.length} documents matching SIMODRIVE queries.`);

  // Let's summarize storageProvider, availabilityStatus, secureUrl patterns
  const storageSummary = {};
  const availSummary = {};
  let localUrls = 0;
  let cloudinaryUrls = 0;
  let missingUrls = 0;

  for (const d of docs) {
    storageSummary[d.storageProvider] = (storageSummary[d.storageProvider] || 0) + 1;
    availSummary[d.availabilityStatus] = (availSummary[d.availabilityStatus] || 0) + 1;
    if (!d.secureUrl) missingUrls++;
    else if (d.secureUrl.includes('cloudinary')) cloudinaryUrls++;
    else if (d.secureUrl.includes('localhost') || d.secureUrl.startsWith('/')) localUrls++;
  }

  console.log('Storage providers:', storageSummary);
  console.log('Availability statuses:', availSummary);
  console.log(`URLs: Cloudinary=${cloudinaryUrls}, Local=${localUrls}, Missing=${missingUrls}`);

  // Sample documents
  console.log('Sample documents (first 5):');
  docs.slice(0, 5).forEach(d => {
    console.log({
      _id: d._id.toString(),
      fileName: d.fileName,
      originalFileName: d.originalFileName,
      title: d.title,
      orderNumber: d.orderNumber,
      folderId: d.folderId?.toString(),
      secureUrl: d.secureUrl,
      cloudinaryPublicId: d.cloudinaryPublicId,
      availabilityStatus: d.availabilityStatus,
      storageProvider: d.storageProvider,
      fileSize: d.fileSize
    });
  });

  await mongoose.disconnect();
}

analyzeSimodriveDocs().catch(console.error);
