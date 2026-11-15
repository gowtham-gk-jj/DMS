const Permission = require('../models/Permission');
const Document = require('../models/Document');
const { USER_ROLES } = require('../config/constants');

// Checks if user has specific permission for a folder
const checkFolderPermission = (action) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      // Admins bypass folder restrictions
      if (user.role === USER_ROLES.ADMIN) {
        return next();
      }

      const folderId = req.params.folderId || req.body.folderId || req.query.folderId;
      if (!folderId) {
        // If checking a generic operation without folderId, rely on base user permission
        if (user.permissions && user.permissions[action]) {
          return next();
        }
        return res.status(403).json({
          success: false,
          message: `You do not have global permission to perform: ${action}`,
        });
      }

      // Check specific folder permission override
      const specificPerm = await Permission.findOne({
        userId: user._id,
        folderId,
      });

      if (specificPerm) {
        if (specificPerm[action]) {
          return next();
        } else {
          return res.status(403).json({
            success: false,
            message: `Permission denied: ${action.toUpperCase()} is disabled for this folder.`,
          });
        }
      }

      // If no folder-specific override exists, fall back to user's general permission
      if (user.permissions && user.permissions[action]) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: `Permission denied: You do not have ${action.toUpperCase()} access for this folder.`,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };
};

// Checks if user has permission for a specific document
const checkDocumentPermission = (action) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      if (user.role === USER_ROLES.ADMIN) {
        return next();
      }

      const documentId = req.params.id || req.body.documentId;
      const document = await Document.findById(documentId);
      if (!document) {
        return res.status(404).json({ success: false, message: 'Document not found' });
      }

      req.targetDocument = document;

      // Check folder-specific permission
      const specificPerm = await Permission.findOne({
        userId: user._id,
        folderId: document.folderId,
      });

      if (specificPerm) {
        if (specificPerm[action]) {
          return next();
        } else {
          return res.status(403).json({
            success: false,
            message: `Permission denied: ${action.toUpperCase()} is disabled for this document.`,
          });
        }
      }

      // Fallback to user general permission
      if (user.permissions && user.permissions[action]) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: `Permission denied: You do not have ${action.toUpperCase()} access for this document.`,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };
};

module.exports = {
  checkFolderPermission,
  checkDocumentPermission,
};
