const mongoose = require('mongoose');

const migrationStateSchema = new mongoose.Schema(
  {
    importId: {
      type: String,
      required: true,
      unique: true,
      default: 'DOCONCD_SINUMERIK_SINAMICS_0911',
    },
    status: {
      type: String,
      enum: ['IDLE', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'FAILED'],
      default: 'IDLE',
    },
    sourceRepository: {
      type: String,
      default: 'https://github.com/gowtham-gk-jj/fileforDMS.git',
    },
    catalogueFile: {
      type: String,
      default: 'TOC_SINUMERIK_SINAMICS_0911_en(1).pdf',
    },
    stats: {
      archivesFound: { type: Number, default: 0 },
      archivesExtracted: { type: Number, default: 0 },
      extractedDocuments: { type: Number, default: 0 },
      catalogueRowsExtracted: { type: Number, default: 0 },
      catalogueEntriesImported: { type: Number, default: 0 },
      actualFilesMatched: { type: Number, default: 0 },
      cloudinaryUploadsSuccessful: { type: Number, default: 0 },
      cloudinaryUploadsFailed: { type: Number, default: 0 },
      missingCatalogueDocuments: { type: Number, default: 0 },
      duplicateFiles: { type: Number, default: 0 },
      unsupportedFiles: { type: Number, default: 0 },
      pendingManualMatches: { type: Number, default: 0 },
    },
    categoryBreakdown: [
      {
        categoryPath: String,
        totalDocuments: Number,
        availableFiles: Number,
        missingFiles: Number,
      },
    ],
    logs: [
      {
        timestamp: { type: Date, default: Date.now },
        level: { type: String, enum: ['INFO', 'WARN', 'ERROR', 'SUCCESS'], default: 'INFO' },
        message: String,
      },
    ],
    lastProcessedIndex: {
      type: Number,
      default: 0,
    },
    startedAt: Date,
    completedAt: Date,
    report: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('MigrationState', migrationStateSchema);
