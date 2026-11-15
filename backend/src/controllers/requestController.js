const AccessRequest = require('../models/AccessRequest');
const User = require('../models/User');
const { USER_STATUS, REQUEST_STATUS } = require('../config/constants');
const { notifyAdminNewRequest } = require('../services/emailService');
const { logAudit } = require('../services/auditService');

// Submit an access request
const submitAccessRequest = async (req, res, next) => {
  try {
    const { organization, department, reason, purpose } = req.body;

    if (!organization || !reason || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Organization, reason, and purpose are required.',
      });
    }

    const userId = req.user._id;

    // Check if an existing pending request is already waiting
    let existingRequest = await AccessRequest.findOne({
      userId,
      status: REQUEST_STATUS.PENDING,
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have an access request pending review.',
        request: existingRequest,
      });
    }

    // Create new access request
    const accessRequest = new AccessRequest({
      userId,
      name: req.user.name,
      email: req.user.email,
      organization: organization.trim(),
      department: (department || '').trim(),
      reason: reason.trim(),
      purpose: purpose.trim(),
      status: REQUEST_STATUS.PENDING,
    });

    await accessRequest.save();

    // Update user status and info
    await User.findByIdAndUpdate(userId, {
      status: USER_STATUS.PENDING,
      organization: organization.trim(),
      department: (department || '').trim(),
    });

    // Notify Administrator via email & email log
    notifyAdminNewRequest(accessRequest).catch((err) =>
      console.error('[Notification Error]', err.message)
    );

    // Audit log
    await logAudit({
      action: 'ACCESS_REQUEST_SUBMIT',
      user: req.user,
      targetType: 'ACCESS_REQUEST',
      targetId: accessRequest._id,
      targetName: `${req.user.name} (${req.user.email})`,
      details: { organization, reason, purpose },
      req,
    });

    return res.status(201).json({
      success: true,
      message: 'Access request submitted successfully. Awaiting administrator review.',
      request: accessRequest,
    });
  } catch (err) {
    next(err);
  }
};

// Get current user's latest request
const getMyRequest = async (req, res, next) => {
  try {
    const request = await AccessRequest.findOne({ userId: req.user._id }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      request,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitAccessRequest,
  getMyRequest,
};
