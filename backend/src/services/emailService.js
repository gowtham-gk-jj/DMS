const nodemailer = require('nodemailer');
const EmailLog = require('../models/EmailLog');
const { ADMIN_EMAILS } = require('../config/constants');

// Return all configured administrator notification emails (defaults to both Master Admins)
const getAdminEmails = () => {
  const envAdmins = (process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...ADMIN_EMAILS.map((e) => e.toLowerCase().trim()), ...envAdmins]));
};

// Setup transporter dynamically based on current environment variables
const getTransporter = () => {
  const gmailClientId = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const gmailClientSecret = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  const gmailRefreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const adminEmail = (process.env.ADMIN_EMAIL || 'technova552026@gmail.com').toLowerCase().trim();

  if (gmailClientId && gmailClientSecret && gmailRefreshToken) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: adminEmail,
        clientId: gmailClientId,
        clientSecret: gmailClientSecret,
        refreshToken: gmailRefreshToken,
      },
    });
  } else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return null;
};

// Dispatch a single email and record result into EmailLogs
const sendEmail = async ({ to, subject, template, html, metadata = {} }) => {
  const fromEmail = (process.env.ADMIN_EMAIL || 'technova552026@gmail.com').toLowerCase().trim();
  let emailStatus = 'SENT';
  let errorMessage = '';
  const transporter = getTransporter();

  try {
    if (transporter) {
      await transporter.sendMail({
        from: `"Enterprise DMS" <${fromEmail}>`,
        to,
        subject,
        html,
      });
      console.log(`[Email] Dispatched email to ${to} (${subject})`);
    } else {
      emailStatus = 'SIMULATED';
      console.log(`[Email Simulated] To: ${to} | Subject: ${subject}`);
    }
  } catch (err) {
    console.error(`[Email Error] Failed to send email to ${to}:`, err.message);
    emailStatus = 'FAILED';
    errorMessage = err.message;
  }

  // Record in EmailLogs collection in MongoDB
  try {
    await EmailLog.create({
      recipient: to,
      subject,
      template,
      status: emailStatus,
      error: errorMessage,
      metadata,
    });
  } catch (logErr) {
    console.error('[EmailLog Error]', logErr.message);
  }

  return { success: emailStatus !== 'FAILED', status: emailStatus, recipient: to, error: errorMessage };
};

// Dual-Admin Dispatch Engine: Sends independently to all configured administrators
// Guarantees that failure for one administrator does not block delivery to the other
const sendToAllAdmins = async ({ subject, template, html, metadata = {} }) => {
  const adminRecipients = getAdminEmails();
  const deliveryResults = [];

  for (const adminEmail of adminRecipients) {
    try {
      const res = await sendEmail({
        to: adminEmail,
        subject,
        template,
        html,
        metadata: { ...metadata, targetAdmin: adminEmail },
      });
      deliveryResults.push(res);
    } catch (err) {
      console.error(`[Dual Admin Dispatch Error] Failed for ${adminEmail}:`, err.message);
      deliveryResults.push({
        success: false,
        status: 'FAILED',
        recipient: adminEmail,
        error: err.message,
      });
    }
  }

  return deliveryResults;
};

