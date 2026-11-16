const Folder = require('../models/Folder');
const Document = require('../models/Document');
const Permission = require('../models/Permission');
const { USER_ROLES } = require('../config/constants');
const { logAudit } = require('../services/auditService');
const { escapeRegex } = require('../utils/escapeRegex');

// Helper to construct breadcrumbs
const buildBreadcrumbs = async (folderId) => {
  const breadcrumbs = [];
  let currentId = folderId;

  while (currentId) {
    const folder = await Folder.findById(currentId).select('name parentFolderId path');
    if (!folder) break;
    breadcrumbs.unshift({
      id: folder._id,
      name: folder.name,
      path: folder.path,
    });
    currentId = folder.parentFolderId;
  }
  return breadcrumbs;
};

// Get folders (optionally filtered by parentFolderId)
const getFolders = async (req, res, next) => {
  try {
    const { parentId } = req.query;
    const user = req.user;

    const query = {
      isArchived: false,
      parentFolderId: parentId && parentId !== 'root' ? parentId : null,
    };

    let folders = await Folder.find(query).sort({ name: 1 });

    // Fetch active folders and group documents by folderId to calculate descendant document counts without N+1 queries
    const allActiveFolders = await Folder.find({ isArchived: false }).select('_id parentFolderId path').lean();
    const docCountsAgg = await Document.aggregate([
      { $match: { isArchived: false, folderId: { $ne: null } } },
      { $group: { _id: '$folderId', count: { $sum: 1 } } },
    ]);

    const docCountMap = new Map();
    docCountsAgg.forEach((d) => docCountMap.set(String(d._id), d.count));

    const childrenMap = new Map();
    allActiveFolders.forEach((f) => {
      const pid = f.parentFolderId ? String(f.parentFolderId) : 'root';
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid).push(f);
    });

    const getDescendantDocCount = (folderId) => {
      let total = docCountMap.get(String(folderId)) || 0;
      const children = childrenMap.get(String(folderId)) || [];
      for (const child of children) {
        total += getDescendantDocCount(child._id);
      }
      return total;
    };

    const getDescendantFolderCount = (folderId) => {
      const children = childrenMap.get(String(folderId)) || [];
      let total = children.length;
      for (const child of children) {
        total += getDescendantFolderCount(child._id);
      }
      return total;
    };

    // Pre-fetch user permissions in one query
    const targetFolderIds = folders.map((f) => f._id);
    const permsMap = new Map();
    if (user.role !== USER_ROLES.ADMIN) {
      const perms = await Permission.find({ userId: user._id, folderId: { $in: targetFolderIds } }).lean();
      perms.forEach((p) => permsMap.set(String(p.folderId), p));
    }

    const foldersWithCounts = folders.map((folder) => {
      const directDocs = docCountMap.get(String(folder._id)) || 0;
      const totalDocs = getDescendantDocCount(folder._id);
      const directSubfolders = (childrenMap.get(String(folder._id)) || []).length;
      const totalSubfolders = getDescendantFolderCount(folder._id);

      let userPerm = null;
      if (user.role === USER_ROLES.ADMIN) {
        userPerm = { read: true, upload: true, download: true, manage: true };
      } else {
        const specific = permsMap.get(String(folder._id));
        if (specific) {
          userPerm = {
            read: specific.read,
            upload: specific.upload,
            download: specific.download,
            manage: specific.manage,
          };
        } else {
          userPerm = user.permissions;
        }
      }

      return {
        ...folder.toObject(),
        subfoldersCount: directSubfolders,
        directSubfoldersCount: directSubfolders,
        totalSubfoldersCount: totalSubfolders,
        directDocumentsCount: directDocs,
        documentsCount: totalDocs > 0 ? totalDocs : directDocs,
        totalDocumentsCount: totalDocs,
        userPermissions: userPerm,
      };
    });

    // If a parent folder was requested, fetch its breadcrumbs and details
    let currentFolder = null;
    let breadcrumbs = [];
    if (parentId && parentId !== 'root') {
      currentFolder = await Folder.findById(parentId);
      breadcrumbs = await buildBreadcrumbs(parentId);
    }

    return res.status(200).json({
      success: true,
      folders: foldersWithCounts,
      currentFolder,
      breadcrumbs,
    });
  } catch (err) {
    next(err);
  }
};

