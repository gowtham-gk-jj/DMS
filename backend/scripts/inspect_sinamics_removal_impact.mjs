import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function inspectImpact() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas\n');

  const Folder = mongoose.model('Folder', new mongoose.Schema({}, { strict: false }));
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));
  const MigrationJob = mongoose.model('MigrationJob', new mongoose.Schema({}, { strict: false }));
  const MigrationAsset = mongoose.model('MigrationAsset', new mongoose.Schema({}, { strict: false }));
  const DetectedRepositoryFile = mongoose.model('DetectedRepositoryFile', new mongoose.Schema({}, { strict: false }));
  const AuditLog = mongoose.model('AuditLog', new mongoose.Schema({}, { strict: false }));
  const Permission = mongoose.model('Permission', new mongoose.Schema({}, { strict: false }));

  // 1. Root Folder Lookup
  const targetName = 'DOConCD_SINUMERIK_SINAMICS';
  const rootFolder = await Folder.findOne({ name: targetName });
  console.log('=== 1. ROOT FOLDER IDENTIFICATION ===');
  if (!rootFolder) {
    console.log(`No folder found with exact name "${targetName}"!`);
  } else {
    console.log({
      _id: String(rootFolder._id),
      name: rootFolder.name,
      code: rootFolder.code,
      path: rootFolder.path,
      level: rootFolder.level,
      parentFolderId: rootFolder.parentFolderId,
      isArchived: rootFolder.isArchived,
      createdAt: rootFolder.createdAt,
      updatedAt: rootFolder.updatedAt,
    });
  }

  // Also check all folders matching or starting with this path
  let descendantFolders = [];
  let allFolderIds = [];
  if (rootFolder) {
    descendantFolders = await Folder.find({
      $or: [
        { _id: rootFolder._id },
        { parentFolderId: rootFolder._id },
        { path: new RegExp(`^${rootFolder.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/|$)`) },
      ],
    });
    allFolderIds = descendantFolders.map((f) => f._id);
  }

  console.log(`\nTotal Folders in Hierarchy (including root): ${descendantFolders.length}`);
  descendantFolders.forEach((f) => {
    const isRoot = String(f._id) === String(rootFolder?._id);
    console.log(`  - [${isRoot ? 'ROOT' : 'CHILD'}] ID: ${f._id} | Name: "${f.name}" | Path: "${f.path}" | Parent: ${f.parentFolderId}`);
  });

  // 2. Associated Documents
  console.log('\n=== 2. ASSOCIATED DOCUMENTS ===');
  let associatedDocs = [];
  if (allFolderIds.length > 0) {
    associatedDocs = await Document.find({
      $or: [
        { folderId: { $in: allFolderIds } },
        { category: targetName },
        { subcategory: targetName },
      ],
    });
  }

  console.log(`Total Documents associated with ${targetName}: ${associatedDocs.length}`);
  associatedDocs.forEach((d) => {
    console.log(`  - Doc ID: ${d._id} | Title: "${d.title}" | File: ${d.originalFileName || d.fileName} | Size: ${d.fileSize} bytes | Provider: ${d.storageProvider} | PublicID: ${d.cloudinaryPublicId}`);
  });

  // 3. Check for Shared Storage Assets / References
  console.log('\n=== 3. STORAGE & ASSET DEDUPLICATION CHECK ===');
  const otherDocs = await Document.find({
    folderId: { $nin: allFolderIds },
    category: { $ne: targetName },
    subcategory: { $ne: targetName },
  }).lean();

  let sharedPublicIds = [];
  let exclusivePublicIds = [];
  for (const doc of associatedDocs) {
    const pubId = doc.cloudinaryPublicId;
    if (pubId) {
      const isShared = otherDocs.some((od) => od.cloudinaryPublicId === pubId);
      if (isShared) {
        sharedPublicIds.push({ docId: doc._id, pubId, title: doc.title });
      } else {
        exclusivePublicIds.push({ docId: doc._id, pubId, title: doc.title });
      }
    }
  }

  console.log(`Exclusive Cloudinary Assets: ${exclusivePublicIds.length}`);
  console.log(`Shared Cloudinary Assets (must NOT be deleted physically): ${sharedPublicIds.length}`);
  if (sharedPublicIds.length > 0) {
    console.log('Shared assets:', sharedPublicIds);
  }

  // Check local files
  let localFiles = associatedDocs.filter((d) => d.storageProvider === 'LOCAL_PERSISTED');
  console.log(`Local Persisted Documents: ${localFiles.length}`);

  // 4. Migration Jobs History
  console.log('\n=== 4. MIGRATION JOBS FOR ARCHIVE ===');
  const targetZipName = `${targetName}.zip`;
  const migrationJobs = await MigrationJob.find({
    $or: [
      { fileName: targetZipName },
      { archiveName: targetZipName },
      { targetFolder: targetName },
      { targetFolderId: rootFolder ? rootFolder._id : null },
    ],
  });
  console.log(`Migration Jobs referencing ${targetZipName}: ${migrationJobs.length}`);
  migrationJobs.forEach((j) => {
    console.log(`  - Job: ${j.jobId} | Status: ${j.status} | Progress: ${j.progress}% | Stage: "${j.stage}" | Created: ${j.createdAt}`);
  });

  // 5. Detected Repository Files
  console.log('\n=== 5. DETECTED REPOSITORY FILES ===');
  const detectedFiles = await DetectedRepositoryFile.find({
    $or: [{ name: targetZipName }, { path: new RegExp(targetName) }],
  });
  console.log(`DetectedRepositoryFiles matching: ${detectedFiles.length}`);
  detectedFiles.forEach((df) => {
    console.log(`  - File: "${df.name}" | Size: ${df.sizeFormatted || df.size} | Status: ${df.importStatus} | Category: ${df.category}`);
  });

  // 6. Migration Assets
  console.log('\n=== 6. MIGRATION ASSETS TRACKED ===');
  const migrationAssets = await MigrationAsset.find({
    $or: [
      { zipFileName: targetZipName },
      { archiveName: targetZipName },
      { folderPath: new RegExp(targetName) },
    ],
  });
  console.log(`MigrationAssets referencing ${targetName}: ${migrationAssets.length}`);

  // 7. Folder Permissions
  console.log('\n=== 7. PERMISSION RECORDS ===');
  let permissionsCount = 0;
  if (allFolderIds.length > 0) {
    permissionsCount = await Permission.countDocuments({ folderId: { $in: allFolderIds } });
  }
  console.log(`Specific Permission Overrides for these folders: ${permissionsCount}`);

  // 8. Unrelated Libraries Check (Verification that DOConCD_SINUMERIK_SIMODRIVE and DOConCD SINUMERIK - SINAMICS 09/2011 English are safe)
  console.log('\n=== 8. UNRELATED LIBRARIES SAFETY CHECK ===');
  const simodriveRoot = await Folder.findOne({ name: 'DOConCD_SINUMERIK_SIMODRIVE' });
  const officialCatalogueRoot = await Folder.findOne({ name: 'DOConCD SINUMERIK - SINAMICS 09/2011 English' });
  console.log(`SIMODRIVE Root: ID ${simodriveRoot?._id}, Path: ${simodriveRoot?.path}`);
  console.log(`Official 09/2011 Catalogue Root: ID ${officialCatalogueRoot?._id}, Path: ${officialCatalogueRoot?.path}`);

  const simodriveDocs = await Document.countDocuments({
    $or: [
      { category: 'DOConCD_SINUMERIK_SIMODRIVE' },
      { folderId: simodriveRoot?._id },
    ],
  });
  console.log(`SIMODRIVE Documents count: ${simodriveDocs}`);

  const officialDocs = await Document.countDocuments({
    importId: 'DOCONCD_SINUMERIK_SINAMICS_0911',
    category: { $ne: 'DOConCD_SINUMERIK_SIMODRIVE' },
  });
  console.log(`Official 09/2011 Catalogue Documents count: ${officialDocs}`);

  await mongoose.disconnect();
  console.log('\nInspection complete.');
}

inspectImpact().catch((err) => {
  console.error('Fatal inspection error:', err);
  process.exit(1);
});
