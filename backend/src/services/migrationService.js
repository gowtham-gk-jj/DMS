const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Document = require('../models/Document');
const Folder = require('../models/Folder');
const MigrationState = require('../models/MigrationState');
const { uploadToCloudinary } = require('./cloudinaryService');

const IMPORT_ID = 'DOCONCD_SINUMERIK_SINAMICS_0911';

// Category to Folder Name Mapping
const CATEGORY_TO_FOLDER_NAME = {
  '840D sl/840Di sl/828D User / Operation': 'Operation',
  '840D sl/840Di sl/828D User / Programming': 'Programming',
  '840D sl/840Di sl Manufacturer/Service / Configuring': 'Configuring',
  '840D sl/840Di sl Manufacturer/Service / Commissioning': 'Commissioning',
  'Functions': 'Functions',
  '828D Manufacturer/Service / Version 4.3': 'Version 4.3',
  '828D Manufacturer/Service / Version 2.6': 'Version 2.6',
  '802D sl / User': 'User',
  '802D sl / Manufacturer/Service': 'Manufacturer / Service',
  'SINAMICS S120': 'SINAMICS S120',
  'Measuring Systems': 'Measuring Systems',
  'Synchronous motors': 'Synchronous Motors',
  'Asynchronous motors': 'Asynchronous Motors',
  'Linear/Torque Motors': 'Linear / Torque Motors',
  'Motion Control Information System': 'Motion Control Information System',
  'ePS Network Services': 'ePS Network Services',
  'SIMATIC': 'SIMATIC',
  'Info/Training': 'Info / Training',
  'Control system overview': 'Control System Overview',
};

// Global in-memory migration runner state for Pause / Resume
let isMigrationPaused = false;
let isMigrationRunning = false;

const logMigrationEvent = async (stateDoc, level, message) => {
  console.log(`[MIGRATION ${level}] ${message}`);
  stateDoc.logs.push({
    timestamp: new Date(),
    level,
    message,
  });
  if (stateDoc.logs.length > 500) {
    stateDoc.logs = stateDoc.logs.slice(-500); // keep recent 500
  }
};

/**
 * Generate comprehensive Dry-Run Report without making database changes
 */
const generateDryRunReport = async () => {
  const matchedPath = path.join(__dirname, '../../data/catalogue_matched.json');
  const inventoryPath = path.join(__dirname, '../../data/extraction_inventory.json');
  const folderLookupPath = path.join(__dirname, '../../data/folder_lookup.json');

  if (!fs.existsSync(matchedPath) || !fs.existsSync(inventoryPath)) {
    throw new Error('Pre-extracted catalogue or inventory files not found. Run extract and match scripts first.');
  }

  const matchedDocs = JSON.parse(fs.readFileSync(matchedPath, 'utf8'));
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const folderLookup = fs.existsSync(folderLookupPath)
    ? JSON.parse(fs.readFileSync(folderLookupPath, 'utf8'))
    : {};

  const categoryBreakdown = {};
  let totalMatched = 0;
  let totalMissing = 0;

  matchedDocs.forEach((doc) => {
    const cat = doc.categoryPath || 'General';
    if (!categoryBreakdown[cat]) {
      categoryBreakdown[cat] = {
        categoryPath: cat,
        folderName: CATEGORY_TO_FOLDER_NAME[cat] || cat,
        hasFolderId: Boolean(folderLookup[CATEGORY_TO_FOLDER_NAME[cat] || cat]),
        totalDocuments: 0,
        availableFiles: 0,
        missingFiles: 0,
      };
    }
    categoryBreakdown[cat].totalDocuments += 1;
    if (doc.availabilityStatus === 'AVAILABLE') {
      categoryBreakdown[cat].availableFiles += 1;
      totalMatched += 1;
    } else {
      categoryBreakdown[cat].missingFiles += 1;
      totalMissing += 1;
    }
  });

  const duplicateCount = inventory.duplicateFileCount || 0;
  const archivesFound = inventory.archivesFound || 1;
  const nestedArchives = inventory.nestedArchivesFound || 0;
  const extractedDocs = inventory.totalExtractedFiles || 0;

  // Unsupported files = files not matching main manuals or standard web formats
  const unsupportedCount = Object.entries(inventory.formatBreakdown || {}).reduce(
    (acc, [ext, count]) => {
      if (!['pdf', 'doc', 'docx', 'png', 'jpg'].includes(ext)) {
        return acc + count;
      }
      return acc;
    },
    0
  );

  return {
    success: true,
    dryRun: true,
    sourceRepository: 'https://github.com/gowtham-gk-jj/fileforDMS.git',
    catalogueFile: 'TOC_SINUMERIK_SINAMICS_0911_en(1).pdf',
    stats: {
      archivesFound: archivesFound + nestedArchives,
      topLevelArchives: archivesFound,
      nestedArchivesExtracted: nestedArchives,
      extractedDocuments: extractedDocs,
      catalogueRowsExtracted: matchedDocs.length,
      catalogueEntriesToImport: matchedDocs.length,
      actualFilesMatched: totalMatched,
      missingCatalogueDocuments: totalMissing,
      duplicateFiles: duplicateCount,
      unsupportedFiles: unsupportedCount,
      pendingManualMatches: 0,
    },
    formatBreakdown: inventory.formatBreakdown || {},
    categoryBreakdown: Object.values(categoryBreakdown),
  };
};

