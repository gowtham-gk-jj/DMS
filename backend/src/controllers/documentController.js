const Document = require('../models/Document');
const Folder = require('../models/Folder');
const Permission = require('../models/Permission');
const { USER_ROLES } = require('../config/constants');
const { escapeRegex } = require('../utils/escapeRegex');
const { uploadToCloudinary, deleteFromCloudinary, getSignedDownloadUrl } = require('../services/cloudinaryService');
const { logAudit } = require('../services/auditService');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const MIME_TYPES = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  json: 'application/json; charset=utf-8',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
};

const resolveMimeType = (ext, defaultMime) => {
  const cleanExt = (ext || '').toLowerCase().replace(/^\./, '');
  if (MIME_TYPES[cleanExt]) return MIME_TYPES[cleanExt];
  if (defaultMime && defaultMime !== 'application/octet-stream') return defaultMime;
  return 'application/octet-stream';
};

const findLocalFile = (filename) => {
  if (!filename) return null;
  const searchDirs = [
    UPLOADS_DIR,
    path.resolve(__dirname, '../../uploads'),
    path.resolve(process.cwd(), 'uploads'),
    path.resolve(process.cwd(), 'backend/uploads'),
    '/var/data/uploads',
  ];
  for (const dir of searchDirs) {
    if (dir) {
      const candidate = path.join(dir, filename);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return null;
};

const streamLocalFile = (filePath, req, res, mimeType, dispositionType, encodedName) => {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', mimeType);
  res.setHeader(
    'Content-Disposition',
    `${dispositionType}; filename="${encodedName}"; filename*=UTF-8''${encodedName}`
  );

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (isNaN(start) || start >= fileSize || (parts[1] && end >= fileSize) || start > end) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.status(416).json({ success: false, message: 'Requested range not satisfiable' });
    }

    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize);

    const stream = fs.createReadStream(filePath, { start, end });
    return stream.pipe(res);
  } else {
    res.status(200);
    res.setHeader('Content-Length', fileSize);
    const stream = fs.createReadStream(filePath);
    return stream.pipe(res);
  }
};

// Resilient remote stream proxy that follows redirects if issued by CDN or Cloudinary
const streamRemoteFile = (url, req, res, mimeType, dispositionType, encodedName, maxRedirects = 3) => {
  const client = url.startsWith('https:') ? https : http;
  const requestHeaders = {};
  if (req && req.headers && req.headers.range) {
    requestHeaders['Range'] = req.headers.range;
  }

  client
    .get(url, { headers: requestHeaders }, (remoteRes) => {
      if (
        (remoteRes.statusCode === 301 || remoteRes.statusCode === 302 || remoteRes.statusCode === 307) &&
        remoteRes.headers.location &&
        maxRedirects > 0
      ) {
        return streamRemoteFile(
          remoteRes.headers.location,
          req,
          res,
          mimeType,
          dispositionType,
          encodedName,
          maxRedirects - 1
        );
      }
      if (remoteRes.statusCode >= 400) {
        return res.status(remoteRes.statusCode).json({
          success: false,
          message: `Remote storage responded with status ${remoteRes.statusCode}`,
        });
      }

      res.status(remoteRes.statusCode);
      res.setHeader('Content-Type', mimeType);
      res.setHeader(
        'Content-Disposition',
        `${dispositionType}; filename="${encodedName}"; filename*=UTF-8''${encodedName}`
      );
      res.setHeader('Accept-Ranges', 'bytes');

      if (remoteRes.headers['content-range']) {
        res.setHeader('Content-Range', remoteRes.headers['content-range']);
      }
      if (remoteRes.headers['content-length']) {
        res.setHeader('Content-Length', remoteRes.headers['content-length']);
      }

      remoteRes.pipe(res);
    })
    .on('error', (err) => {
      console.error('Remote stream error:', err);
      if (!res.headersSent) {
        res.status(502).json({ success: false, message: 'Failed to stream document from remote storage' });
      }
    });
};

