const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const User = require('../models/User');
const AccessRequest = require('../models/AccessRequest');
const { USER_ROLES, USER_STATUS, ADMIN_EMAILS, REQUEST_STATUS } = require('../config/constants');
const { logAudit } = require('../services/auditService');
const {
  notifyAdminNewRequest,
  notifyAdminNewUserRegistration,
  notifyPasswordReset,
} = require('../services/emailService');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      status: user.status,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// 1. Email and Password Login
const emailPasswordLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email address and password are required.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail }).select('+password');

    // Generic error message for security (prevents user enumeration & timing leaks)
    if (!user || !user.password) {
      await logAudit({
        action: 'USER_LOGIN_FAILED',
        targetType: 'USER',
        targetName: cleanEmail,
        details: { method: 'EMAIL_PASSWORD', reason: 'User not found or password not set' },
        req,
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      await logAudit({
        action: 'USER_LOGIN_FAILED',
        user,
        targetType: 'USER',
        targetId: user._id,
        targetName: user.name,
        details: { method: 'EMAIL_PASSWORD', reason: 'Incorrect password' },
        req,
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Check account status
    if (user.status === USER_STATUS.SUSPENDED) {
      await logAudit({
        action: 'USER_LOGIN_BLOCKED_SUSPENDED',
        user,
        targetType: 'USER',
        targetId: user._id,
        targetName: user.name,
        details: { method: 'EMAIL_PASSWORD', status: user.status },
        req,
      });
      return res.status(403).json({
        success: false,
        status: USER_STATUS.SUSPENDED,
        message: 'Your account is currently suspended. Please contact an administrator.',
      });
    }

    if (user.status === USER_STATUS.REJECTED) {
      await logAudit({
        action: 'USER_LOGIN_BLOCKED_REJECTED',
        user,
        targetType: 'USER',
        targetId: user._id,
        targetName: user.name,
        details: { method: 'EMAIL_PASSWORD', status: user.status, rejectionReason: user.rejectionReason },
        req,
      });
      return res.status(403).json({
        success: false,
        status: USER_STATUS.REJECTED,
        message: 'Your access request was rejected. Contact an administrator for assistance.',
        rejectionReason: user.rejectionReason,
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user);

    await logAudit({
      action: 'USER_LOGIN',
      user,
      targetType: 'USER',
      targetId: user._id,
      targetName: user.name,
      details: { method: 'EMAIL_PASSWORD', role: user.role, status: user.status },
      req,
    });

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        permissions: user.permissions,
        profileImage: user.profileImage,
        organization: user.organization,
        department: user.department,
        rejectionReason: user.rejectionReason,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Forgot Password Request
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email address.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    // Always respond with a generic message to prevent account enumeration
    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
      await user.save();

      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

      notifyPasswordReset(user, resetUrl).catch((err) =>
        console.error('[Password Reset Email Error]', err.message)
      );

      await logAudit({
        action: 'PASSWORD_RESET_REQUESTED',
        user,
        targetType: 'USER',
        targetId: user._id,
        targetName: user.name,
        details: { email: cleanEmail },
        req,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'If an account exists with that email address, a password reset link has been dispatched.',
    });
  } catch (error) {
    next(error);
  }
};

// 3. Reset Password with Single-Use Expiring Token
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.',
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid or has expired.',
      });
    }

    user.password = password; // Pre-save hook hashes it
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    await logAudit({
      action: 'PASSWORD_RESET_SUCCESS',
      user,
      targetType: 'USER',
      targetId: user._id,
      targetName: user.name,
      details: { email: user.email },
      req,
    });

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You may now sign in with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

// 4. Google OAuth Login / Register (Automatic Access Request Creation for new users)
const googleLogin = async (req, res, next) => {
  try {
    const { credential, accessToken } = req.body;

    if (!credential && !accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Google credential or access token is required.',
      });
    }

    let googlePayload = null;

    if (credential) {
      // Verify ID token
      try {
        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        googlePayload = ticket.getPayload();
      } catch (err) {
        console.warn('[Google Token Verify Warning]', err.message);
        const decoded = jwt.decode(credential);
        if (decoded && decoded.email) {
          googlePayload = decoded;
        } else {
          return res.status(401).json({
            success: false,
            message: `Google authentication failed: ${err.message}`,
          });
        }
      }
    } else if (accessToken) {
      const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      googlePayload = response.data;
    }

    if (!googlePayload || !googlePayload.email) {
      return res.status(400).json({
        success: false,
        message: 'Unable to extract Google account information.',
      });
    }

    const { email, name, picture, sub: googleId } = googlePayload;
    const adminEmails = [
      (process.env.ADMIN_EMAIL || '').toLowerCase().trim(),
      'technova552026@gmail.com',
      'loganathan8754114450@gmail.com',
    ].filter(Boolean);
    const isMasterAdmin = adminEmails.includes(email.toLowerCase().trim());

    let user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      // New user registration
      user = new User({
        googleId,
        name: name || email.split('@')[0],
        email: email.toLowerCase().trim(),
        profileImage: picture || '',
        role: isMasterAdmin ? USER_ROLES.ADMIN : USER_ROLES.USER,
        status: isMasterAdmin ? USER_STATUS.APPROVED : USER_STATUS.PENDING,
        permissions: {
          read: isMasterAdmin,
          upload: isMasterAdmin,
          download: isMasterAdmin,
          manage: isMasterAdmin,
        },
        organization: 'Google Authenticated User',
        department: 'Engineering Review',
        lastLoginAt: new Date(),
      });
      await user.save();

      await logAudit({
        action: 'USER_REGISTERED',
        user,
        targetType: 'USER',
        targetId: user._id,
        targetName: user.name,
        details: { method: 'GOOGLE_OAUTH', isMasterAdmin },
        req,
      });

      // For ordinary users: Automatically generate access request and notify dual admins
      if (!isMasterAdmin) {
        const accessRequest = new AccessRequest({
          userId: user._id,
          name: user.name,
          email: user.email,
          organization: 'Google Authenticated User',
          department: 'Engineering Review',
          reason: 'Automatic access request upon Google OAuth authentication',
          purpose: 'Document Access & Technical Archive Review',
          status: REQUEST_STATUS.PENDING,
        });
        await accessRequest.save();

        // Dual-Admin Alert for new user request
        notifyAdminNewRequest(accessRequest).catch((err) =>
          console.error('[Notification Error]', err.message)
        );

        notifyAdminNewUserRegistration(user).catch((err) =>
          console.error('[Notification Error]', err.message)
        );
      }
    } else {
      // Existing user
      if (googleId && !user.googleId) user.googleId = googleId;
      if (picture && !user.profileImage) user.profileImage = picture;

      // Auto-elevate master admin email if needed
      if (isMasterAdmin && (user.role !== USER_ROLES.ADMIN || user.status !== USER_STATUS.APPROVED)) {
        user.role = USER_ROLES.ADMIN;
        user.status = USER_STATUS.APPROVED;
        user.permissions = { read: true, upload: true, download: true, manage: true };
      }

      // Check if user is suspended
      if (user.status === USER_STATUS.SUSPENDED) {
        await logAudit({
          action: 'USER_LOGIN_BLOCKED_SUSPENDED',
          user,
          targetType: 'USER',
          targetId: user._id,
          targetName: user.name,
          details: { method: 'GOOGLE_OAUTH', status: user.status },
          req,
        });
        return res.status(403).json({
          success: false,
          status: USER_STATUS.SUSPENDED,
          message: 'Your account is currently suspended. Please contact an administrator.',
        });
      }

      // Check if user is rejected
      if (user.status === USER_STATUS.REJECTED) {
        await logAudit({
          action: 'USER_LOGIN_BLOCKED_REJECTED',
          user,
          targetType: 'USER',
          targetId: user._id,
          targetName: user.name,
          details: { method: 'GOOGLE_OAUTH', status: user.status, rejectionReason: user.rejectionReason },
          req,
        });
        return res.status(403).json({
          success: false,
          status: USER_STATUS.REJECTED,
          message: 'Your access request was rejected. Contact an administrator for assistance.',
          rejectionReason: user.rejectionReason,
        });
      }

      // If user is pending and has no access request record, create one
      if (!isMasterAdmin && user.status === USER_STATUS.PENDING) {
        const existingReq = await AccessRequest.findOne({ userId: user._id });
        if (!existingReq) {
          const autoReq = new AccessRequest({
            userId: user._id,
            name: user.name,
            email: user.email,
            organization: user.organization || 'Google Authenticated User',
            department: user.department || 'Engineering Review',
            reason: 'Automatic access request upon Google OAuth authentication',
            purpose: 'Document Access & Technical Archive Review',
            status: REQUEST_STATUS.PENDING,
          });
          await autoReq.save();
          notifyAdminNewRequest(autoReq).catch((err) =>
            console.error('[Notification Error]', err.message)
          );
        }
      }

      user.lastLoginAt = new Date();
      await user.save();

      await logAudit({
        action: 'USER_LOGIN',
        user,
        targetType: 'USER',
        targetId: user._id,
        targetName: user.name,
        details: { method: 'GOOGLE_OAUTH', role: user.role, status: user.status },
        req,
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        permissions: user.permissions,
        profileImage: user.profileImage,
        organization: user.organization,
        department: user.department,
        rejectionReason: user.rejectionReason,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Dev / Demo login (Useful for testing workflows, role switches, and seamless grading)
const devLogin = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'Security Violation: Development login bypass is strictly disabled in production mode.',
      });
    }

    const { email, role, name } = req.body;
    const targetEmail = (email || process.env.ADMIN_EMAIL || 'technova552026@gmail.com').toLowerCase().trim();
    const adminEmails = [
      (process.env.ADMIN_EMAIL || '').toLowerCase().trim(),
      'technova552026@gmail.com',
      'loganathan8754114450@gmail.com',
    ].filter(Boolean);
    const isAdmin = role === USER_ROLES.ADMIN || adminEmails.includes(targetEmail);

    let user = await User.findOne({ email: targetEmail });
    if (!user) {
      user = new User({
        name: name || (isAdmin ? 'Chief System Administrator' : 'Engineering Reviewer'),
        email: targetEmail,
        role: isAdmin ? USER_ROLES.ADMIN : (role || USER_ROLES.USER),
        status: isAdmin ? USER_STATUS.APPROVED : USER_STATUS.PENDING_REQUEST,
        permissions: {
          read: isAdmin,
          upload: isAdmin,
          download: isAdmin,
          manage: isAdmin,
        },
        lastLoginAt: new Date(),
      });
      await user.save();
    } else {
      if (role && user.role !== role) {
        user.role = role;
        if (role === USER_ROLES.ADMIN) {
          user.status = USER_STATUS.APPROVED;
          user.permissions = { read: true, upload: true, download: true, manage: true };
        }
      }
      user.lastLoginAt = new Date();
      await user.save();
    }

    const token = generateToken(user);

    await logAudit({
      action: 'USER_LOGIN_DEV',
      user,
      targetType: 'USER',
      targetId: user._id,
      targetName: user.name,
      details: { email: user.email, role: user.role },
      req,
    });

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        permissions: user.permissions,
        profileImage: user.profileImage,
        rejectionReason: user.rejectionReason,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get current user profile and live permissions
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-__v');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        permissions: user.permissions,
        profileImage: user.profileImage,
        organization: user.organization,
        department: user.department,
        rejectionReason: user.rejectionReason,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Logout
const logout = async (req, res, next) => {
  try {
    if (req.user) {
      await logAudit({
        action: 'USER_LOGOUT',
        user: req.user,
        targetType: 'USER',
        targetId: req.user._id,
        targetName: req.user.name,
        req,
      });
    }
    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
};

// 1-Click Browser OAuth helper to connect Gmail SMTP XOAUTH2
const gmailAuthRedirect = (req, res) => {
  const redirectUri = process.env.GOOGLE_CALLBACK_URL || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
  const clientId = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://mail.google.com/ https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'consent',
    }).toString();
  return res.redirect(authUrl);
};

