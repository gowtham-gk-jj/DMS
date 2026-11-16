import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const EXPECTED_ROOT_ID = '6af9d05ca1a8b3b2f4ddf68c';
const EXPECTED_CHILD_IDS = [
  '6af9d05ca1a8b3b2f4ddf692',
  '6af9d05da1a8b3b2f4ddf693',
  '6af9d05da1a8b3b2f4ddf694',
  '6af9d05da1a8b3b2f4ddf695',
];
const EXPECTED_DOC_IDS = [
  '6af9d05ea1a8b3b2f4ddf69d',
  '6af9d05ea1a8b3b2f4ddf69e',
  '6af9d05ea1a8b3b2f4ddf69f',
];

async function executeDeletion() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas successfully.\n');

  const Folder = mongoose.model('Folder', new mongoose.Schema({}, { strict: false }));
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));
  const AuditLog = mongoose.model('AuditLog', new mongoose.Schema({}, { strict: false }));
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

  // ==========================================
  // STEP 1: PRE-DELETION VERIFICATION & CHECKS
  // ==========================================
  console.log('=== STEP 1: MANDATORY PRE-DELETION VERIFICATION ===');
  
  // 1.1 Verify Root Folder
  const rootFolder = await Folder.findById(EXPECTED_ROOT_ID);
  if (!rootFolder) {
    throw new Error(`ABORT: Root folder with ID ${EXPECTED_ROOT_ID} not found!`);
  }
  if (rootFolder.name !== 'DOConCD_SINUMERIK_SINAMICS') {
    throw new Error(`ABORT: Root folder name "${rootFolder.name}" does not match approved target "DOConCD_SINUMERIK_SINAMICS"!`);
  }
  console.log(`[PASS] Root folder verified: "${rootFolder.name}" (${rootFolder._id})`);

  // 1.2 Verify Child Folders
  const allSubfolders = await Folder.find({
    $or: [
      { parentFolderId: rootFolder._id },
      { path: new RegExp(`^${rootFolder.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`) }
    ]
  });

  if (allSubfolders.length !== EXPECTED_CHILD_IDS.length) {
    throw new Error(`ABORT: Expected ${EXPECTED_CHILD_IDS.length} child folders, found ${allSubfolders.length}! Scope mismatch.`);
  }

  const foundChildIds = allSubfolders.map(f => String(f._id));
  for (const expId of EXPECTED_CHILD_IDS) {
    if (!foundChildIds.includes(expId)) {
      throw new Error(`ABORT: Expected child folder ${expId} not found in database!`);
    }
  }
  console.log(`[PASS] All 4 approved child folders verified: ${foundChildIds.join(', ')}`);

  // 1.3 Verify Documents
  const allFolderIds = [rootFolder._id, ...allSubfolders.map(f => f._id)];
  const associatedDocs = await Document.find({
    $or: [
      { folderId: { $in: allFolderIds } },
      { category: 'DOConCD_SINUMERIK_SINAMICS' }
    ]
  });

  if (associatedDocs.length !== EXPECTED_DOC_IDS.length) {
    throw new Error(`ABORT: Expected ${EXPECTED_DOC_IDS.length} documents, found ${associatedDocs.length}! Scope mismatch.`);
  }

  const foundDocIds = associatedDocs.map(d => String(d._id));
  for (const expDocId of EXPECTED_DOC_IDS) {
    if (!foundDocIds.includes(expDocId)) {
      throw new Error(`ABORT: Expected document ${expDocId} not found in library!`);
    }
  }
  console.log(`[PASS] All 3 approved documents verified: ${foundDocIds.join(', ')}`);

  // 1.4 Verify Unrelated Resources Protection
  const simodriveRoot = await Folder.findOne({ name: 'DOConCD_SINUMERIK_SIMODRIVE' });
  const officialCatalogueRoot = await Folder.findOne({ name: 'DOConCD SINUMERIK - SINAMICS 09/2011 English' });
  if (!simodriveRoot || !officialCatalogueRoot) {
    throw new Error('ABORT: Unrelated library roots missing! Cannot guarantee safety.');
  }
  console.log(`[PASS] SIMODRIVE library confirmed isolated: ${simodriveRoot._id}`);
  console.log(`[PASS] Official DOConCD library confirmed isolated: ${officialCatalogueRoot._id}`);

  // ==========================================
  // STEP 2: CREATE RECOVERABLE BACKUP
  // ==========================================
  console.log('\n=== STEP 2: RECOVERABLE BACKUP GENERATION ===');
  const backupData = {
    backupTimestamp: new Date().toISOString(),
    approvedScope: {
      targetLibrary: 'DOConCD_SINUMERIK_SINAMICS',
      rootFolderId: EXPECTED_ROOT_ID,
      childFolderIds: EXPECTED_CHILD_IDS,
      documentIds: EXPECTED_DOC_IDS,
    },
    records: {
      rootFolder: rootFolder.toObject(),
      childFolders: allSubfolders.map(f => f.toObject()),
      documents: associatedDocs.map(d => d.toObject()),
    }
  };

  const backupDir = path.resolve(__dirname, '../data/backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupFilePath = path.join(backupDir, `backup_deleted_library_DOConCD_SINUMERIK_SINAMICS_${Date.now()}.json`);
  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`[PASS] Recoverable backup saved to: ${backupFilePath} (${fs.statSync(backupFilePath).size} bytes)`);

  // ==========================================
  // STEP 3: EXECUTE DELETION TRANSACTION
  // ==========================================
  console.log('\n=== STEP 3: EXECUTING DATABASE DELETION ===');
  const adminUser = await User.findOne({ email: 'technova552026@gmail.com' });

  let session = null;
  let useTransactions = false;

  try {
    session = await mongoose.startSession();
    session.startTransaction();
    useTransactions = true;
    console.log('Active MongoDB transaction started.');
  } catch (txErr) {
    console.log('Transactions unsupported on this cluster mode; falling back to sequential controlled deletion with backup validation.');
    useTransactions = false;
  }

  let deletedDocCount = 0;
  let deletedChildFolderCount = 0;
  let deletedRootFolderCount = 0;

  try {
    const opts = useTransactions ? { session } : {};

    // 3.1 Delete the 3 approved documents
    const docDelRes = await Document.deleteMany({ _id: { $in: EXPECTED_DOC_IDS } }, opts);
    deletedDocCount = docDelRes.deletedCount;
    console.log(`[DELETED] ${deletedDocCount} Document records deleted.`);

    // 3.2 Delete the 4 approved child folders
    const childDelRes = await Folder.deleteMany({ _id: { $in: EXPECTED_CHILD_IDS } }, opts);
    deletedChildFolderCount = childDelRes.deletedCount;
    console.log(`[DELETED] ${deletedChildFolderCount} Child Folder records deleted.`);

    // 3.3 Delete the root folder
    const rootDelRes = await Folder.deleteOne({ _id: EXPECTED_ROOT_ID }, opts);
    deletedRootFolderCount = rootDelRes.deletedCount;
    console.log(`[DELETED] ${deletedRootFolderCount} Root Folder record deleted.`);

    // Verify exact deletion counts
    if (deletedDocCount !== 3 || deletedChildFolderCount !== 4 || deletedRootFolderCount !== 1) {
      throw new Error(`Deletion count mismatch! Expected 3 docs, 4 children, 1 root. Got ${deletedDocCount}, ${deletedChildFolderCount}, ${deletedRootFolderCount}. Aborting.`);
    }

    if (useTransactions && session) {
      await session.commitTransaction();
      console.log('Transaction committed successfully.');
    }
  } catch (err) {
    if (useTransactions && session) {
      await session.abortTransaction();
      console.log('Transaction aborted due to error.');
    }
    throw err;
  } finally {
    if (session) {
      await session.endSession();
    }
  }

  // ==========================================
  // STEP 4: RECORD AUDIT LOG EVENT
  // ==========================================
  console.log('\n=== STEP 4: RECORDING AUDIT LOG EVENT ===');
  const auditEntry = await AuditLog.create({
    action: 'LIBRARY_DELETE',
    user: adminUser ? adminUser._id : null,
    userEmail: adminUser ? adminUser.email : 'technova552026@gmail.com',
    userName: adminUser ? adminUser.name : 'Master Root Administrator',
    userRole: 'ADMIN',
    targetType: 'LIBRARY',
    targetId: EXPECTED_ROOT_ID,
    targetName: 'DOConCD_SINUMERIK_SINAMICS',
    details: {
      actionDescription: 'Explicitly approved production library deletion of DOConCD_SINUMERIK_SINAMICS',
      deletedRootFolderId: EXPECTED_ROOT_ID,
      deletedChildFolderIds: EXPECTED_CHILD_IDS,
      deletedDocumentIds: EXPECTED_DOC_IDS,
      deletedCount: {
        rootFolders: deletedRootFolderCount,
        childFolders: deletedChildFolderCount,
        documents: deletedDocCount,
        total: deletedRootFolderCount + deletedChildFolderCount + deletedDocCount,
      },
      backupFile: path.basename(backupFilePath),
      result: 'SUCCESS',
      preservedLibraries: [
        'DOConCD SINUMERIK - SINAMICS 09/2011 English',
        'DOConCD_SINUMERIK_SIMODRIVE'
      ],
      timestamp: new Date().toISOString(),
    },
    ipAddress: '127.0.0.1',
    userAgent: 'DMS-Production-Admin-Console',
  });
  console.log(`[PASS] Audit log recorded with ID: ${auditEntry._id}`);

  // ==========================================
  // STEP 5: POST-DELETION RECALCULATION & AUDIT
  // ==========================================
  console.log('\n=== STEP 5: POST-DELETION DATABASE RECALCULATION ===');
  
  const totalRootFolders = await Folder.countDocuments({ parentFolderId: null, isArchived: false });
  const totalFolders = await Folder.countDocuments({ isArchived: false });
  const totalDocuments = await Document.countDocuments({ isArchived: false });
  const officialCatalogueDocs = await Document.countDocuments({ importId: 'DOCONCD_SINUMERIK_SINAMICS_0911', category: { $ne: 'DOConCD_SINUMERIK_SIMODRIVE' } });
  const simodriveDocs = await Document.countDocuments({
    $or: [
      { category: 'DOConCD_SINUMERIK_SIMODRIVE' },
      { folderId: simodriveRoot._id }
    ],
    isArchived: false
  });
  const localPersistedFiles = await Document.countDocuments({ storageProvider: 'LOCAL_PERSISTED', isArchived: false });

  // Verification against expectations
  console.log('Post-Deletion Database Statistics:');
  console.log(`- Root Folders: ${totalRootFolders} (Expected: 2) -> ${totalRootFolders === 2 ? '✅ PASS' : '❌ MISMATCH'}`);
  console.log(`- Total Folders: ${totalFolders} (Expected: 30) -> ${totalFolders === 30 ? '✅ PASS' : '❌ MISMATCH'}`);
  console.log(`- Total Documents: ${totalDocuments} (Expected: 756) -> ${totalDocuments === 756 ? '✅ PASS' : '❌ MISMATCH'}`);
  console.log(`- Official Catalogue Documents: ${officialCatalogueDocs} (Expected: 188 / 186 unique) -> ${officialCatalogueDocs >= 186 ? '✅ PASS' : '❌ MISMATCH'}`);
  console.log(`- SIMODRIVE Documents: ${simodriveDocs} (Expected: 558) -> ${simodriveDocs >= 558 ? '✅ PASS' : '❌ MISMATCH'}`);
  console.log(`- Local Persisted Files: ${localPersistedFiles} (Expected: 33) -> ${localPersistedFiles === 33 ? '✅ PASS' : '❌ MISMATCH'}`);

  // 5.2 Confirm deleted library no longer resolves
  const checkRootAgain = await Folder.findById(EXPECTED_ROOT_ID);
  const checkDocsAgain = await Document.find({ _id: { $in: EXPECTED_DOC_IDS } });
  const checkFoldersAgain = await Folder.find({ _id: { $in: EXPECTED_CHILD_IDS } });

  console.log('\n=== STEP 6: VERIFICATION OF GONE RECORDS ===');
  console.log(`Root folder resolved: ${Boolean(checkRootAgain)} (Expected: false) -> ${!checkRootAgain ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Child folders resolved: ${checkFoldersAgain.length} (Expected: 0) -> ${checkFoldersAgain.length === 0 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Documents resolved: ${checkDocsAgain.length} (Expected: 0) -> ${checkDocsAgain.length === 0 ? '✅ PASS' : '❌ FAIL'}`);

  await mongoose.disconnect();
  console.log('\nLibrary DOConCD_SINUMERIK_SINAMICS successfully deleted and verified.');
}

executeDeletion().catch(err => {
  console.error('\nFATAL ERROR DURING DELETION:', err);
  process.exit(1);
});
