const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      required: true,
      index: true,
    },
    read: {
      type: Boolean,
      default: true,
    },
    upload: {
      type: Boolean,
      default: false,
    },
    download: {
      type: Boolean,
      default: false,
    },
    manage: {
      type: Boolean,
      default: false,
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

permissionSchema.index({ userId: 1, folderId: 1 }, { unique: true });

module.exports = mongoose.model('Permission', permissionSchema);
