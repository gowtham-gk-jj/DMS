const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const getResourceType = (filename) => {
  const ext = (filename.match(/\.([0-9a-z]+)$/i)?.[1] || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return 'image';
  }
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
    return 'video';
  }
  return 'raw'; // PDFs, docs, spreadsheets, binaries
};

const uploadToCloudinary = async (fileBuffer, originalname, folder = 'dms_documents') => {
  const sanitizedName = originalname
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 60);

  const resourceType = getResourceType(originalname);

  // Cloudinary free tier enforces a strict 10MB (10485760 bytes) limit on raw assets.
  // Pre-emptively route >10MB raw files to resilient local fallback to prevent wasting bandwidth.
  if (resourceType === 'raw' && fileBuffer.length > 10485760) {
    const filename = `${Date.now()}_${sanitizedName}_${originalname}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filePath, fileBuffer);

    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    const localUrl = `${backendUrl}/uploads/${encodeURIComponent(filename)}`;

    return {
      asset_id: `local_${Date.now()}`,
      public_id: `local_${filename}`,
      secure_url: localUrl,
      resource_type: resourceType,
      format: originalname.split('.').pop(),
      bytes: fileBuffer.length,
      storage: 'LOCAL_PERSISTED',
    };
  }

  // 1. Attempt upload to Cloudinary with extended 3-minute timeout
  try {
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: `${Date.now()}_${sanitizedName}`,
          resource_type: resourceType,
          use_filename: true,
          unique_filename: true,
          timeout: 180000, // 3 minutes timeout
        },
        (error, res) => {
          if (error) return reject(error);
          resolve(res);
        }
      );

      const readable = Readable.from(fileBuffer);
      readable.pipe(uploadStream);
    });

    return {
      asset_id: result.asset_id || '',
      public_id: result.public_id,
      secure_url: result.secure_url,
      resource_type: result.resource_type || resourceType,
      format: result.format || originalname.split('.').pop(),
      bytes: result.bytes || fileBuffer.length,
      storage: 'CLOUDINARY',
    };
  } catch (cloudinaryError) {
    console.warn(
      `[Cloudinary Upload Warning] Cloudinary upload encountered issue (${cloudinaryError.message}). Utilizing persistent local storage fallback.`
    );

    // Notify dual administrators of storage issue
    try {
      const { notifyAdminUploadFailure } = require('./emailService');
      notifyAdminUploadFailure({
        fileName: originalname,
        folderName: folder,
        error: cloudinaryError.message,
      }).catch(() => {});
    } catch {}

    // 2. Resilient local fallback so users never experience upload failures
    const filename = `${Date.now()}_${sanitizedName}_${originalname}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filePath, fileBuffer);

    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    const localUrl = `${backendUrl}/uploads/${encodeURIComponent(filename)}`;

    return {
      asset_id: `local_${Date.now()}`,
      public_id: `local_${filename}`,
      secure_url: localUrl,
      resource_type: resourceType,
      format: originalname.split('.').pop(),
      bytes: fileBuffer.length,
      storage: 'LOCAL_PERSISTED',
    };
  }
};

const deleteFromCloudinary = async (publicId, resourceType = 'raw') => {
  if (publicId && publicId.startsWith('local_')) {
    const filename = publicId.replace('local_', '');
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error('Failed to delete local file:', e);
      }
    }
    return { result: 'ok' };
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      timeout: 60000,
    });
    return result;
  } catch (err) {
    console.error('[Cloudinary Delete Error]', err);
    return { result: 'failed', error: err.message };
  }
};

const getSignedDownloadUrl = (publicId, originalFileName, format) => {
  if (!publicId) return null;
  if (publicId.startsWith('local_')) {
    const filename = publicId.replace('local_', '');
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    return `${backendUrl}/uploads/${encodeURIComponent(filename)}`;
  }

  try {
    const resourceType = getResourceType(originalFileName || '');
    // Sign the URL without transformation flags to prevent Cloudinary 400 'Invalid flag' on raw/pdf files
    const url = cloudinary.utils.url(publicId, {
      resource_type: resourceType,
      sign_url: true,
      secure: true,
    });
    return url;
  } catch (err) {
    return null;
  }
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  getSignedDownloadUrl,
};
