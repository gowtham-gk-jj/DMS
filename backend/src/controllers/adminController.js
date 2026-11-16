const User = require('../models/User');
const AccessRequest = require('../models/AccessRequest');
const Folder = require('../models/Folder');
const Document = require('../models/Document');
const Permission = require('../models/Permission');
const EmailLog = require('../models/EmailLog');
const { USER_ROLES, USER_STATUS, REQUEST_STATUS, ADMIN_EMAILS } = require('../config/constants');
const { notifyUserApproved, notifyUserRejected, notifyPermissionsUpdated } = require('../services/emailService');
const { logAudit } = require('../services/auditService');
const { escapeRegex } = require('../utils/escapeRegex');

// Get high-level admin dashboard statistics
const getDashboardStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      pendingRequests,
      approvedUsers,
      suspendedUsers,
      totalFolders,
      totalDocuments,
      documentSizeAgg,
      recentRequests,
      recentUsers,
    ] = await Promise.all([
      User.countDocuments(),
      AccessRequest.countDocuments({ status: REQUEST_STATUS.PENDING }),
      User.countDocuments({ status: USER_STATUS.APPROVED }),
      User.countDocuments({ status: USER_STATUS.SUSPENDED }),
      Folder.countDocuments({ isArchived: false }),
      Document.countDocuments({ isArchived: false }),
      Document.aggregate([
        { $match: { isArchived: false } },
        { $group: { _id: null, totalBytes: { $sum: '$fileSize' } } },
      ]),
      AccessRequest.find().sort({ createdAt: -1 }).limit(5),
      User.find().sort({ createdAt: -1 }).limit(5).select('-googleId'),
    ]);

    const totalStorageBytes = documentSizeAgg.length > 0 ? documentSizeAgg[0].totalBytes : 0;

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        pendingRequests,
        approvedUsers,
        suspendedUsers,
        totalFolders,
        totalDocuments,
        totalStorageBytes,
        storageFormatted: (totalStorageBytes / (1024 * 1024)).toFixed(2) + ' MB',
      },
      recentRequests,
      recentUsers,
    });
  } catch (err) {
    next(err);
  }
};

// Get all access requests with search, filter, pagination
const getAccessRequests = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (search) {
      const safeSearch = escapeRegex(search.trim());
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
        { organization: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [requests, total] = await Promise.all([
      AccessRequest.find(query)
        .populate('userId', 'name email profileImage status role')
        .populate('reviewedBy', 'name email')
        .populate('assignedFolders', 'name path')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      AccessRequest.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      requests,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    next(err);
  }
};

// Approve access request
const approveAccessRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      permissions = { read: true, upload: false, download: false, manage: false },
      folderIds = [],
      role = USER_ROLES.USER,
    } = req.body;

    const request = await AccessRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Access request not found' });
    }

    const user = await User.findById(request.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update request
    request.status = REQUEST_STATUS.APPROVED;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.grantedPermissions = permissions;
    request.assignedFolders = folderIds;
    request.rejectionReason = '';
    await request.save();

    // Update user
    user.status = USER_STATUS.APPROVED;
    user.role = role || user.role;
    user.permissions = permissions;
    user.rejectionReason = '';
    await user.save();

    // Create or update folder permissions
    if (folderIds && folderIds.length > 0) {
      for (const folderId of folderIds) {
        await Permission.findOneAndUpdate(
          { userId: user._id, folderId },
          {
            read: permissions.read,
            upload: permissions.upload,
            download: permissions.download,
            manage: permissions.manage,
            grantedBy: req.user._id,
          },
          { upsert: true, new: true }
        );
      }
    }

    // Send email notification
    notifyUserApproved(user, permissions, folderIds).catch((err) =>
      console.error('[Notification Error]', err.message)
    );

    // Audit log
    await logAudit({
      action: 'ADMIN_APPROVE_USER',
      user: req.user,
      targetType: 'USER',
      targetId: user._id,
      targetName: `${user.name} (${user.email})`,
      details: { permissions, folderIds, role },
      req,
    });

    return res.status(200).json({
      success: true,
      message: `User ${user.email} approved successfully with assigned permissions.`,
      request,
      user,
    });
  } catch (err) {
    next(err);
  }
};

