const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    originalFileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileName: {
      type: String,
      trim: true,
      default: '',
    },
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      required: true,
      index: true,
    },
    cloudinaryAssetId: {
      type: String,
      default: '',
    },
    cloudinaryPublicId: {
      type: String,
      trim: true,
      default: '',
    },
    secureUrl: {
      type: String,
      default: '',
    },
    storageProvider: {
      type: String,
      default: 'CLOUDINARY',
      trim: true,
    },
    availabilityStatus: {
      type: String,
      enum: ['AVAILABLE', 'FILE_NOT_FOUND', 'PENDING_REVIEW'],
      default: 'AVAILABLE',
      index: true,
    },
    displayOrder: {
      type: Number,
      default: 1,
      index: true,
    },
    cataloguePage: {
      type: Number,
      default: 1,
      index: true,
    },
    subcategory: {
      type: String,
      default: '',
      trim: true,
    },
    importId: {
      type: String,
      default: 'DOCONCD_SINUMERIK_SINAMICS_0911',
      index: true,
    },
    mimeType: {
      type: String,
      default: 'application/pdf',
    },
    fileExtension: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
    },
    fileSize: {
      type: Number,
      required: true,
      default: 0,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    system: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    softwareVersion: {
      type: String,
      trim: true,
      default: '',
    },
    edition: {
      type: String,
      trim: true,
      default: '',
    },
    orderNumber: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    documentCode: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      default: 'General',
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    version: {
      type: Number,
      default: 1,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// High-performance compound indexes for folder queries, availability filtering, and sorting
documentSchema.index({ folderId: 1, isArchived: 1 });
documentSchema.index({ folderId: 1, fileName: 1 });
documentSchema.index({ availabilityStatus: 1, isArchived: 1 });
documentSchema.index({ fileName: 1 });
documentSchema.index({ isArchived: 1, createdAt: -1 });

// Compound text index for global search
documentSchema.index({
  title: 'text',
  system: 'text',
  orderNumber: 'text',
  documentCode: 'text',
  originalFileName: 'text',
  displayName: 'text',
  fileName: 'text',
  category: 'text',
  description: 'text',
  tags: 'text',
});

module.exports = mongoose.model('Document', documentSchema);