// Base HTML wrapper with clean black & white enterprise design
const getEmailTemplateWrapper = (title, contentHtml) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body {
      background-color: #f7f7f7;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 40px 20px;
      color: #111111;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e5e5e5;
      padding: 40px;
    }
    .header {
      border-bottom: 2px solid #111111;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: #111111;
      text-transform: uppercase;
    }
    .subtitle {
      font-size: 13px;
      color: #777777;
      margin-top: 4px;
    }
    .content {
      font-size: 15px;
      line-height: 1.6;
      color: #222222;
    }
    .btn {
      display: inline-block;
      background: #111111;
      color: #ffffff !important;
      padding: 12px 28px;
      text-decoration: none;
      font-weight: 500;
      font-size: 14px;
      margin-top: 20px;
      border-radius: 2px;
    }
    .btn-secondary {
      display: inline-block;
      background: #ffffff;
      color: #111111 !important;
      border: 1px solid #111111;
      padding: 11px 24px;
      text-decoration: none;
      font-weight: 500;
      font-size: 14px;
      margin-top: 20px;
      margin-left: 10px;
      border-radius: 2px;
    }
    .footer {
      border-top: 1px solid #eeeeee;
      margin-top: 40px;
      padding-top: 20px;
      font-size: 12px;
      color: #888888;
    }
    .info-box {
      background: #fafafa;
      border: 1px solid #e5e5e5;
      padding: 16px;
      margin: 20px 0;
      font-size: 14px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">DOCUMENT MANAGEMENT SYSTEM</div>
      <div class="subtitle">Enterprise Engineering Document Library — Administration</div>
    </div>
    <div class="content">
      ${contentHtml}
    </div>
    <div class="footer">
      This is an automated dual-admin notification from the Enterprise DMS platform. Confidential & Proprietary.
    </div>
  </div>
</body>
</html>
`;

// 1. Dual Admin Notification: New Access Request
const notifyAdminNewRequest = async (request) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const requestsUrl = `${frontendUrl}/admin/requests`;
  const dashboardUrl = `${frontendUrl}/admin`;

  const requestedAccess = request.assignedFolders?.length
    ? `${request.assignedFolders.length} Specific Library Folder(s)`
    : (request.requestedFolders?.length ? request.requestedFolders.join(', ') : 'All Technical Manuals & DOConCD Repositories');

  const requestDate = request.createdAt ? new Date(request.createdAt).toLocaleString() : new Date().toLocaleString();

  const html = getEmailTemplateWrapper(
    'New Access Request Received',
    `
    <h2 style="font-size: 20px; font-weight: 600; margin-top: 0;">New Document Library Access Request</h2>
    <p>A new applicant has submitted a document repository access request requiring administrator review:</p>
    
    <div class="info-box">
      <strong>Applicant Name:</strong> ${request.name}<br>
      <strong>Applicant Gmail / Email:</strong> ${request.email}<br>
      <strong>Request Date & Time:</strong> ${requestDate}<br>
      <strong>Organization:</strong> ${request.organization || 'N/A'}<br>
      <strong>Department:</strong> ${request.department || 'N/A'}<br>
      <strong>Reason for Access:</strong> ${request.reason}<br>
      <strong>Intended Purpose:</strong> ${request.purpose}<br>
      <strong>Requested Folder / Document Access:</strong> ${requestedAccess}
    </div>

    <p style="margin-top: 20px;">
      Both administrators have been notified. You can review and action this request directly in the secure Admin Portal:
    </p>

    <div style="margin-top: 25px;">
      <a href="${requestsUrl}" class="btn">Review & Approve in Admin Panel</a>
      <a href="${requestsUrl}" class="btn-secondary">Reject Request</a>
    </div>

    <p style="font-size: 12px; color: #777777; margin-top: 25px;">
      Quick Links: <a href="${dashboardUrl}" style="color: #111111; text-decoration: underline;">Admin Overview Dashboard</a> | <a href="${requestsUrl}" style="color: #111111; text-decoration: underline;">Pending Access Queue</a>
    </p>
    `
  );

  return sendToAllAdmins({
    subject: `[DMS Access Request] ${request.name} (${request.email})`,
    template: 'ADMIN_ACCESS_REQUEST_ALERT',
    html,
    metadata: {
      requestId: request._id,
      applicantName: request.name,
      applicantEmail: request.email,
      dualAdmin: true,
    },
  });
};

// 2. Dual Admin Notification: New User Registration Request
const notifyAdminNewUserRegistration = async (user) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const usersUrl = `${frontendUrl}/admin/users`;

  const html = getEmailTemplateWrapper(
    'New User Registered',
    `
    <h2 style="font-size: 20px; font-weight: 600; margin-top: 0;">New User Registered via Google OAuth</h2>
    <p>A new user has authenticated with the DMS platform and is currently in <code>PENDING_REQUEST</code> status:</p>
    
    <div class="info-box">
      <strong>User Name:</strong> ${user.name}<br>
      <strong>Google Account:</strong> ${user.email}<br>
      <strong>Registered At:</strong> ${new Date().toLocaleString()}<br>
      <strong>Status:</strong> ${user.status}
    </div>

    <p>The user has been prompted to submit an access justification form.</p>
    <a href="${usersUrl}" class="btn">View User Directory</a>
    `
  );

  return sendToAllAdmins({
    subject: `[DMS User Registration] ${user.name} (${user.email})`,
    template: 'ADMIN_NEW_USER_ALERT',
    html,
    metadata: { userId: user._id, userEmail: user.email },
  });
};

// 3. Dual Admin Notification: Important Security Alert
const notifyAdminSecurityAlert = async ({ action, target, user, ip, details = {} }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const auditUrl = `${frontendUrl}/admin/audit-logs`;

  const html = getEmailTemplateWrapper(
    'Security Alert',
    `
    <h2 style="font-size: 20px; font-weight: 600; margin-top: 0; color: #111111;">Security Alert — Attention Required</h2>
    <p>A high-priority security event or unauthorized privilege access attempt was detected by the DMS policy engine:</p>
    
    <div class="info-box" style="border-left: 3px solid #111111;">
      <strong>Action Detected:</strong> ${action}<br>
      <strong>User / Origin:</strong> ${user?.email || 'Unauthenticated / Anonymous'}<br>
      <strong>Target Resource:</strong> ${target || 'Restricted System API'}<br>
      <strong>Origin IP:</strong> ${ip || 'Local / Internal'}<br>
      <strong>Timestamp:</strong> ${new Date().toLocaleString()}<br>
      <strong>Incident Details:</strong> ${JSON.stringify(details)}
    </div>

    <p>Please review the audit log for comprehensive telemetry and take defensive actions if necessary.</p>
    <a href="${auditUrl}" class="btn">Inspect Audit Logs</a>
    `
  );

  return sendToAllAdmins({
    subject: `[DMS Security Alert] ${action} detected`,
    template: 'ADMIN_SECURITY_ALERT',
    html,
    metadata: { action, target, userEmail: user?.email, details },
  });
};

// 4. Dual Admin Notification: Document Migration Failure
const notifyAdminMigrationFailure = async ({ migrationName, error, details = {} }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const migrationUrl = `${frontendUrl}/admin`;

  const html = getEmailTemplateWrapper(
    'Migration Error',
    `
    <h2 style="font-size: 20px; font-weight: 600; margin-top: 0;">Document Migration Task Encountered an Issue</h2>
    <p>An automated catalogue migration or folder ingestion task failed during processing:</p>
    
    <div class="info-box">
      <strong>Migration Batch:</strong> ${migrationName || 'Siemens DOConCD Ingestion'}<br>
      <strong>Error Message:</strong> ${error || 'Unknown error'}<br>
      <strong>Timestamp:</strong> ${new Date().toLocaleString()}<br>
      <strong>Telemetry:</strong> ${JSON.stringify(details)}
    </div>

    <p>Check the admin console and retry failed uploads once file accessibility is confirmed.</p>
    <a href="${migrationUrl}" class="btn">View Migration Status</a>
    `
  );

  return sendToAllAdmins({
    subject: `[DMS Migration Failure] ${migrationName || 'Catalogue Task'} Error`,
    template: 'ADMIN_MIGRATION_FAILURE_ALERT',
    html,
    metadata: { migrationName, error, details },
  });
};

// 5. Dual Admin Notification: Storage Upload Failure
const notifyAdminUploadFailure = async ({ fileName, folderName, error, user }) => {
  const html = getEmailTemplateWrapper(
    'Upload Failure Alert',
    `
    <h2 style="font-size: 20px; font-weight: 600; margin-top: 0;">Repository File Upload Failure</h2>
    <p>A document upload operation failed during streaming to Cloudinary storage:</p>
    
    <div class="info-box">
      <strong>File:</strong> ${fileName}<br>
      <strong>Folder:</strong> ${folderName || 'Root'}<br>
      <strong>Attempted By:</strong> ${user?.email || 'Authorized User'}<br>
      <strong>Error Message:</strong> ${error || 'Storage timeout or socket rejection'}<br>
      <strong>Timestamp:</strong> ${new Date().toLocaleString()}
    </div>
    `
  );

  return sendToAllAdmins({
    subject: `[DMS Storage Alert] Upload Failure for ${fileName}`,
    template: 'ADMIN_UPLOAD_FAILURE_ALERT',
    html,
    metadata: { fileName, folderName, error },
  });
};

// 6. Dual Admin Notification: Important System Error
const notifyAdminSystemError = async ({ errorName, message, path }) => {
  const html = getEmailTemplateWrapper(
    'System Error',
    `
    <h2 style="font-size: 20px; font-weight: 600; margin-top: 0;">Critical System Exception Logged</h2>
    <p>An unhandled exception occurred in the DMS application runtime:</p>
    
    <div class="info-box">
      <strong>Error Name:</strong> ${errorName || 'InternalServerError'}<br>
      <strong>Message:</strong> ${message}<br>
      <strong>Route / Path:</strong> ${path || 'API'}<br>
      <strong>Timestamp:</strong> ${new Date().toLocaleString()}
    </div>
    `
  );

  return sendToAllAdmins({
    subject: `[DMS System Alert] ${errorName || 'Error'}: ${message?.slice(0, 50)}`,
    template: 'ADMIN_SYSTEM_ERROR_ALERT',
    html,
    metadata: { errorName, message, path },
  });
};

// 7. User-Facing Notification: Access Request Approved (Goes ONLY to requesting user)
const notifyUserApproved = async (user, permissions, assignedFolders = []) => {
  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;

  const permItems = [];
  if (permissions.read) permItems.push('Read Documents (Browse Catalogue & Preview)');
  if (permissions.upload) permItems.push('Upload Documents');
  if (permissions.download) permItems.push('Download Documents');
  if (permissions.manage) permItems.push('Manage Documents / Folders');

  const html = getEmailTemplateWrapper(
    'Access Request Approved',
    `
    <h2 style="font-size: 20px; font-weight: 600; margin-top: 0;">Access Request Approved</h2>
    <p>Hello <strong>${user.name}</strong>,</p>
    <p>Your access request to the Enterprise Document Management System has been <strong>approved</strong> by an administrator.</p>
    
    <div class="info-box">
      <strong>Granted Permissions:</strong>
      <ul style="margin: 8px 0 0 20px; padding: 0;">
        ${permItems.map((p) => `<li>${p}</li>`).join('')}
      </ul>
      ${
        assignedFolders.length > 0
          ? `<p style="margin-top: 10px;"><strong>Assigned Folders:</strong> ${assignedFolders.length} library folders granted</p>`
          : '<p style="margin-top: 10px;"><strong>Folder Access:</strong> Standard authorized repository folders</p>'
      }
    </div>
    <p>You can now sign in with your Google account to access your permitted documents.</p>
    <a href="${loginUrl}" class="btn">Sign In to Document Library</a>
    `
  );

  return sendEmail({
    to: user.email,
    subject: 'Your Access to Enterprise DMS has been Approved',
    template: 'USER_ACCESS_APPROVED',
    html,
    metadata: { userId: user._id, permissions },
  });
};

// 8. User-Facing Notification: Access Request Rejected (Goes ONLY to requesting user)
const notifyUserRejected = async (user, reason) => {
  const html = getEmailTemplateWrapper(
    'Access Request Update',
    `
    <h2 style="font-size: 20px; font-weight: 600; margin-top: 0;">Access Request Update</h2>
    <p>Hello <strong>${user.name}</strong>,</p>
    <p>Thank you for your interest in accessing the Enterprise Document Management System. After reviewing your request, the administrator was unable to approve it at this time.</p>
    
    ${
      reason
        ? `
    <div class="info-box">
      <strong>Administrator Feedback / Reason:</strong><br>
      ${reason}
    </div>`
        : ''
    }
    
    <p>If you believe this is in error or your requirements have changed, please contact your organization administrator.</p>
    `
  );

  return sendEmail({
    to: user.email,
    subject: 'Enterprise DMS Access Request Status',
    template: 'USER_ACCESS_REJECTED',
    html,
    metadata: { userId: user._id, reason },
  });
};

// 9. User-Facing Notification: Permissions Updated (Goes ONLY to requesting user)
const notifyPermissionsUpdated = async (user, permissions) => {
  const html = getEmailTemplateWrapper(
    'Permissions Updated',
    `
    <h2 style="font-size: 20px; font-weight: 600; margin-top: 0;">Document Access Permissions Updated</h2>
    <p>Hello <strong>${user.name}</strong>,</p>
    <p>An administrator has updated your access permissions in the Document Management System.</p>
    <div class="info-box">
      <strong>Current Permissions:</strong>
      <ul style="margin: 8px 0 0 20px; padding: 0;">
        <li>Read Access: <strong>${permissions.read ? 'Enabled' : 'Disabled'}</strong></li>
        <li>Upload Access: <strong>${permissions.upload ? 'Enabled' : 'Disabled'}</strong></li>
        <li>Download Access: <strong>${permissions.download ? 'Enabled' : 'Disabled'}</strong></li>
        <li>Manage Access: <strong>${permissions.manage ? 'Enabled' : 'Disabled'}</strong></li>
      </ul>
    </div>
    `
  );

  return sendEmail({
    to: user.email,
    subject: 'Enterprise DMS Permissions Updated',
    template: 'USER_PERMISSIONS_UPDATED',
    html,
    metadata: { userId: user._id, permissions },
  });
};

// 10. User-Facing Notification: Password Reset Request (Expires in 1 hour)
const notifyPasswordReset = async (user, resetUrl) => {
  const html = getEmailTemplateWrapper(
    'Password Reset Request',
    `
    <h2 style="font-size: 20px; font-weight: 600; margin-top: 0; color: #111111;">Password Reset Request</h2>
    <p>Hello <strong>${user.name || 'User'}</strong>,</p>
    <p style="color: #444444; line-height: 1.6;">
      A request was received to reset the password for your Enterprise Document Management System account (<strong>${user.email}</strong>).
    </p>
    <div style="margin: 28px 0; text-align: center;">
      <a href="${resetUrl}" style="display: inline-block; background-color: #111111; color: #ffffff; text-decoration: none; padding: 12px 28px; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">
        Reset My Password
      </a>
    </div>
    <div class="info-box" style="margin-top: 24px; font-size: 12px; color: #666666; border-left: 3px solid #111111; padding: 12px 16px; background: #fafafa;">
      <p style="margin: 0 0 8px 0;"><strong>Security Notice:</strong></p>
      <p style="margin: 0 0 6px 0;">• This password reset link will expire in <strong>1 hour</strong>.</p>
      <p style="margin: 0 0 6px 0;">• If the button above does not work, copy and paste this link into your browser:</p>
      <p style="margin: 0; word-break: break-all; font-family: monospace; color: #111111;">${resetUrl}</p>
      <p style="margin: 10px 0 0 0; color: #888888;">If you did not request a password reset, please disregard this email. Your password will remain unchanged.</p>
    </div>
    `
  );

  return sendEmail({
    to: user.email,
    subject: '[Enterprise DMS] Password Reset Request',
    template: 'USER_PASSWORD_RESET',
    html,
    metadata: { userId: user._id, email: user.email },
  });
};

// 11. User-Facing Notification: Account Invitation & Activation
const notifyUserInvitation = async (user, setupUrl) => {
  const html = getEmailTemplateWrapper(
    'Account Invitation',
    `
    <h2 style="font-size: 20px; font-weight: 600; margin-top: 0; color: #111111;">Welcome to Enterprise DMS</h2>
    <p>Hello <strong>${user.name || 'User'}</strong>,</p>
    <p style="color: #444444; line-height: 1.6;">
      An administrator has provisioned an account for you on the <strong>Enterprise Document Management System</strong>.
    </p>
    <div style="margin: 28px 0; text-align: center;">
      <a href="${setupUrl}" style="display: inline-block; background-color: #111111; color: #ffffff; text-decoration: none; padding: 12px 28px; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">
        Set Account Password
      </a>
    </div>
    <div class="info-box" style="margin-top: 24px; font-size: 12px; color: #666666; border-left: 3px solid #111111; padding: 12px 16px; background: #fafafa;">
      <p style="margin: 0 0 8px 0;"><strong>Account Details:</strong></p>
      <p style="margin: 0 0 6px 0;">• User Email: <strong>${user.email}</strong></p>
      <p style="margin: 0 0 6px 0;">• Role: <strong>${user.role}</strong></p>
      <p style="margin: 0; word-break: break-all; font-family: monospace; color: #111111;">Activation Link: ${setupUrl}</p>
    </div>
    `
  );

  return sendEmail({
    to: user.email,
    subject: '[Enterprise DMS] Account Invitation & Password Setup',
    template: 'USER_INVITATION',
    html,
    metadata: { userId: user._id, email: user.email },
  });
};

module.exports = {
  ADMIN_EMAILS,
  getAdminEmails,
  sendEmail,
  sendToAllAdmins,
  notifyAdminNewRequest,
  notifyAdminNewUserRegistration,
  notifyAdminSecurityAlert,
  notifyAdminMigrationFailure,
  notifyAdminUploadFailure,
  notifyAdminSystemError,
  notifyUserApproved,
  notifyUserRejected,
  notifyPermissionsUpdated,
  notifyPasswordReset,
  notifyUserInvitation,
};
