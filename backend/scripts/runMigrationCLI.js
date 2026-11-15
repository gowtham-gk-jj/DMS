const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Document = require('../src/models/Document');
const Folder = require('../src/models/Folder');
const User = require('../src/models/User');
const MigrationState = require('../src/models/MigrationState');
const { uploadToCloudinary } = require('../src/services/cloudinaryService');
const {
  IMPORT_ID,
  CATEGORY_TO_FOLDER_NAME,
  generateDryRunReport,
} = require('../src/services/migrationService');

async function main() {
  console.log('='.repeat(70));
  console.log('SIEMENS DOCONCD SINUMERIK / SINAMICS 09/2011 MASTER MIGRATION');
  console.log('='.repeat(70));

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas');

  // STEP 1: DRY RUN SAFETY REPORT
  console.log('\n[STEP 1] Generating Dry-Run Safety Report...');
  const dryRun = await generateDryRunReport();
  console.log('\n--- DRY-RUN REPORT ---');
  console.log(`Source Repository:            ${dryRun.sourceRepository}`);
  console.log(`Master Catalogue PDF:         ${dryRun.catalogueFile}`);
  console.log(`Total ZIP Archives Found:     ${dryRun.stats.archivesFound}`);
  console.log(`Nested Archives Extracted:    ${dryRun.stats.nestedArchivesExtracted}`);
  console.log(`Extracted Working Files:      ${dryRun.stats.extractedDocuments}`);
  console.log(`Catalogue Rows Extracted:     ${dryRun.stats.catalogueRowsExtracted}`);
  console.log(`Actual Files Matched:         ${dryRun.stats.actualFilesMatched}`);
  console.log(`Missing Catalogue Documents:  ${dryRun.stats.missingCatalogueDocuments}`);
  console.log(`Duplicate Files Identified:   ${dryRun.stats.duplicateFiles}`);
  console.log(`Unsupported Files (CAD etc.): ${dryRun.stats.unsupportedFiles}`);

  console.log('\n--- CATEGORY BREAKDOWN ---');
  dryRun.categoryBreakdown.forEach((c) => {
    console.log(`  - ${c.categoryPath.padEnd(52)} : ${c.totalDocuments} docs (Available: ${c.availableFiles}, Missing: ${c.missingFiles})`);
  });

  // STEP 2: LOAD MATCHED CATALOGUE AND FOLDER LOOKUP
  const matchedPath = path.join(__dirname, '../data/catalogue_matched.json');
  const matchedDocs = JSON.parse(fs.readFileSync(matchedPath, 'utf8'));

  const folderLookupPath = path.join(__dirname, '../data/folder_lookup.json');
  const folderLookup = JSON.parse(fs.readFileSync(folderLookupPath, 'utf8'));

  const admin = (await User.findOne({ role: 'ADMIN' })) || (await User.findOne());
  const adminId = admin ? admin._id : null;

  // STEP 3: MIGRATION EXECUTION
  console.log('\n[STEP 2] Executing Controlled Migration to Cloudinary & MongoDB...');
  let state = await MigrationState.findOne({ importId: IMPORT_ID });
  if (!state) {
    state = new MigrationState({
      importId: IMPORT_ID,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      stats: dryRun.stats,
    });
  } else {
    state.status = 'IN_PROGRESS';
  }

  let uploadSuccess = 0;
  let uploadFailed = 0;
  let docsUpserted = 0;
  const batchSize = 4; // Controlled batches

  // Upload cache by sha256 to avoid uploading duplicate files repeatedly!
  const uploadCacheBySha = new Map();

  // Also check existing docs in DB that already have Cloudinary uploads
  const existingDocs = await Document.find({ importId: IMPORT_ID, secureUrl: { $ne: '' } }).lean();
  for (const ed of existingDocs) {
    if (ed.fileName) {
      uploadCacheBySha.set(ed.fileName, {
        asset_id: ed.cloudinaryAssetId,
        public_id: ed.cloudinaryPublicId,
        secure_url: ed.secureUrl,
        storage: ed.storageProvider,
        bytes: ed.fileSize,
        format: ed.fileExtension,
      });
    }
  }

  console.log(`Found ${uploadCacheBySha.size} documents already uploaded in DB cache.`);

  for (let i = 0; i < matchedDocs.length; i += batchSize) {
    const batch = matchedDocs.slice(i, i + batchSize);
    console.log(`\nProcessing batch [${i + 1}-${Math.min(i + batchSize, matchedDocs.length)} of ${matchedDocs.length}]...`);

    for (const item of batch) {
      const targetFolderName = CATEGORY_TO_FOLDER_NAME[item.categoryPath] || item.category;
      const targetFolderId =
        folderLookup[targetFolderName] ||
        folderLookup['DOConCD SINUMERIK - SINAMICS 09/2011 English'];

      let uploadResult = null;

      if (item.availabilityStatus === 'AVAILABLE' && item.filePath && fs.existsSync(item.filePath)) {
        // Check cache by sha256 or stem
        const cacheKey = item.sha256 || item.fileName;
        if (uploadCacheBySha.has(cacheKey)) {
          uploadResult = uploadCacheBySha.get(cacheKey);
          console.log(`  [CACHE HIT] ${item.fileName} -> using existing asset`);
        } else {
          try {
            console.log(`  [UPLOADING] ${item.fileName} (${(item.fileSize / 1024).toFixed(0)} KB) ...`);
            const buf = fs.readFileSync(item.filePath);
            uploadResult = await uploadToCloudinary(
              buf,
              item.originalFileName || `${item.fileName}.pdf`,
              'dms/DOConCD_0911'
            );
            uploadCacheBySha.set(cacheKey, uploadResult);
            uploadSuccess += 1;
            console.log(`  [UPLOADED] ${item.fileName} -> ${uploadResult.storage}: ${uploadResult.public_id}`);
          } catch (upErr) {
            uploadFailed += 1;
            console.error(`  [UPLOAD FAILED] ${item.fileName}: ${upErr.message}`);
            uploadResult = {
              asset_id: '',
              public_id: '',
              secure_url: '',
              storage: 'FAILED',
              bytes: item.fileSize || 0,
              format: 'pdf',
            };
          }
        }
      } else {
        uploadResult = {
          asset_id: '',
          public_id: '',
          secure_url: '',
          storage: 'NONE',
          bytes: 0,
          format: 'pdf',
        };
      }

      // Idempotent upsert in MongoDB
      const docData = {
        displayName: item.title,
        title: item.title,
        originalFileName: item.originalFileName || `${item.fileName}.pdf`,
        fileName: item.fileName,
        system: item.system || '',
        softwareVersion: item.softwareVersion || '',
        edition: item.edition || '',
        orderNumber: item.orderNumber || '',
        documentCode: item.fileName,
        category: item.category,
        subcategory: item.subcategory || '',
        cataloguePage: item.cataloguePage || 1,
        folderId: targetFolderId,
        storageProvider: uploadResult.storage || 'CLOUDINARY',
        cloudinaryAssetId: uploadResult.asset_id || '',
        cloudinaryPublicId: uploadResult.public_id || '',
        secureUrl: uploadResult.secure_url || '',
        fileExtension: (uploadResult.format || item.fileExtension || 'pdf').toLowerCase(),
        fileSize: uploadResult.bytes || item.fileSize || 0,
        mimeType: 'application/pdf',
        availabilityStatus: item.availabilityStatus,
        displayOrder: item.displayOrder,
        importId: IMPORT_ID,
        uploadedBy: adminId,
        isArchived: false,
      };

      await Document.findOneAndUpdate(
        { importId: IMPORT_ID, fileName: item.fileName, category: item.category },
        docData,
        { upsert: true, returnDocument: 'after' }
      );
      docsUpserted += 1;
    }

    state.lastProcessedIndex = Math.min(i + batchSize, matchedDocs.length);
    state.stats.catalogueEntriesImported = docsUpserted;
    state.stats.cloudinaryUploadsSuccessful = uploadSuccess;
    state.stats.cloudinaryUploadsFailed = uploadFailed;
    await state.save();

    // Small delay between batches
    await new Promise((r) => setTimeout(r, 300));
  }

  state.status = 'COMPLETED';
  state.completedAt = new Date();
  state.report = {
    ...dryRun,
    completedAt: state.completedAt,
    uploadsSuccessful: uploadSuccess,
    uploadsFailed: uploadFailed,
  };
  await state.save();

  console.log('\n' + '='.repeat(70));
  console.log('MIGRATION SUCCESSFULLY COMPLETED!');
  console.log(`Total catalogue entries in DB: ${docsUpserted}`);
  console.log(`Cloudinary uploads successful: ${uploadSuccess}`);
  console.log(`Cloudinary uploads failed:     ${uploadFailed}`);
  console.log('='.repeat(70));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
