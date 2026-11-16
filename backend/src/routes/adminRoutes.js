const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  getUsers,
  updateUser,
  inviteOrCreateUser,
  getUserFolderPermissions,
  setUserFolderPermission,
  getEmailLogs,
  getMigrationStatusHandler,
  getMigrationDryRunHandler,
  startMigrationHandler,
  pauseMigrationHandler,
  resumeMigrationHandler,
  retryFailedUploadsHandler,
  exportMigrationReportHandler,
  getGitHubSyncStatusHandler,
  checkGitHubRepositoryHandler,
  getDetectedFilesHandler,
  createMigrationJobHandler,
  createBulkMigrationJobHandler,
  getMigrationJobsHandler,
  getMigrationJobHandler,
  cancelMigrationJobHandler,
  retryMigrationJobHandler,
  resumeMigrationJobHandler,
  exportJobReportHandler,
} = require('../controllers/adminController');
const { protect, requireAdmin } = require('../middleware/auth');

// All routes here require ADMIN authentication
router.use(protect, requireAdmin);

router.get('/stats', getDashboardStats);
router.get('/requests', getAccessRequests);
router.post('/requests/:id/approve', approveAccessRequest);
router.post('/requests/:id/reject', rejectAccessRequest);
router.get('/users', getUsers);
router.post('/users/invite', inviteOrCreateUser);
router.put('/users/:id', updateUser);
router.get('/users/:id/permissions', getUserFolderPermissions);
router.post('/users/:id/permissions', setUserFolderPermission);
router.get('/email-logs', getEmailLogs);

// Migration Management routes
router.get('/migration/status', getMigrationStatusHandler);
router.get('/migration/dry-run', getMigrationDryRunHandler);
router.post('/migration/start', startMigrationHandler);
router.post('/migration/pause', pauseMigrationHandler);
router.post('/migration/resume', resumeMigrationHandler);
router.post('/migration/retry', retryFailedUploadsHandler);
router.get('/migration/report', exportMigrationReportHandler);

// GitHub Repository Monitoring & One-Click ZIP Migration routes
router.get('/migration/github/status', getGitHubSyncStatusHandler);
router.get('/migration/github/check', checkGitHubRepositoryHandler);
router.post('/migration/github/check', checkGitHubRepositoryHandler);
router.get('/migration/github/files', getDetectedFilesHandler);
router.post('/migration/github/import', createMigrationJobHandler);
router.post('/migration/github/import-all', createBulkMigrationJobHandler);
router.get('/migration/jobs', getMigrationJobsHandler);
router.get('/migration/jobs/:jobId', getMigrationJobHandler);
router.post('/migration/jobs/:jobId/cancel', cancelMigrationJobHandler);
router.post('/migration/jobs/:jobId/retry', retryMigrationJobHandler);
router.post('/migration/jobs/:jobId/resume', resumeMigrationJobHandler);
router.get('/migration/history', getMigrationJobsHandler);
router.get('/migration/history/:jobId/report', exportJobReportHandler);

module.exports = router;
