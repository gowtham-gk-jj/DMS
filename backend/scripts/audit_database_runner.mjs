import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function runAudit() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB Connected successfully.\n');

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  console.log('=== COLLECTIONS IN DATABASE ===');
  for (const c of collections) {
    const count = await db.collection(c.name).countDocuments();
    console.log(`- ${c.name}: ${count} records`);
  }
  console.log('===============================\n');

  // Load Mongoose models
  const User = (await import('../src/models/User.js')).default;
  const Document = (await import('../src/models/Document.js')).default;
  const Folder = (await import('../src/models/Folder.js')).default;
  const AccessRequest = (await import('../src/models/AccessRequest.js')).default;
  const MigrationJob = (await import('../src/models/MigrationJob.js')).default;
  const MigrationAsset = (await import('../src/models/MigrationAsset.js')).default;
  const AuditLog = (await import('../src/models/AuditLog.js')).default;
  const EmailLog = (await import('../src/models/EmailLog.js')).default;
  const DetectedRepositoryFile = (await import('../src/models/DetectedRepositoryFile.js')).default;
  const GitHubSyncState = (await import('../src/models/GitHubSyncState.js')).default;

  // 1. AUDIT USERS
  console.log('=== 1. USER AUDIT ===');
  const totalUsers = await User.countDocuments();
  const roleBreakdown = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
  const statusBreakdown = await User.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  console.log(`Total Users: ${totalUsers}`);
  console.log('Role Breakdown:', roleBreakdown);
  console.log('Status Breakdown:', statusBreakdown);

  const users = await User.find({}, 'name email role status isMasterAdmin googleId createdAt');
  for (const u of users) {
    console.log(`  * [${u.role}] ${u.email} - status: ${u.status}, isMaster: ${u.isMasterAdmin}, googleAuth: ${!!u.googleId}`);
  }
  console.log('=====================\n');

  // 2. AUDIT FOLDERS
  console.log('=== 2. FOLDER AUDIT ===');
  const totalFolders = await Folder.countDocuments();
  const rootFolders = await Folder.find({ parentFolderId: null });
  console.log(`Total Folders: ${totalFolders}`);
  console.log(`Root Folders count: ${rootFolders.length}`);
  for (const rf of rootFolders) {
    console.log(`  * Root Folder: "${rf.name}" (ID: ${rf._id}, path: ${rf.path}, level: ${rf.level})`);
  }

  // Check folder parents
  const allFolders = await Folder.find({});
  const folderMap = new Map(allFolders.map(f => [f._id.toString(), f]));
  let brokenParentCount = 0;
  for (const f of allFolders) {
    if (f.parentFolderId) {
      if (!folderMap.has(f.parentFolderId.toString())) {
        console.warn(`  [WARNING] Folder "${f.name}" (${f._id}) references non-existent parent: ${f.parentFolderId}`);
        brokenParentCount++;
      }
    }
  }
  console.log(`Folders with broken parent pointers: ${brokenParentCount}`);
  console.log('=======================\n');

  // 3. AUDIT DOCUMENTS
  console.log('=== 3. DOCUMENT AUDIT ===');
  const totalDocs = await Document.countDocuments();
  const availableDocs = await Document.countDocuments({ availabilityStatus: 'AVAILABLE' });
  const archivedDocs = await Document.countDocuments({ isArchived: true });
  console.log(`Total Documents: ${totalDocs}`);
  console.log(`Available Documents: ${availableDocs}`);
  console.log(`Archived Documents: ${archivedDocs}`);

  // Storage provider breakdown
  const storageBreakdown = await Document.aggregate([
    { $group: { _id: '$storageProvider', count: { $sum: 1 }, totalBytes: { $sum: '$fileSize' } } }
  ]);
  console.log('Storage Provider Breakdown:', storageBreakdown);

  // File extension breakdown
  const extBreakdown = await Document.aggregate([
    { $group: { _id: '$fileExtension', count: { $sum: 1 }, totalBytes: { $sum: '$fileSize' } } },
    { $sort: { count: -1 } }
  ]);
  console.log('Extension Breakdown:', extBreakdown);

  // Import ID breakdown
  const importBreakdown = await Document.aggregate([
    { $group: { _id: '$importId', count: { $sum: 1 } } }
  ]);
  console.log('Import ID Breakdown:', importBreakdown);

  // Category breakdown
  const categoryBreakdown = await Document.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  console.log(`Total Categories: ${categoryBreakdown.length}`);
  console.log('Top Categories:', categoryBreakdown.slice(0, 10));

  // Total file size
  const totalSizeBytes = extBreakdown.reduce((acc, curr) => acc + (curr.totalBytes || 0), 0);
  console.log(`Total Stored Bytes in Document Collection: ${totalSizeBytes} (${(totalSizeBytes / (1024 * 1024)).toFixed(2)} MB, ${(totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB)`);

  // Orphaned documents check
  let orphanCount = 0;
  let missingFolderCount = 0;
  for (const doc of await Document.find({}, 'displayName folderId fileName secureUrl storageProvider fileSize')) {
    if (!doc.folderId) {
      missingFolderCount++;
    } else if (!folderMap.has(doc.folderId.toString())) {
      orphanCount++;
    }
    if (!doc.secureUrl) {
      console.warn(`  [WARNING] Document ${doc._id} (${doc.displayName}) has no secureUrl!`);
    }
  }
  console.log(`Documents with no folderId: ${missingFolderCount}`);
  console.log(`Documents with orphaned folderId (pointing to deleted folder): ${orphanCount}`);

  // Check duplicate documents
  const dups = await Document.aggregate([
    { $group: { _id: { title: '$title', folderId: '$folderId' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  console.log(`Duplicate (title + folderId) sets: ${dups.length}`);
  if (dups.length > 0) {
    console.log('Sample duplicates:', dups.slice(0, 5));
  }
  console.log('=========================\n');

  // 4. AUDIT ACCESS REQUESTS
  console.log('=== 4. ACCESS REQUESTS AUDIT ===');
  const totalRequests = await AccessRequest.countDocuments();
  const requestStatus = await AccessRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  console.log(`Total Requests: ${totalRequests}`);
  console.log('Status Breakdown:', requestStatus);
  const requests = await AccessRequest.find({});
  for (const r of requests) {
    console.log(`  * ${r.email} - status: ${r.status}, reason: "${r.reason || ''}", created: ${r.createdAt}`);
  }
  console.log('================================\n');

  // 5. AUDIT MIGRATION JOBS & ASSETS
  console.log('=== 5. MIGRATION JOBS & ASSETS AUDIT ===');
  const totalJobs = await MigrationJob.countDocuments();
  const jobStatus = await MigrationJob.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  console.log(`Total Migration Jobs: ${totalJobs}`);
  console.log('Job Status Breakdown:', jobStatus);

  const jobs = await MigrationJob.find({}, 'jobId status sourceFile progressPercent currentStage stats createdAt errorMessage');
  for (const j of jobs) {
    console.log(`  * [${j.status}] ${j.jobId} - file: ${j.sourceFile}, progress: ${j.progressPercent}%, stage: "${j.currentStage}", stats:`, j.stats, j.errorMessage ? `error: ${j.errorMessage}` : '');
  }

  const totalAssets = await MigrationAsset.countDocuments();
  const uniqueHashes = await MigrationAsset.distinct('sha256');
  console.log(`Total Migration Assets: ${totalAssets}`);
  console.log(`Unique SHA-256 Hashes in MigrationAsset: ${uniqueHashes.length}`);
  console.log('========================================\n');

  // 6. AUDIT LOGS & EMAIL LOGS
  console.log('=== 6. AUDIT & EMAIL LOGS ===');
  const totalAudit = await AuditLog.countDocuments();
  const auditAction = await AuditLog.aggregate([{ $group: { _id: '$action', count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
  console.log(`Total Audit Logs: ${totalAudit}`);
  console.log('Audit Actions:', auditAction);

  const totalEmail = await EmailLog.countDocuments();
  const emailStatus = await EmailLog.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  console.log(`Total Email Logs: ${totalEmail}`);
  console.log('Email Status:', emailStatus);
  console.log('=============================\n');

  // 7. GITHUB SYNC & DETECTED FILES
  console.log('=== 7. GITHUB SYNC & DETECTED FILES ===');
  const totalDetected = await DetectedRepositoryFile.countDocuments();
  const detectedCategory = await DetectedRepositoryFile.aggregate([{ $group: { _id: '$fileTypeCategory', count: { $sum: 1 } } }]);
  const detectedImportStatus = await DetectedRepositoryFile.aggregate([{ $group: { _id: '$importStatus', count: { $sum: 1 } } }]);
  console.log(`Total Detected Files: ${totalDetected}`);
  console.log('Category breakdown:', detectedCategory);
  console.log('Import Status breakdown:', detectedImportStatus);
  const syncState = await GitHubSyncState.findOne({});
  console.log('GitHub Sync State:', syncState ? {
    repo: `${syncState.repoOwner}/${syncState.repoName}`,
    branch: syncState.branch,
    commitSha: syncState.lastCommitSha,
    syncStatus: syncState.syncStatus,
    lastChecked: syncState.lastCheckedAt,
    totalDetected: syncState.totalDetectedFiles
  } : 'None');
  console.log('=======================================\n');

  await mongoose.disconnect();
  console.log('Audit complete.');
}

runAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
