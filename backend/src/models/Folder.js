const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    parentFolderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
      index: true,
    },
    path: {
      type: String,
      default: '/',
    },
    level: {
      type: Number,
      default: 0,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for subfolders count
folderSchema.virtual('subfoldersCount', {
  ref: 'Folder',
  localField: '_id',
  foreignField: 'parentFolderId',
  count: true,
  match: { isArchived: false }
});

// Virtual for documents count
folderSchema.virtual('documentsCount', {
  ref: 'Document',
  localField: '_id',
  foreignField: 'folderId',
  count: true,
  match: { isArchived: false },
});

// High-performance indexes for tree traversal and name sorting
folderSchema.index({ parentFolderId: 1, isArchived: 1 });
folderSchema.index({ isArchived: 1, name: 1 });
folderSchema.index({ path: 1 });

module.exports = mongoose.model('Folder', folderSchema);