// DOConCD-style document listing for a folder
const getDocumentsInFolder = async (req, res, next) => {
  try {
    const { folderId } = req.params;
    const {
      category,
      system,
      search,
      sortBy = 'category',
      sortOrder = 'asc',
      page = 1,
      limit = 100, // Default up to 100 for DOConCD catalogue table
    } = req.query;

    const folder = await Folder.findById(folderId);
    if (!folder || folder.isArchived) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    // Recursively collect current folder and all descendant subfolders
    const folderIds = [folder._id];
    const subfolderQueue = [folder._id];
    while (subfolderQueue.length > 0) {
      const curId = subfolderQueue.shift();
      const children = await Folder.find({ parentFolderId: curId, isArchived: false }).select('_id').lean();
      for (const child of children) {
        folderIds.push(child._id);
        subfolderQueue.push(child._id);
      }
    }

    const query = {
      folderId: { $in: folderIds },
      isArchived: false,
    };

    if (category && category !== 'ALL') {
      query.category = category;
    }

    if (system && system !== 'ALL') {
      query.system = system;
    }

    if (search) {
      const safeSearch = escapeRegex(search.trim());
      query.$or = [
        { title: { $regex: safeSearch, $options: 'i' } },
        { system: { $regex: safeSearch, $options: 'i' } },
        { orderNumber: { $regex: safeSearch, $options: 'i' } },
        { documentCode: { $regex: safeSearch, $options: 'i' } },
        { originalFileName: { $regex: safeSearch, $options: 'i' } },
        { displayName: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const sortOptions = {};
    if (sortBy === 'displayOrder') {
      sortOptions.displayOrder = 1;
    } else if (sortBy === 'category') {
      sortOptions.displayOrder = 1;
      sortOptions.category = 1;
      sortOptions.title = 1;
    } else {
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [documents, total, categories, systems] = await Promise.all([
      Document.find(query).sort(sortOptions).skip(skip).limit(Number(limit)),
      Document.countDocuments(query),
      Document.distinct('category', { folderId: { $in: folderIds }, isArchived: false }),
      Document.distinct('system', { folderId: { $in: folderIds }, isArchived: false }),
    ]);

    // Group by category for DOConCD Table-of-Contents display
    const groupedByCategory = {};
    documents.forEach((doc) => {
      const cat = doc.category || 'General';
      if (!groupedByCategory[cat]) {
        groupedByCategory[cat] = [];
      }
      groupedByCategory[cat].push(doc);
    });

    return res.status(200).json({
      success: true,
      folder: {
        id: folder._id,
        name: folder.name,
        path: folder.path,
        description: folder.description,
      },
      documents,
      groupedByCategory,
      availableCategories: categories.filter(Boolean),
      availableSystems: systems.filter(Boolean),
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        limit: Number(limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get single document details
const getDocumentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const document = await Document.findById(id).populate('folderId', 'name path');
    if (!document || document.isArchived) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    return res.status(200).json({ success: true, document });
  } catch (err) {
    next(err);
  }
};

// Preview document (Verifies READ permission)
const previewDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const document = await Document.findById(id);
    if (!document || document.isArchived) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    await logAudit({
      action: 'DOCUMENT_PREVIEW',
      user: req.user,
      targetType: 'DOCUMENT',
      targetId: document._id,
      targetName: `${document.title} (${document.originalFileName})`,
      details: { format: document.fileExtension, mimeType: document.mimeType },
      req,
    });

    const resolvedMime = resolveMimeType(document.fileExtension, document.mimeType);

    return res.status(200).json({
      success: true,
      previewUrl: document.secureUrl || `/api/documents/${document._id}/stream`,
      streamUrl: `/api/documents/${document._id}/stream`,
      document: {
        id: document._id,
        title: document.title,
        originalFileName: document.originalFileName,
        mimeType: resolvedMime,
        fileExtension: document.fileExtension,
        fileSize: document.fileSize,
        system: document.system,
        softwareVersion: document.softwareVersion,
        edition: document.edition,
        orderNumber: document.orderNumber,
        documentCode: document.documentCode,
        category: document.category,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Stream document content inline (Prevents browser from auto-downloading)
const streamDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const document = await Document.findById(id);
    if (!document || document.isArchived) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    if (document.availabilityStatus === 'FILE_NOT_FOUND' || !document.secureUrl) {
      return res.status(404).json({ success: false, message: 'Document file is not available in the repository catalogue.' });
    }

    logAudit({
      action: 'DOCUMENT_PREVIEW',
      user: req.user,
      targetType: 'DOCUMENT',
      targetId: document._id,
      targetName: `${document.title} (${document.originalFileName})`,
      details: { format: document.fileExtension, mimeType: document.mimeType },
      req,
    }).catch(() => {});

    const mimeType = resolveMimeType(document.fileExtension, document.mimeType);
    const encodedName = encodeURIComponent(document.originalFileName || 'document.pdf');

    // 1. Check local persistent storage
    if (document.cloudinaryPublicId?.startsWith('local_')) {
      const filename = document.cloudinaryPublicId.replace('local_', '');
      const localFilePath = findLocalFile(filename);
      if (localFilePath) {
        return streamLocalFile(localFilePath, req, res, mimeType, 'inline', encodedName);
      }

      // If local file record exists but file is missing from disk:
      if (document.secureUrl && (document.secureUrl.includes('localhost') || document.secureUrl.includes('/uploads/'))) {
        return res.status(404).json({
          success: false,
          message: 'Document file not found on local persistent storage.',
        });
      }
    }

    // 2. Stream from Cloudinary or remote storage
    if (document.secureUrl && (document.secureUrl.startsWith('http://') || document.secureUrl.startsWith('https://'))) {
      return streamRemoteFile(document.secureUrl, req, res, mimeType, 'inline', encodedName);
    }

    return res.status(404).json({ success: false, message: 'Document file location is invalid or unavailable.' });
  } catch (err) {
    next(err);
  }
};

// Download document (Strictly enforces DOWNLOAD permission)
const downloadDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const document = await Document.findById(id);
    if (!document || document.isArchived) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    if (document.availabilityStatus === 'FILE_NOT_FOUND' || !document.secureUrl) {
      return res.status(404).json({ success: false, message: 'Document file is not available in the repository catalogue.' });
    }

    // Backend verification of download permission
    const user = req.user;
    let canDownload = false;

    if (user.role === USER_ROLES.ADMIN) {
      canDownload = true;
    } else {
      const specificPerm = await Permission.findOne({ userId: user._id, folderId: document.folderId });
      if (specificPerm && specificPerm.download) {
        canDownload = true;
      } else if (user.permissions && user.permissions.download) {
        canDownload = true;
      }
    }

    if (!canDownload) {
      return res.status(403).json({
        success: false,
        message: 'Security Violation: You do not have permission to download documents from this folder.',
      });
    }

    await logAudit({
      action: 'DOCUMENT_DOWNLOAD',
      user: req.user,
      targetType: 'DOCUMENT',
      targetId: document._id,
      targetName: `${document.title} (${document.originalFileName})`,
      details: { format: document.fileExtension, fileSize: document.fileSize },
      req,
    }).catch(() => {});

    // Stream download attachment directly when requested by in-app download
    if (req.query.stream === 'true' || req.headers['x-download-stream'] === 'true') {
      const cleanFileName = document.originalFileName || 'document.pdf';
      const mimeType = resolveMimeType(document.fileExtension, document.mimeType);
      const encodedName = encodeURIComponent(cleanFileName);

      // If stored locally in uploads/
      if (document.cloudinaryPublicId?.startsWith('local_')) {
        const filename = document.cloudinaryPublicId.replace('local_', '');
        const localFilePath = findLocalFile(filename);
        if (localFilePath) {
          return streamLocalFile(localFilePath, req, res, mimeType, 'attachment', encodedName);
        }

        if (document.secureUrl && (document.secureUrl.includes('localhost') || document.secureUrl.includes('/uploads/'))) {
          return res.status(404).json({
            success: false,
            message: 'Document file not found on local persistent storage.',
          });
        }
      }

      // Stream from Cloudinary or remote storage
      if (document.secureUrl && (document.secureUrl.startsWith('http://') || document.secureUrl.startsWith('https://'))) {
        return streamRemoteFile(document.secureUrl, req, res, mimeType, 'attachment', encodedName);
      }

      return res.status(404).json({ success: false, message: 'Document file location is invalid or unavailable.' });
    }

    // Default JSON response for programmatic API and test suite
    const downloadUrl = `/api/documents/${document._id}/download?stream=true`;

    if (req.query.redirect === 'true') {
      return res.redirect(downloadUrl);
    }

    return res.status(200).json({
      success: true,
      downloadUrl,
      fileName: document.originalFileName,
    });
  } catch (err) {
    next(err);
  }
};

// Upload documents (Multiple files support)
const uploadDocuments = async (req, res, next) => {
  try {
    const { folderId } = req.params;
    const files = req.files || (req.file ? [req.file] : []);

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No file(s) provided for upload' });
    }

    const folder = await Folder.findById(folderId);
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Destination folder not found' });
    }

    // Optional metadata overrides from body
    const {
      title,
      system,
      softwareVersion,
      edition,
      orderNumber,
      documentCode,
      category,
      description,
      tags,
    } = req.body;

    const parsedTags = Array.isArray(tags)
      ? tags
      : typeof tags === 'string'
      ? tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const uploadedDocuments = [];

    for (const file of files) {
      const extMatch = file.originalname.match(/\.([0-9a-z]+)$/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : '';

      // Upload stream to Cloudinary
      const cloudinaryResult = await uploadToCloudinary(
        file.buffer,
        file.originalname,
        `dms/${folder.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`
      );

      // Infer clean catalogue title and code if not manually set
      const cleanBaseName = file.originalname.replace(/\.[^/.]+$/, '');
      const docTitle = files.length === 1 && title ? title.trim() : cleanBaseName;
      const docCategory = category ? category.trim() : 'Operation';

      const doc = new Document({
        displayName: cleanBaseName,
        originalFileName: file.originalname,
        folderId: folder._id,
        cloudinaryAssetId: cloudinaryResult.asset_id || '',
        cloudinaryPublicId: cloudinaryResult.public_id,
        secureUrl: cloudinaryResult.secure_url,
        mimeType: file.mimetype || cloudinaryResult.resource_type,
        fileExtension: ext || cloudinaryResult.format,
        fileSize: file.size || cloudinaryResult.bytes,
        title: docTitle,
        system: system ? system.trim() : (folder.code || ''),
        softwareVersion: softwareVersion ? softwareVersion.trim() : '',
        edition: edition ? edition.trim() : '',
        orderNumber: orderNumber ? orderNumber.trim() : '',
        documentCode: documentCode ? documentCode.trim() : cleanBaseName.slice(0, 10),
        category: docCategory,
        description: description ? description.trim() : '',
        tags: parsedTags,
        uploadedBy: req.user._id,
      });

      await doc.save();
      uploadedDocuments.push(doc);

      await logAudit({
        action: 'DOCUMENT_UPLOAD',
        user: req.user,
        targetType: 'DOCUMENT',
        targetId: doc._id,
        targetName: `${doc.title} (${doc.originalFileName})`,
        details: { folderId: folder._id, folderName: folder.name, size: doc.fileSize },
        req,
      });
    }

    return res.status(201).json({
      success: true,
      message: `Successfully uploaded ${uploadedDocuments.length} document(s).`,
      documents: uploadedDocuments,
    });
  } catch (err) {
    next(err);
  }
};

// Update document metadata
const updateDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      displayName,
      system,
      softwareVersion,
      edition,
      orderNumber,
      documentCode,
      category,
      description,
      tags,
    } = req.body;

    const document = await Document.findById(id);
    if (!document || document.isArchived) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    if (title) document.title = title.trim();
    if (displayName) document.displayName = displayName.trim();
    if (system !== undefined) document.system = system.trim();
    if (softwareVersion !== undefined) document.softwareVersion = softwareVersion.trim();
    if (edition !== undefined) document.edition = edition.trim();
    if (orderNumber !== undefined) document.orderNumber = orderNumber.trim();
    if (documentCode !== undefined) document.documentCode = documentCode.trim();
    if (category) document.category = category.trim();
    if (description !== undefined) document.description = description.trim();
    if (tags) {
      document.tags = Array.isArray(tags)
        ? tags
        : typeof tags === 'string'
        ? tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];
    }

    await document.save();

    await logAudit({
      action: 'DOCUMENT_METADATA_UPDATE',
      user: req.user,
      targetType: 'DOCUMENT',
      targetId: document._id,
      targetName: `${document.title} (${document.originalFileName})`,
      details: req.body,
      req,
    });

    return res.status(200).json({ success: true, document });
  } catch (err) {
    next(err);
  }
};

// Move document to another folder
const moveDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { targetFolderId } = req.body;

    const document = await Document.findById(id);
    if (!document || document.isArchived) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const targetFolder = await Folder.findById(targetFolderId);
    if (!targetFolder || targetFolder.isArchived) {
      return res.status(404).json({ success: false, message: 'Target folder not found' });
    }

    const previousFolderId = document.folderId;
    document.folderId = targetFolder._id;
    await document.save();

    await logAudit({
      action: 'DOCUMENT_MOVE',
      user: req.user,
      targetType: 'DOCUMENT',
      targetId: document._id,
      targetName: document.title,
      details: { fromFolderId: previousFolderId, toFolderId: targetFolder._id },
      req,
    });

    return res.status(200).json({
      success: true,
      message: `Document moved to ${targetFolder.name}`,
      document,
    });
  } catch (err) {
    next(err);
  }
};

// Delete / Archive document
const deleteDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Soft delete / archive
    document.isArchived = true;
    await document.save();

    await logAudit({
      action: 'DOCUMENT_DELETE',
      user: req.user,
      targetType: 'DOCUMENT',
      targetId: document._id,
      targetName: `${document.title} (${document.originalFileName})`,
      req,
    });

    return res.status(200).json({
      success: true,
      message: `Document '${document.title}' deleted successfully.`,
    });
  } catch (err) {
    next(err);
  }
};

// Get recent documents for dashboard
const getRecentDocuments = async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 8;
    const documents = await Document.find({ isArchived: false })
      .populate('folderId', 'name path')
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.status(200).json({ success: true, documents });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDocumentsInFolder,
  getDocumentById,
  previewDocument,
  streamDocument,
  downloadDocument,
  uploadDocuments,
  updateDocument,
  moveDocument,
  deleteDocument,
  getRecentDocuments,
};
