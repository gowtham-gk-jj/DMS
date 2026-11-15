const errorHandler = (err, req, res, next) => {
  console.error('[Error Handler]', err.name || 'Error', err.message);

  // 1. Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid ID format: ${err.value}`,
    });
  }

  // 2. Mongoose Schema Validation Error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: messages.join(', ') || 'Validation failed for one or more fields.',
      errors: messages,
    });
  }

  // 3. JWT Authentication Errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.',
    });
  }

  // 4. Multer File Upload Errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File size exceeds the permitted limit (100MB maximum per file).',
    });
  }

  // 5. General / Internal Server Errors
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  if (statusCode === 500) {
    try {
      const { notifyAdminSystemError } = require('../services/emailService');
      notifyAdminSystemError({
        errorName: err.name || 'InternalServerError',
        message: err.message,
        path: req.originalUrl,
      }).catch(() => {});
    } catch {}
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { errorName: err.name }),
  });
};

module.exports = errorHandler;