/**
 * Execute or Resume Migration in controlled batches
 */
const runMigration = async (options = {}) => {
  const { resume = true, batchSize = 3, maxBatches = null, adminUserId = null } = options;

  if (isMigrationRunning) {
    return { success: false, message: 'Migration is already in progress.' };
  }

  isMigrationRunning = true;
  isMigrationPaused = false;

  const matchedPath = path.join(__dirname, '../../data/catalogue_matched.json');
  const inventoryPath = path.join(__dirname, '../../data/extraction_inventory.json');
  const folderLookupPath = path.join(__dirname, '../../data/folder_lookup.json');

  const matchedDocs = JSON.parse(fs.readFileSync(matchedPath, 'utf8'));
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const folderLookup = JSON.parse(fs.readFileSync(folderLookupPath, 'utf8'));

  // Load or create MigrationState record
  let state = await MigrationState.findOne({ importId: IMPORT_ID });
  if (!state) {
    state = new MigrationState({
      importId: IMPORT_ID,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      stats: {
        archivesFound: (inventory.archivesFound || 1) + (inventory.nestedArchivesFound || 0),
        archivesExtracted: (inventory.archivesFound || 1) + (inventory.nestedArchivesFound || 0),
        extractedDocuments: inventory.totalExtractedFiles || 0,
        catalogueRowsExtracted: matchedDocs.length,
        catalogueEntriesImported: 0,
        actualFilesMatched: matchedDocs.filter((d) => d.availabilityStatus === 'AVAILABLE').length,
        missingCatalogueDocuments: matchedDocs.filter((d) => d.availabilityStatus !== 'AVAILABLE').length,
        duplicateFiles: inventory.duplicateFileCount || 0,
        unsupportedFiles: Object.entries(inventory.formatBreakdown || {}).reduce((acc, [ext, count]) => {
          return !['pdf', 'doc', 'docx', 'png', 'jpg'].includes(ext) ? acc + count : acc;
        }, 0),
        pendingManualMatches: 0,
      },
    });
  } else {
    state.status = 'IN_PROGRESS';
    if (!resume) {
      state.lastProcessedIndex = 0;
    }
  }

  await logMigrationEvent(
    state,
    'INFO',
    `Migration execution initiated. Total items: ${matchedDocs.length}, starting from index: ${state.lastProcessedIndex}`
  );
  await state.save();

  // Run in background / controlled loop
  (async () => {
    try {
      const startIndex = state.lastProcessedIndex || 0;
      let uploadSuccessCount = state.stats.cloudinaryUploadsSuccessful || 0;
      let uploadFailedCount = state.stats.cloudinaryUploadsFailed || 0;
      let importedEntriesCount = state.stats.catalogueEntriesImported || 0;

      for (let i = startIndex; i < matchedDocs.length; i += batchSize) {
        if (isMigrationPaused) {
          state.status = 'PAUSED';
          await logMigrationEvent(state, 'WARN', `Migration paused by administrator at index ${i}`);
          await state.save();
          isMigrationRunning = false;
          return;
        }

        const batch = matchedDocs.slice(i, i + batchSize);
        await logMigrationEvent(
          state,
          'INFO',
          `Processing batch ${Math.floor(i / batchSize) + 1}: items ${i + 1} to ${Math.min(i + batchSize, matchedDocs.length)}`
        );

        for (const item of batch) {
          try {
            // Find target folder ID
            const targetFolderName = CATEGORY_TO_FOLDER_NAME[item.categoryPath] || item.category;
            const targetFolderId =
              folderLookup[targetFolderName] ||
              folderLookup['DOConCD SINUMERIK - SINAMICS 09/2011 English'];

            if (!targetFolderId) {
              await logMigrationEvent(
                state,
                'WARN',
                `Target folder not found for category: ${item.categoryPath}. Using root folder.`
              );
            }

            // Check if document already exists for this importId and fileName in database
            let existingDoc = await Document.findOne({
              importId: IMPORT_ID,
              fileName: item.fileName,
              category: item.category,
            });

            let uploadResult = null;

            if (item.availabilityStatus === 'AVAILABLE' && item.filePath && fs.existsSync(item.filePath)) {
              // Only upload if existingDoc doesn't already have a valid secureUrl
              if (existingDoc && existingDoc.secureUrl) {
                uploadResult = {
                  asset_id: existingDoc.cloudinaryAssetId,
                  public_id: existingDoc.cloudinaryPublicId,
                  secure_url: existingDoc.secureUrl,
                  storage: existingDoc.storageProvider,
                  format: existingDoc.fileExtension,
                  bytes: existingDoc.fileSize,
                };
              } else {
                const fileBuf = fs.readFileSync(item.filePath);
                uploadResult = await uploadToCloudinary(
                  fileBuf,
                  item.originalFileName || `${item.fileName}.pdf`,
                  'dms/DOConCD_0911'
                );
                uploadSuccessCount += 1;
              }
            } else {
              // Missing file entry
              uploadResult = {
                asset_id: '',
                public_id: '',
                secure_url: '',
                storage: 'NONE',
                format: 'pdf',
                bytes: 0,
              };
            }

            // Create or update Mongoose Document record
            const docPayload = {
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
              uploadedBy: adminUserId || null,
              isArchived: false,
            };

            if (existingDoc) {
              Object.assign(existingDoc, docPayload);
              await existingDoc.save();
            } else {
              await Document.create(docPayload);
              importedEntriesCount += 1;
            }
          } catch (itemErr) {
            uploadFailedCount += 1;
            await logMigrationEvent(
              state,
              'ERROR',
              `Failed processing item ${item.fileName} (${item.title}): ${itemErr.message}`
            );
          }
        }

        // Update progress in state
        state.lastProcessedIndex = Math.min(i + batchSize, matchedDocs.length);
        state.stats.cloudinaryUploadsSuccessful = uploadSuccessCount;
        state.stats.cloudinaryUploadsFailed = uploadFailedCount;
        state.stats.catalogueEntriesImported = importedEntriesCount;
        await state.save();

        if (maxBatches && Math.floor(i / batchSize) + 1 >= maxBatches) {
          await logMigrationEvent(state, 'INFO', `Reached max batches limit (${maxBatches}). Pausing.`);
          break;
        }

        // Slight backoff between batches to prevent Cloudinary rate spikes
        await new Promise((r) => setTimeout(r, 400));
      }

      // Check completion
      if (state.lastProcessedIndex >= matchedDocs.length) {
        state.status = 'COMPLETED';
        state.completedAt = new Date();
        await logMigrationEvent(
          state,
          'SUCCESS',
          `DOConCD Migration 100% completed successfully! Total imported catalogue entries: ${state.stats.catalogueEntriesImported}`
        );

        // Build final comprehensive report
        const finalReport = await generateDryRunReport();
        state.report = {
          ...finalReport,
          completedAt: state.completedAt,
          uploadsSuccessful: uploadSuccessCount,
          uploadsFailed: uploadFailedCount,
        };
        await state.save();
      }
    } catch (loopErr) {
      state.status = 'FAILED';
      await logMigrationEvent(state, 'ERROR', `Migration aborted with error: ${loopErr.message}`);
      await state.save();
    } finally {
      isMigrationRunning = false;
    }
  })();

  return {
    success: true,
    message: 'Migration execution started.',
    state: {
      status: state.status,
      lastProcessedIndex: state.lastProcessedIndex,
      total: matchedDocs.length,
    },
  };
};

