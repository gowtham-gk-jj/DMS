const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  emailPasswordLogin,
  forgotPassword,
  resetPassword,
  googleLogin,
  devLogin,
  getMe,
  logout,
  gmailAuthRedirect,
  gmailAuthCallback,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Enterprise Security Rate Limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many password reset requests. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication Routes
router.post('/login', loginLimiter, emailPasswordLogin);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/google', googleLogin);
router.post('/dev-login', devLogin);
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

// Automated Gmail OAuth integration
router.get('/google/gmail-auth', gmailAuthRedirect);
router.get('/google/callback', gmailAuthCallback);

module.exports = router;
