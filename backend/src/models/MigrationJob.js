const mongoose = require('mongoose');

const migrationJobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    jobType: {
      type: String,
      enum: ['SINGLE_ZIP', 'BULK_IMPORT', 'MANUAL_IMPORT'],
      default: 'SINGLE_ZIP',
    },
    sourceFile: {
      type: String,
      default: '',
    },
    repoPath: {
      type: String,
      default: '',
    },
    detectedFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DetectedRepositoryFile',
    },
    commitSha: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: [
        'QUEUED',
        'DOWNLOADING',
        'VERIFYING',
        'EXTRACTING',
        'SCANNING',
        'MATCHING',
        'UPLOADING',
        'PAUSED',
        'COMPLETED',
        'COMPLETED_WITH_WARNINGS',
        'FAILED',
        'CANCELLED',
      ],
      default: 'QUEUED',
      index: true,
    },
    progressPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    currentStage: {
      type: String,
      default: 'Job Queued',
    },
    downloadedBytes: {
      type: Number,
      default: 0,
    },
    totalBytes: {
      type: Number,
      default: 0,
    },
    extractionProgress: {
      type: Number,
      default: 0,
    },
    lastProcessedFile: {
      type: String,
      default: '',
    },
    errorMessage: {
      type: String,
      default: '',
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    archiveSha256: {
      type: String,
      default: '',
    },
    isResumable: {
      type: Boolean,
      default: true,
    },
    processedFileHashes: [
      {
        type: String,
      },
    ],
    checkpoint: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    stats: {
      discoveredCount: { type: Number, default: 0 },
      extractedCount: { type: Number, default: 0 },
      matchedCount: { type: Number, default: 0 },
      uploadedCount: { type: Number, default: 0 },
      duplicateCount: { type: Number, default: 0 },
      unsupportedCount: { type: Number, default: 0 },
      failedCount: { type: Number, default: 0 },
    },
    errorLog: [
      {
        timestamp: { type: Date, default: Date.now },
        message: { type: String, default: '' },
        filePath: { type: String, default: '' },
      },
    ],
    logs: [
      {
        timestamp: { type: Date, default: Date.now },
        level: {
          type: String,
          enum: ['INFO', 'WARN', 'ERROR', 'SUCCESS'],
          default: 'INFO',
        },
        message: { type: String, default: '' },
      },
    ],
    report: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('MigrationJob', migrationJobSchema);