// Get single folder details with full hierarchy breadcrumb
const getFolderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const folder = await Folder.findById(id);
    if (!folder || folder.isArchived) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    const breadcrumbs = await buildBreadcrumbs(id);
    const subfoldersCount = await Folder.countDocuments({ parentFolderId: folder._id, isArchived: false });
    const directDocs = await Document.countDocuments({ folderId: folder._id, isArchived: false });

    // Calculate total descendants count across hierarchy
    const descendantFolders = await Folder.find({
      isArchived: false,
      path: new RegExp(`^${escapeRegex(folder.path)}(/|$)`),
    }).select('_id').lean();
    const descendantFolderIds = descendantFolders.map((f) => f._id);
    const totalDocumentsCount = await Document.countDocuments({
      folderId: { $in: descendantFolderIds },
      isArchived: false,
    });
    const documentsCount = totalDocumentsCount > 0 ? totalDocumentsCount : directDocs;

    const totalSubfoldersCount = Math.max(0, descendantFolders.length - 1);

    // Permissions
    let userPermissions = null;
    if (req.user.role === USER_ROLES.ADMIN) {
      userPermissions = { read: true, upload: true, download: true, manage: true };
    } else {
      const specific = await Permission.findOne({ userId: req.user._id, folderId: folder._id });
      userPermissions = specific
        ? { read: specific.read, upload: specific.upload, download: specific.download, manage: specific.manage }
        : req.user.permissions;
    }

    return res.status(200).json({
      success: true,
      folder: {
        ...folder.toObject(),
        subfoldersCount,
        directSubfoldersCount: subfoldersCount,
        totalSubfoldersCount,
        directDocumentsCount: directDocs,
        documentsCount,
        totalDocumentsCount,
        userPermissions,
      },
      breadcrumbs,
    });
  } catch (err) {
    next(err);
  }
};

// Create folder / subfolder
const createFolder = async (req, res, next) => {
  try {
    const { name, code, description, parentFolderId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Folder name is required' });
    }

    let level = 0;
    let path = `/${name.trim()}`;

    if (parentFolderId) {
      const parent = await Folder.findById(parentFolderId);
      if (!parent) {
        return res.status(404).json({ success: false, message: 'Parent folder not found' });
      }
      level = parent.level + 1;
      path = `${parent.path.replace(/\/$/, '')}/${name.trim()}`;
    }

    const folder = new Folder({
      name: name.trim(),
      code: code ? code.trim() : '',
      description: description ? description.trim() : '',
      parentFolderId: parentFolderId || null,
      level,
      path,
      createdBy: req.user._id,
    });

    await folder.save();

    await logAudit({
      action: 'FOLDER_CREATE',
      user: req.user,
      targetType: 'FOLDER',
      targetId: folder._id,
      targetName: folder.name,
      details: { path, parentFolderId },
      req,
    });

    return res.status(201).json({
      success: true,
      message: 'Folder created successfully',
      folder,
    });
  } catch (err) {
    next(err);
  }
};

// Rename / update folder
const updateFolder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, description, parentFolderId } = req.body;

    const folder = await Folder.findById(id);
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    if (name) folder.name = name.trim();
    if (code !== undefined) folder.code = code.trim();
    if (description !== undefined) folder.description = description.trim();

    // Prevent circular folder relationships
    if (parentFolderId !== undefined && parentFolderId !== null && String(parentFolderId) !== String(folder.parentFolderId)) {
      if (String(parentFolderId) === String(folder._id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid move: A folder cannot be its own parent.',
        });
      }

      // Check if target parent is a descendant of this folder
      let checkId = parentFolderId;
      while (checkId) {
        const ancestor = await Folder.findById(checkId);
        if (!ancestor) break;
        if (String(ancestor._id) === String(folder._id)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid move: Cannot move a folder into one of its own subfolders (circular hierarchy).',
          });
        }
        checkId = ancestor.parentFolderId;
      }
    }

    // Recompute path if parent or name changed
    if (parentFolderId !== undefined && String(parentFolderId) !== String(folder.parentFolderId)) {
      if (parentFolderId) {
        const newParent = await Folder.findById(parentFolderId);
        if (newParent) {
          folder.parentFolderId = newParent._id;
          folder.level = newParent.level + 1;
          folder.path = `${newParent.path.replace(/\/$/, '')}/${folder.name}`;
        }
      } else {
        folder.parentFolderId = null;
        folder.level = 0;
        folder.path = `/${folder.name}`;
      }
    }

    await folder.save();

    await logAudit({
      action: 'FOLDER_UPDATE',
      user: req.user,
      targetType: 'FOLDER',
      targetId: folder._id,
      targetName: folder.name,
      details: { name, description },
      req,
    });

    return res.status(200).json({ success: true, folder });
  } catch (err) {
    next(err);
  }
};

// Delete or archive folder
const deleteFolder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const folder = await Folder.findById(id);
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    // Check if folder contains documents or subfolders
    const [subfoldersCount, documentsCount] = await Promise.all([
      Folder.countDocuments({ parentFolderId: id, isArchived: false }),
      Document.countDocuments({ folderId: id, isArchived: false }),
    ]);

    // Soft delete / archive
    folder.isArchived = true;
    await folder.save();

    await logAudit({
      action: 'FOLDER_DELETE',
      user: req.user,
      targetType: 'FOLDER',
      targetId: folder._id,
      targetName: folder.name,
      details: { subfoldersCount, documentsCount },
      req,
    });

    return res.status(200).json({
      success: true,
      message: `Folder '${folder.name}' and its references archived successfully.`,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getFolders,
  getFolderById,
  createFolder,
  updateFolder,
  deleteFolder,
};
