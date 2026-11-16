const mongoose = require('mongoose');

const gitHubSyncStateSchema = new mongoose.Schema(
  {
    repoOwner: {
      type: String,
      default: 'gowtham-gk-jj',
      trim: true,
    },
    repoName: {
      type: String,
      default: 'fileforDMS',
      trim: true,
    },
    branch: {
      type: String,
      default: 'main',
      trim: true,
    },
    lastCommitSha: {
      type: String,
      default: '',
    },
    lastCommitMessage: {
      type: String,
      default: '',
    },
    lastCommitDate: {
      type: Date,
    },
    lastCheckedAt: {
      type: Date,
      default: Date.now,
    },
    syncStatus: {
      type: String,
      enum: ['IDLE', 'SYNCING', 'SUCCESS', 'ERROR'],
      default: 'IDLE',
    },
    syncError: {
      type: String,
      default: '',
    },
    totalDetectedFiles: {
      type: Number,
      default: 0,
    },
    pendingZipCount: {
      type: Number,
      default: 0,
    },
    pendingDocCount: {
      type: Number,
      default: 0,
    },
    importedCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('GitHubSyncState', gitHubSyncStateSchema);
