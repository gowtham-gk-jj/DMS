const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { USER_ROLES, USER_STATUS, ADMIN_EMAILS } = require('../config/constants');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    // Allows preview or download streaming if token passed in query parameter
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-__v');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.',
      });
    }

    // Check if user is suspended
    if (user.status === USER_STATUS.SUSPENDED) {
      return res.status(403).json({
        success: false,
        status: user.status,
        message: 'Your account has been suspended by an administrator.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.',
    });
  }
};

// Ensure user has APPROVED status (Admins always approved)
const requireApproved = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  if (req.user.role === USER_ROLES.ADMIN) {
    return next();
  }

  if (req.user.status !== USER_STATUS.APPROVED) {
    return res.status(403).json({
      success: false,
      status: req.user.status,
      rejectionReason: req.user.rejectionReason,
      message: `Access denied. Account status is currently ${req.user.status}.`,
    });
  }

  next();
};

// Admin only access (Enforces identical privileges for both Master Administrators)
const requireAdmin = (req, res, next) => {
  const adminEmails = [
    (process.env.ADMIN_EMAIL || '').toLowerCase().trim(),
    ...ADMIN_EMAILS.map((e) => e.toLowerCase().trim()),
  ].filter(Boolean);

  const isMasterAdmin = req.user?.email && adminEmails.includes(req.user.email.toLowerCase().trim());

  if (!req.user || (req.user.role !== USER_ROLES.ADMIN && !isMasterAdmin)) {
    // Notify both administrators of unauthorized privilege access attempt
    const { notifyAdminSecurityAlert } = require('../services/emailService');
    notifyAdminSecurityAlert({
      action: 'UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT',
      target: req.originalUrl,
      user: req.user,
      ip: req.ip || req.connection?.remoteAddress,
      details: { method: req.method, role: req.user?.role },
    }).catch(() => {});

    return res.status(403).json({
      success: false,
      message: 'Access restricted to administrators only.',
    });
  }
  next();
};

module.exports = {
  protect,
  requireApproved,
  requireAdmin,
};
