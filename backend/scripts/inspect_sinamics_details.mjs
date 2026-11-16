import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkSinamicsDetails() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Job = mongoose.model('MigrationJob', new mongoose.Schema({}, { strict: false }));
  const Det = mongoose.model('DetectedRepositoryFile', new mongoose.Schema({}, { strict: false }));
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));
  const Folder = mongoose.model('Folder', new mongoose.Schema({}, { strict: false }));

  console.log('=== DETECTED REPOSITORY FILE FOR SINAMICS ===');
  const sinamicsDet = await Det.findOne({ fileName: 'DOConCD_SINUMERIK_SINAMICS.zip' });
  console.log(sinamicsDet ? {
    _id: sinamicsDet._id,
    fileName: sinamicsDet.fileName,
    fileSize: sinamicsDet.fileSize,
    fileSizeMB: (sinamicsDet.fileSize / (1024 * 1024)).toFixed(2) + ' MB',
    isLfs: sinamicsDet.isLfs,
    lfsOid: sinamicsDet.lfsOid,
    importStatus: sinamicsDet.importStatus,
    importedDocumentIdsCount: sinamicsDet.importedDocumentIds?.length || 0,
  } : 'None found');

  console.log('\n=== MIGRATION JOBS FOR SINAMICS ===');
  const sinamicsJobs = await Job.find({ sourceFile: 'DOConCD_SINUMERIK_SINAMICS.zip' });
  console.log(`Found ${sinamicsJobs.length} jobs:`);
  sinamicsJobs.forEach(j => {
    console.log({
      jobId: j.jobId,
      status: j.status,
      progressPercent: j.progressPercent,
      currentStage: j.currentStage,
      createdAt: j.createdAt,
      stats: j.stats,
    });
  });

  console.log('\n=== DOCUMENTS IN FOLDERS ===');
  const root = await Folder.findOne({ name: 'DOConCD_SINUMERIK_SINAMICS' });
  const allSub = await Folder.find({ path: new RegExp('^/DOConCD_SINUMERIK_SINAMICS') });
  const subIds = allSub.map(s => s._id);

  const docsInLib = await Document.find({ folderId: { $in: subIds } }).lean();
  console.log(`Found ${docsInLib.length} documents in DOConCD_SINUMERIK_SINAMICS library:`);
  docsInLib.forEach(d => {
    console.log({
      _id: d._id,
      title: d.title,
      fileName: d.originalFileName || d.fileName,
      category: d.category,
      subcategory: d.subcategory,
      storageProvider: d.storageProvider,
      cloudinaryPublicId: d.cloudinaryPublicId,
      secureUrl: d.secureUrl,
      folderId: d.folderId,
    });
  });

  console.log('\n=== CHECK IF THESE 3 DOCUMENTS ARE REFERENCED ANYWHERE ELSE ===');
  for (const d of docsInLib) {
    const pubId = d.cloudinaryPublicId;
    const samePub = await Document.find({ _id: { $ne: d._id }, cloudinaryPublicId: pubId });
    console.log(`Doc "${d.title}" (${pubId}): referenced by ${samePub.length} other documents.`);
  }

  console.log('\n=== CHECK IF ANY CATALOGUE RECORDS (DOCONCD 09/2011) REFERENCE DOConCD_SINUMERIK_SINAMICS ===');
  const catDocs = await Document.find({
    importId: 'DOCONCD_SINUMERIK_SINAMICS_0911',
    folderId: { $in: subIds }
  });
  console.log(`Catalogue documents inside DOConCD_SINUMERIK_SINAMICS folders: ${catDocs.length}`);

  await mongoose.disconnect();
}

checkSinamicsDetails();