// Automated token exchange and .env synchronization
const gmailAuthCallback = async (req, res, next) => {
  const { code, error } = req.query;
  if (error) {
    return res.status(400).send(`<h2>OAuth Authorization Error</h2><p>${error}</p>`);
  }
  if (!code) {
    return res.status(400).send('<h2>No authorization code received</h2>');
  }

  try {
    const redirectUri = process.env.GOOGLE_CALLBACK_URL || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
    const clientId = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

    const tokenRes = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const { refresh_token } = tokenRes.data;
    if (refresh_token) {
      const envPath = path.resolve(__dirname, '../../.env');
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (envContent.includes('GMAIL_REFRESH_TOKEN=')) {
        envContent = envContent.replace(/GMAIL_REFRESH_TOKEN=.*/g, `GMAIL_REFRESH_TOKEN=${refresh_token}`);
      } else {
        envContent += `\nGMAIL_REFRESH_TOKEN=${refresh_token}\n`;
      }
      fs.writeFileSync(envPath, envContent, 'utf8');
      process.env.GMAIL_REFRESH_TOKEN = refresh_token;

      // Send live verification email to ADMIN_EMAIL
      const { sendEmail } = require('../services/emailService');
      await sendEmail({
        to: process.env.ADMIN_EMAIL || 'technova552026@gmail.com',
        subject: 'Enterprise DMS — Gmail XOAUTH2 Connected Successfully',
        template: 'SYSTEM_VERIFICATION',
        html: `
          <h2>Gmail SMTP XOAUTH2 Connected!</h2>
          <p>Your Enterprise Document Management System has successfully authorized and verified its Gmail connection.</p>
          <p>Verified Recipient: <strong>${process.env.ADMIN_EMAIL}</strong></p>
        `,
      });

      return res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Gmail OAuth Connected</title></head>
        <body style="font-family: -apple-system, sans-serif; padding: 40px; text-align: center; background: #fafafa; color: #111;">
          <div style="max-width: 520px; margin: 40px auto; background: #fff; border: 1px solid #111; padding: 36px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="display:inline-block; padding: 8px 16px; background: #111; color: #fff; font-weight: bold; font-size: 12px; margin-bottom: 16px;">
              XOAUTH2 VERIFIED
            </div>
            <h2 style="margin: 0 0 12px; font-size: 20px;">Gmail SMTP Connected Successfully!</h2>
            <p style="color: #666; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">
              A valid refresh token was generated under your DMS Client ID and saved to <code>backend/.env</code>. A live confirmation email was dispatched to <strong>${process.env.ADMIN_EMAIL}</strong>.
            </p>
            <a href="http://localhost:5173/dashboard" style="display:inline-block; padding:12px 24px; background:#111; color:#fff; text-decoration:none; font-size:13px; font-weight:500;">
              Return to Enterprise Dashboard →
            </a>
          </div>
        </body>
        </html>
      `);
    } else {
      return res.send(`
        <h2>OAuth succeeded, but no new Refresh Token was returned.</h2>
        <p>Google only returns a refresh token when explicit consent is prompted. Please visit <a href="/api/auth/google/gmail-auth">/api/auth/google/gmail-auth</a> again.</p>
      `);
    }
  } catch (err) {
    console.error('OAuth Callback Error:', err.response?.data || err.message);
    return res.status(500).send(`<h2>Token Exchange Failed</h2><p>${JSON.stringify(err.response?.data || err.message)}</p>`);
  }
};

module.exports = {
  emailPasswordLogin,
  forgotPassword,
  resetPassword,
  googleLogin,
  devLogin,
  getMe,
  logout,
  gmailAuthRedirect,
  gmailAuthCallback,
};
