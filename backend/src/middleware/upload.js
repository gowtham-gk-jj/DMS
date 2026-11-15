const multer = require('multer');

// Store files temporarily in memory for direct stream uploading to Cloudinary
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Allow all standard enterprise document, image, CAD, pdf, spreadsheet, presentation, text, and media types
  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max file size
  },
  fileFilter,
});

module.exports = upload;
