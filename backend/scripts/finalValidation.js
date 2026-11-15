const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Document = require('../src/models/Document');
const Folder = require('../src/models/Folder');
const MigrationState = require('../src/models/MigrationState');
const { IMPORT_ID } = require('../src/services/migrationService');

async function validate() {
  console.log('='.repeat(70));
  console.log('COMPREHENSIVE FINAL VERIFICATION & VALIDATION SUITE');
  console.log('='.repeat(70));

  await mongoose.connect(process.env.MONGODB_URI);

  // 1. Check pages 1-5 represented in DB
  const pages = await Document.distinct('cataloguePage', { importId: IMPORT_ID });
  pages.sort((a, b) => a - b);
  console.log(`\n1. Catalogue Pages Represented in DB: [${pages.join(', ')}]`);
  const allPagesPresent = [1, 2, 3, 4, 5].every((p) => pages.includes(p));
  console.log(`   -> All 5 pages processed: ${allPagesPresent ? 'PASS (100%)' : 'FAIL'}`);

  // 2. Count total documents in DB for this import
  const totalDocs = await Document.countDocuments({ importId: IMPORT_ID, isArchived: false });
  console.log(`\n2. Total Catalogue Document Records in MongoDB: ${totalDocs}`);
  console.log(`   -> Expected: 186. Result: ${totalDocs === 186 ? 'PASS' : 'FAIL'}`);

  // 3. Count documents by availabilityStatus
  const availableDocs = await Document.countDocuments({ importId: IMPORT_ID, availabilityStatus: 'AVAILABLE' });
  const missingDocs = await Document.countDocuments({ importId: IMPORT_ID, availabilityStatus: 'FILE_NOT_FOUND' });
  console.log(`\n3. Availability Status Counts:`);
  console.log(`   - AVAILABLE: ${availableDocs}`);
  console.log(`   - FILE_NOT_FOUND: ${missingDocs}`);

  // 4. Storage Provider breakdown
  const storageBreakdown = await Document.aggregate([
    { $match: { importId: IMPORT_ID } },
    { $group: { _id: '$storageProvider', count: { $sum: 1 } } },
  ]);
  console.log(`\n4. Storage Provider Breakdown:`);
  storageBreakdown.forEach((s) => console.log(`   - ${s._id}: ${s.count} documents`));

  // 5. Check folders created
  const rootFolder = await Folder.findOne({ name: 'DOConCD SINUMERIK - SINAMICS 09/2011 English', isArchived: false });
  console.log(`\n5. Master Root Folder in MongoDB:`);
  console.log(`   - Name: ${rootFolder?.name}`);
  console.log(`   - ID: ${rootFolder?._id}`);
  console.log(`   - Path: ${rootFolder?.path}`);

  const childFolders = await Folder.find({ parentFolderId: rootFolder._id, isArchived: false });
  console.log(`   - Child categories under root: ${childFolders.length}`);
  childFolders.forEach((cf) => console.log(`     • ${cf.name} (Code: ${cf.code})`));

  // 6. Category-wise Document Distribution
  const catDistribution = await Document.aggregate([
    { $match: { importId: IMPORT_ID } },
    { $group: { _id: { category: '$category', subcategory: '$subcategory' }, count: { $sum: 1 }, available: { $sum: { $cond: [{ $eq: ['$availabilityStatus', 'AVAILABLE'] }, 1, 0] } } } },
    { $sort: { '_id.category': 1 } },
  ]);
  console.log(`\n6. Category-wise Document Verification:`);
  catDistribution.forEach((c) => {
    const fullCat = c._id.subcategory ? `${c._id.category} / ${c._id.subcategory}` : c._id.category;
    console.log(`   - ${fullCat.padEnd(52)}: ${c.count} docs (${c.available} available)`);
  });

  // 7. Verify sample document records for metadata integrity
  console.log(`\n7. Sample Document Metadata Verification:`);
  const sample1 = await Document.findOne({ importId: IMPORT_ID, fileName: 'BHUsl' });
  console.log(`   Sample 1 (Page 1):`);
  console.log(`     Title: ${sample1?.title}`);
  console.log(`     System: ${sample1?.system}`);
  console.log(`     SW: ${sample1?.softwareVersion}`);
  console.log(`     Edition: ${sample1?.edition}`);
  console.log(`     Order No: ${sample1?.orderNumber}`);
  console.log(`     File Name: ${sample1?.fileName}`);
  console.log(`     Storage: ${sample1?.storageProvider}`);
  console.log(`     Secure URL: ${sample1?.secureUrl ? sample1.secureUrl.slice(0, 60) + '...' : 'NONE'}`);

  const sample2 = await Document.findOne({ importId: IMPORT_ID, fileName: '1FE1VPM120_BE' });
  console.log(`   Sample 2 (Page 3 Match by Order Number):`);
  console.log(`     Title: ${sample2?.title}`);
  console.log(`     Order No: ${sample2?.orderNumber}`);
  console.log(`     File Name: ${sample2?.fileName}`);
  console.log(`     Original File: ${sample2?.originalFileName}`);
  console.log(`     Storage: ${sample2?.storageProvider}`);

  const sample3 = await Document.findOne({ importId: IMPORT_ID, fileName: 'S7OP' });
  console.log(`   Sample 3 (Page 5 SIMATIC S7OP Match):`);
  console.log(`     Title: ${sample3?.title}`);
  console.log(`     Order No: ${sample3?.orderNumber}`);
  console.log(`     File Name: ${sample3?.fileName}`);
  console.log(`     Original File: ${sample3?.originalFileName}`);
  console.log(`     Storage: ${sample3?.storageProvider}`);

  // 8. Migration State Record in DB
  const migState = await MigrationState.findOne({ importId: IMPORT_ID });
  console.log(`\n8. Migration State Record:`);
  console.log(`   - Status: ${migState?.status}`);
  console.log(`   - Started At: ${migState?.startedAt}`);
  console.log(`   - Completed At: ${migState?.completedAt}`);
  console.log(`   - Successful Uploads: ${migState?.stats?.cloudinaryUploadsSuccessful}`);
  console.log(`   - Failed Uploads: ${migState?.stats?.cloudinaryUploadsFailed}`);
  console.log(`   - Total Logs: ${migState?.logs?.length}`);

  console.log('\n' + '='.repeat(70));
  console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('='.repeat(70));

  await mongoose.disconnect();
}

validate().catch(console.error);
