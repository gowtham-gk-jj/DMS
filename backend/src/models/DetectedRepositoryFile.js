const mongoose = require('mongoose');

const detectedRepositoryFileSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    repoPath: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    fileExtension: {
      type: String,
      lowercase: true,
      trim: true,
      default: '',
      index: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    gitBlobSha: {
      type: String,
      default: '',
    },
    commitSha: {
      type: String,
      default: '',
      index: true,
    },
    lastCommitDate: {
      type: Date,
    },
    isLfs: {
      type: Boolean,
      default: false,
    },
    lfsOid: {
      type: String,
      default: '',
    },
    lfsSize: {
      type: Number,
      default: 0,
    },
    fileTypeCategory: {
      type: String,
      enum: ['ZIP', 'PDF', 'DOCUMENT', 'IMAGE', 'SPREADSHEET', 'CAD', 'OTHER'],
      default: 'OTHER',
      index: true,
    },
    importStatus: {
      type: String,
      enum: ['NEW', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'NEW',
      index: true,
    },
    detectedDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastImportAttempt: {
      type: Date,
    },
    lastError: {
      type: String,
      default: '',
    },
    associatedJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MigrationJob',
    },
    importedDocumentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Helper method to determine category from extension
detectedRepositoryFileSchema.statics.classifyExtension = function (ext) {
  const cleanExt = (ext || '').toLowerCase().replace(/^\./, '');
  if (['zip', 'tar', 'gz', '7z', 'rar'].includes(cleanExt)) return 'ZIP';
  if (cleanExt === 'pdf') return 'PDF';
  if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(cleanExt)) return 'DOCUMENT';
  if (['xls', 'xlsx', 'csv'].includes(cleanExt)) return 'SPREADSHEET';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(cleanExt)) return 'IMAGE';
  if (['dxf', 'step', 'stp', 'igs', 'iges', 'dwg'].includes(cleanExt)) return 'CAD';
  return 'OTHER';
};

module.exports = mongoose.model('DetectedRepositoryFile', detectedRepositoryFileSchema);
