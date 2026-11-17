const Document = require('../models/Document');
const Folder = require('../models/Folder');
const Permission = require('../models/Permission');
const { USER_ROLES } = require('../config/constants');
const { escapeRegex } = require('../utils/escapeRegex');

const globalSearch = async (req, res, next) => {
  try {
    const { q, limit = 20, folderId, system, category, fileType } = req.query;

    if (!q || !q.trim()) {
      return res.status(200).json({
        success: true,
        documents: [],
        folders: [],
        total: 0,
      });
    }

    const searchQuery = q.trim();
    const regex = new RegExp(escapeRegex(searchQuery), 'i');
    const user = req.user;

    // Determine allowed folder IDs for non-admin users
    let allowedFolderIds = null;
    if (user.role !== USER_ROLES.ADMIN) {
      if (user.permissions && user.permissions.read) {
        // User has general read access, but check if any folder has specific read: false
        const restricted = await Permission.find({ userId: user._id, read: false }).select('folderId');
        const restrictedIds = restricted.map((r) => r.folderId);
        // Will exclude restrictedIds
        allowedFolderIds = { $nin: restrictedIds };
      } else {
        // User only has access to specifically granted folders
        const granted = await Permission.find({ userId: user._id, read: true }).select('folderId');
        allowedFolderIds = { $in: granted.map((g) => g.folderId) };
      }
    }

    // 1. Search matching folders
    const folderFilter = {
      isArchived: false,
      $or: [{ name: regex }, { code: regex }, { description: regex }, { path: regex }],
    };
    if (allowedFolderIds) {
      folderFilter._id = allowedFolderIds;
    }

    const matchingFolders = await Folder.find(folderFilter)
      .select('name code description path level parentFolderId')
      .limit(8)
      .lean();

    // 2. Search matching documents
    const docFilter = {
      isArchived: false,
      $or: [
        { title: regex },
        { system: regex },
        { orderNumber: regex },
        { documentCode: regex },
        { fileName: regex },
        { originalFileName: regex },
        { displayName: regex },
        { softwareVersion: regex },
        { edition: regex },
        { category: regex },
        { description: regex },
        { tags: regex },
      ],
    };

    if (allowedFolderIds) {
      docFilter.folderId = allowedFolderIds;
    }
    if (folderId) {
      docFilter.folderId = folderId;
    }
    if (system && system !== 'ALL') {
      docFilter.system = system;
    }
    if (category && category !== 'ALL') {
      docFilter.category = category;
    }
    if (fileType && fileType !== 'ALL') {
      docFilter.fileExtension = fileType.toLowerCase();
    }

    const matchingDocuments = await Document.find(docFilter)
      .select(
        'title system orderNumber documentCode fileName originalFileName displayName category availabilityStatus secureUrl fileExtension fileSize softwareVersion edition folderId updatedAt createdAt'
      )
      .populate('folderId', 'name path')
      .sort({ updatedAt: -1 })
      .limit(Number(limit))
      .lean();

    const totalMatches = matchingFolders.length + matchingDocuments.length;

    return res.status(200).json({
      success: true,
      query: searchQuery,
      total: totalMatches,
      documentsCount: matchingDocuments.length,
      foldersCount: matchingFolders.length,
      documents: matchingDocuments,
      folders: matchingFolders,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  globalSearch,
};
