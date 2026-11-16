const mongoose = require('mongoose');

const migrationAssetSchema = new mongoose.Schema(
  {
    sha256: {
      type: String,
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    originalPath: {
      type: String,
      default: '',
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      index: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    mimeType: {
      type: String,
      default: 'application/octet-stream',
    },
    storageProvider: {
      type: String,
      default: 'CLOUDINARY',
    },
    secureUrl: {
      type: String,
      default: '',
    },
    cloudinaryPublicId: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('MigrationAsset', migrationAssetSchema);