const pauseMigration = async () => {
  if (!isMigrationRunning) {
    return { success: false, message: 'No active migration to pause.' };
  }
  isMigrationPaused = true;
  return { success: true, message: 'Migration pause requested.' };
};

const resumeMigration = async (options = {}) => {
  return runMigration({ ...options, resume: true });
};

const getMigrationStatus = async () => {
  const state = await MigrationState.findOne({ importId: IMPORT_ID });
  if (!state) {
    const dryRun = await generateDryRunReport();
    return {
      status: 'IDLE',
      importId: IMPORT_ID,
      stats: dryRun.stats,
      logs: [],
      categoryBreakdown: dryRun.categoryBreakdown,
      lastProcessedIndex: 0,
      totalEntries: dryRun.stats.catalogueEntriesToImport,
    };
  }
  return {
    status: state.status,
    importId: state.importId,
    stats: state.stats,
    logs: state.logs.slice(-50), // last 50
    categoryBreakdown: state.categoryBreakdown,
    lastProcessedIndex: state.lastProcessedIndex,
    totalEntries: state.stats.catalogueRowsExtracted,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    report: state.report,
  };
};

module.exports = {
  IMPORT_ID,
  CATEGORY_TO_FOLDER_NAME,
  generateDryRunReport,
  runMigration,
  pauseMigration,
  resumeMigration,
  getMigrationStatus,
};
