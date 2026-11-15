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

module.exports = router;
