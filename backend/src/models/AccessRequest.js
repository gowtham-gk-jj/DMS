const mongoose = require('mongoose');
const { REQUEST_STATUS } = require('../config/constants');

const accessRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    organization: {
      type: String,
      default: 'Google Authenticated User',
      trim: true,
    },
    department: {
      type: String,
      default: 'Engineering',
      trim: true,
    },
    reason: {
      type: String,
      default: 'Automatic initial access request upon Google OAuth authentication',
      trim: true,
    },
    purpose: {
      type: String,
      default: 'Document Access & Technical Review',
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(REQUEST_STATUS),
      default: REQUEST_STATUS.PENDING,
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    grantedPermissions: {
      read: { type: Boolean, default: true },
      upload: { type: Boolean, default: false },
      download: { type: Boolean, default: false },
      manage: { type: Boolean, default: false },
    },
    assignedFolders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AccessRequest', accessRequestSchema);