// Reject access request
const rejectAccessRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejectionReason = '' } = req.body;

    const request = await AccessRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Access request not found' });
    }

    const user = await User.findById(request.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update request
    request.status = REQUEST_STATUS.REJECTED;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.rejectionReason = rejectionReason;
    await request.save();

    // Update user
    user.status = USER_STATUS.REJECTED;
    user.rejectionReason = rejectionReason;
    await user.save();

    // Send email notification
    notifyUserRejected(user, rejectionReason).catch((err) =>
      console.error('[Notification Error]', err.message)
    );

    // Audit log
    await logAudit({
      action: 'ADMIN_REJECT_USER',
      user: req.user,
      targetType: 'USER',
      targetId: user._id,
      targetName: `${user.name} (${user.email})`,
      details: { rejectionReason },
      req,
    });

    return res.status(200).json({
      success: true,
      message: `User ${user.email} access request rejected.`,
      request,
    });
  } catch (err) {
    next(err);
  }
};

// Get all users
const getUsers = async (req, res, next) => {
  try {
    const { status, role, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (role && role !== 'ALL') {
      query.role = role;
    }

    if (search) {
      const safeSearch = escapeRegex(search.trim());
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
        { organization: { $regex: safeSearch, $options: 'i' } },
        { department: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      User.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      users,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    next(err);
  }
};

// Update user role, status or permissions directly
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, status, permissions, rejectionReason } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prevent demoting or deactivating master administrator accounts
    const isMasterAdmin = ADMIN_EMAILS.some(
      (masterEmail) => masterEmail.toLowerCase() === user.email.toLowerCase()
    ) || (process.env.ADMIN_EMAIL && user.email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase());

    if (isMasterAdmin && role && role !== USER_ROLES.ADMIN) {
      return res.status(400).json({
        success: false,
        message: 'Cannot demote primary root administrator account.',
      });
    }

    if (isMasterAdmin && status && status !== USER_STATUS.APPROVED) {
      return res.status(400).json({
        success: false,
        message: 'Cannot suspend or deactivate primary root administrator account.',
      });
    }

    const previousStatus = user.status;
    if (role) user.role = role;
    if (status) user.status = status;
    if (rejectionReason !== undefined) user.rejectionReason = rejectionReason;
    if (permissions) {
      user.permissions = {
        read: Boolean(permissions.read),
        upload: Boolean(permissions.upload),
        download: Boolean(permissions.download),
        manage: Boolean(permissions.manage),
      };
      notifyPermissionsUpdated(user, user.permissions).catch((err) =>
        console.error('[Notification Error]', err.message)
      );
    }

    await user.save();

    // If user was approved or rejected directly, synchronize any pending access requests
    if (status === USER_STATUS.APPROVED || status === USER_STATUS.REJECTED) {
      await AccessRequest.updateMany(
        { userId: user._id, status: REQUEST_STATUS.PENDING },
        {
          status: status === USER_STATUS.APPROVED ? REQUEST_STATUS.APPROVED : REQUEST_STATUS.REJECTED,
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
          rejectionReason: rejectionReason || user.rejectionReason,
        }
      );
      if (status === USER_STATUS.APPROVED && previousStatus !== USER_STATUS.APPROVED) {
        notifyUserApproved(user).catch((err) =>
          console.error('[Notification Error] User approved email failed:', err.message)
        );
      } else if (status === USER_STATUS.REJECTED && previousStatus !== USER_STATUS.REJECTED) {
        notifyUserRejected(user, rejectionReason || 'Access request was not approved.').catch((err) =>
          console.error('[Notification Error] User rejected email failed:', err.message)
        );
      }
    }

    await logAudit({
      action: 'ADMIN_UPDATE_USER',
      user: req.user,
      targetType: 'USER',
      targetId: user._id,
      targetName: `${user.name} (${user.email})`,
      details: { role, status, permissions },
      req,
    });

    return res.status(200).json({
      success: true,
      message: `User ${user.email} updated successfully.`,
      user,
    });
  } catch (err) {
    next(err);
  }
};

// Admin invites or provisions a user account
const inviteOrCreateUser = async (req, res, next) => {
  try {
    const { name, email, role, status, permissions, organization, department, password } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    let existingUser = await User.findOne({ email: cleanEmail });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user account with this email address already exists.',
      });
    }

    const crypto = require('crypto');
    const { notifyUserInvitation } = require('../services/emailService');

    const newUser = new User({
      name: name || cleanEmail.split('@')[0],
      email: cleanEmail,
      role: role || USER_ROLES.USER,
      status: status || USER_STATUS.APPROVED,
      permissions: {
        read: Boolean(permissions?.read ?? true),
        upload: Boolean(permissions?.upload ?? false),
        download: Boolean(permissions?.download ?? false),
        manage: Boolean(permissions?.manage ?? false),
      },
      organization: organization || 'Enterprise Partner',
      department: department || 'Engineering',
    });

    let setupUrl = '';
    if (password && password.length >= 8) {
      newUser.password = password; // Pre-save hook hashes password
    } else {
      // Generate secure single-use activation/setup token
      const inviteToken = crypto.randomBytes(32).toString('hex');
      newUser.resetPasswordToken = crypto.createHash('sha256').update(inviteToken).digest('hex');
      newUser.resetPasswordExpires = Date.now() + 86400000 * 3; // 3 days
      setupUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password/${inviteToken}`;
    }

    await newUser.save();

    if (setupUrl) {
      notifyUserInvitation(newUser, setupUrl).catch((err) =>
        console.error('[Invitation Email Error]', err.message)
      );
    }

    await logAudit({
      action: 'ADMIN_INVITE_USER',
      user: req.user,
      targetType: 'USER',
      targetId: newUser._id,
      targetName: `${newUser.name} (${newUser.email})`,
      details: { role: newUser.role, status: newUser.status, hasDirectPassword: Boolean(password) },
      req,
    });

    return res.status(201).json({
      success: true,
      message: `User account for ${newUser.email} provisioned successfully.`,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        permissions: newUser.permissions,
      },
      setupUrl: setupUrl || undefined,
    });
  } catch (err) {
    next(err);
  }
};

// Manage folder permissions for a specific user
const getUserFolderPermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const permissions = await Permission.find({ userId: id }).populate('folderId', 'name path');
    return res.status(200).json({ success: true, permissions });
  } catch (err) {
    next(err);
  }
};

const setUserFolderPermission = async (req, res, next) => {
  try {
    const { id: userId } = req.params;
    const { folderId, read, upload, download, manage } = req.body;

    if (!folderId) {
      return res.status(400).json({ success: false, message: 'folderId is required' });
    }

    const permission = await Permission.findOneAndUpdate(
      { userId, folderId },
      {
        read: Boolean(read),
        upload: Boolean(upload),
        download: Boolean(download),
        manage: Boolean(manage),
        grantedBy: req.user._id,
      },
      { upsert: true, new: true }
    );

    await logAudit({
      action: 'ADMIN_SET_FOLDER_PERMISSION',
      user: req.user,
      targetType: 'PERMISSION',
      targetId: permission._id,
      targetName: `FolderPerm: ${folderId}`,
      details: { userId, folderId, read, upload, download, manage },
      req,
    });

    return res.status(200).json({ success: true, permission });
  } catch (err) {
    next(err);
  }
};

// View sent email logs
const getEmailLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      EmailLog.find().sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      EmailLog.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      logs,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    next(err);
  }
};

// DOConCD Migration Management Endpoints
const migrationService = require('../services/migrationService');

const getMigrationStatusHandler = async (req, res, next) => {
  try {
    const status = await migrationService.getMigrationStatus();
    return res.status(200).json({ success: true, ...status });
  } catch (err) {
    next(err);
  }
};

const getMigrationDryRunHandler = async (req, res, next) => {
  try {
    const report = await migrationService.generateDryRunReport();
    return res.status(200).json({ success: true, ...report });
  } catch (err) {
    next(err);
  }
};

const startMigrationHandler = async (req, res, next) => {
  try {
    const { batchSize = 3, resume = false } = req.body;
    const result = await migrationService.runMigration({
      batchSize: Number(batchSize) || 3,
      resume: Boolean(resume),
      adminUserId: req.user._id,
    });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const pauseMigrationHandler = async (req, res, next) => {
  try {
    const result = await migrationService.pauseMigration();
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const resumeMigrationHandler = async (req, res, next) => {
  try {
    const { batchSize = 3 } = req.body;
    const result = await migrationService.resumeMigration({
      batchSize: Number(batchSize) || 3,
      adminUserId: req.user._id,
    });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const retryFailedUploadsHandler = async (req, res, next) => {
  try {
    const result = await migrationService.resumeMigration({
      batchSize: 3,
      adminUserId: req.user._id,
    });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const exportMigrationReportHandler = async (req, res, next) => {
  try {
    const status = await migrationService.getMigrationStatus();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="DOConCD_Migration_Report.json"');
    return res.status(200).send(JSON.stringify(status, null, 2));
  } catch (err) {
    next(err);
  }
};

// ==========================================
// GITHUB REPOSITORY & ONE-CLICK MIGRATION HANDLERS
// ==========================================
const githubMigrationService = require('../services/githubMigrationService');

const getGitHubSyncStatusHandler = async (req, res, next) => {
  try {
    const result = await githubMigrationService.getGitHubSyncStatus();
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const checkGitHubRepositoryHandler = async (req, res, next) => {
  try {
    const result = await githubMigrationService.checkGitHubRepository(req.body || {});
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const getDetectedFilesHandler = async (req, res, next) => {
  try {
    const result = await githubMigrationService.getDetectedFiles(req.query);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const createMigrationJobHandler = async (req, res, next) => {
  try {
    const { fileId } = req.body;
    if (!fileId) {
      return res.status(400).json({ success: false, message: 'fileId is required to start migration.' });
    }
    const result = await githubMigrationService.createMigrationJob(fileId, req.user?._id);
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

const createBulkMigrationJobHandler = async (req, res, next) => {
  try {
    const { fileIds } = req.body;
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ success: false, message: 'fileIds array is required.' });
    }
    const result = await githubMigrationService.createBulkMigrationJob(fileIds, req.user?._id);
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

const getMigrationJobsHandler = async (req, res, next) => {
  try {
    const result = await githubMigrationService.getMigrationJobs(req.query);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const getMigrationJobHandler = async (req, res, next) => {
  try {
    const job = await githubMigrationService.getMigrationJob(req.params.jobId);
    return res.status(200).json({ success: true, job });
  } catch (err) {
    next(err);
  }
};

const cancelMigrationJobHandler = async (req, res, next) => {
  try {
    const result = await githubMigrationService.cancelMigrationJob(req.params.jobId);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const retryMigrationJobHandler = async (req, res, next) => {
  try {
    const result = await githubMigrationService.retryMigrationJob(req.params.jobId, req.user?._id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const resumeMigrationJobHandler = async (req, res, next) => {
  try {
    const result = await githubMigrationService.resumeMigrationJob(req.params.jobId, req.user?._id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const exportJobReportHandler = async (req, res, next) => {
  try {
    const report = await githubMigrationService.exportJobReport(req.params.jobId);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Migration_Report_${req.params.jobId}.json"`
    );
    return res.status(200).send(JSON.stringify(report, null, 2));
  } catch (err) {
    next(err);
  }
};

module.exports = {
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
};
