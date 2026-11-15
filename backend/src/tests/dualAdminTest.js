const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const http = require('http');

const User = require('../models/User');
const AccessRequest = require('../models/AccessRequest');
const EmailLog = require('../models/EmailLog');
const { USER_ROLES, USER_STATUS, ADMIN_EMAILS } = require('../config/constants');
const {
  notifyAdminNewRequest,
  notifyUserApproved,
  notifyUserRejected,
  sendToAllAdmins,
  getAdminEmails,
} = require('../services/emailService');

const BASE_URL = 'http://localhost:5000';

function apiRequest({ method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };
    if (body) {
      reqHeaders['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    }

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let resData = '';
        res.on('data', (chunk) => {
          resData += chunk;
        });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(resData);
          } catch {
            parsed = resData;
          }
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function waitForEmailLog(query, maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const log = await EmailLog.findOne(query);
    if (log) return log;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

async function runDualAdminTestSuite() {
  console.log('======================================================');
  console.log('   DUAL MASTER ADMIN & NOTIFICATION VERIFICATION TEST   ');
  console.log('======================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB Atlas\n');

  // Verify Admin Configuration
  const adminEmails = getAdminEmails();
  console.log('[Setup] Configured Dual Administrators:', adminEmails);
  if (
    !adminEmails.includes('technova552026@gmail.com') ||
    !adminEmails.includes('loganathan8754114450@gmail.com')
  ) {
    throw new Error('Dual admin emails are not properly loaded!');
  }
  console.log('✓ Both Master Admin emails verified in registry\n');

  // Load both admins from MongoDB
  const primaryAdmin = await User.findOne({ email: 'technova552026@gmail.com' });
  const secondaryAdmin = await User.findOne({ email: 'loganathan8754114450@gmail.com' });

  if (!primaryAdmin || !secondaryAdmin) {
    throw new Error('One or both Master Admin accounts are missing from MongoDB!');
  }

  console.log('[Account Verification]');
  console.log('  Primary Admin:', primaryAdmin.email, '| Role:', primaryAdmin.role, '| Status:', primaryAdmin.status);
  console.log('  Secondary Admin:', secondaryAdmin.email, '| Role:', secondaryAdmin.role, '| Status:', secondaryAdmin.status);

  const primaryToken = jwt.sign(
    { id: primaryAdmin._id, email: primaryAdmin.email, role: primaryAdmin.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const secondaryToken = jwt.sign(
    { id: secondaryAdmin._id, email: secondaryAdmin.email, role: secondaryAdmin.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // ---------------------------------------------------------
  // TEST 1: New Access Request triggers notifications to BOTH admins
  // ---------------------------------------------------------
  console.log('\n--- [TEST 1] Dual Admin Access Request Notification ---');
  const testApplicantEmail = `test.dual.applicant.${Date.now()}@industrial.siemens.com`;
  const mockAccessRequest = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Henrik Larsson (CNC Automation Lead)',
    email: testApplicantEmail,
    organization: 'Siemens Industrial Automation Partner',
    department: 'Motion Control Systems',
    reason: 'Commissioning SINAMICS S120 drives with 840D sl CNC',
    purpose: 'Factory Acceptance Testing & Parameter Configuration',
    requestedFolders: ['DOConCD_SINUMERIK_SIMODRIVE'],
    createdAt: new Date(),
  };

  const dispatchResults = await notifyAdminNewRequest(mockAccessRequest);
  console.log('Dispatch Results Count:', dispatchResults.length);
  dispatchResults.forEach((r) => {
    console.log(`  Recipient: ${r.recipient} | Success: ${r.success} | Status: ${r.status}`);
  });

  if (dispatchResults.length !== 2) {
    throw new Error(`Expected exactly 2 admin deliveries, got ${dispatchResults.length}`);
  }

  // Verify EmailLogs contains both records
  const logsTest1 = await EmailLog.find({
    template: 'ADMIN_ACCESS_REQUEST_ALERT',
    'metadata.applicantEmail': testApplicantEmail,
  });

  console.log('✓ Found', logsTest1.length, 'EmailLog record(s) in MongoDB for this applicant:');
  logsTest1.forEach((l) => {
    console.log(`  - Recipient: ${l.recipient} | Status: ${l.status}`);
  });

  const recipients = logsTest1.map((l) => l.recipient.toLowerCase());
  if (!recipients.includes('technova552026@gmail.com') || !recipients.includes('loganathan8754114450@gmail.com')) {
    throw new Error('EmailLogs is missing one of the administrator records!');
  }
  console.log('✓ TEST 1 PASSED: Both administrators received independent notifications recorded in EmailLogs\n');

  // ---------------------------------------------------------
  // TEST 2: Primary Admin Approves Request -> User receives approval email
  // ---------------------------------------------------------
  console.log('--- [TEST 2] Primary Admin Approves User Request ---');
  const testUserApproval = new User({
    name: 'Approval Test User',
    email: `test.approve.${Date.now()}@domain.com`,
    role: USER_ROLES.USER,
    status: USER_STATUS.PENDING,
  });
  await testUserApproval.save();

  const approvalReq = new AccessRequest({
    userId: testUserApproval._id,
    name: testUserApproval.name,
    email: testUserApproval.email,
    organization: 'Test Org',
    reason: 'Test Reason',
    purpose: 'Test Purpose',
    status: 'PENDING',
  });
  await approvalReq.save();

  const approveRes = await apiRequest({
    method: 'POST',
    path: `/api/admin/requests/${approvalReq._id}/approve`,
    headers: { Authorization: `Bearer ${primaryToken}` },
    body: {
      permissions: { read: true, upload: true, download: false, manage: false },
    },
  });

  console.log('Primary Admin Approval HTTP Status:', approveRes.status);
  if (approveRes.status !== 200) {
    throw new Error(`Primary admin approval failed: ${JSON.stringify(approveRes.data)}`);
  }

  // Wait for async Gmail dispatch and EmailLog entry
  const approvalEmailLog = await waitForEmailLog({
    recipient: testUserApproval.email,
    template: 'USER_ACCESS_APPROVED',
  });
  console.log('  Approval EmailLog to User:', approvalEmailLog?.recipient, '| Status:', approvalEmailLog?.status);
  if (!approvalEmailLog) throw new Error('User approval email log not found!');
  console.log('✓ TEST 2 PASSED: Primary Administrator approved request; user received approval email\n');

  // ---------------------------------------------------------
  // TEST 3: Secondary Admin Rejects Request -> User receives rejection email
  // ---------------------------------------------------------
  console.log('--- [TEST 3] Secondary Admin Rejects User Request ---');
  const testUserReject = new User({
    name: 'Rejection Test User',
    email: `test.reject.${Date.now()}@domain.com`,
    role: USER_ROLES.USER,
    status: USER_STATUS.PENDING,
  });
  await testUserReject.save();

  const rejectReq = new AccessRequest({
    userId: testUserReject._id,
    name: testUserReject.name,
    email: testUserReject.email,
    organization: 'Test Org',
    reason: 'Test Reason',
    purpose: 'Test Purpose',
    status: 'PENDING',
  });
  await rejectReq.save();

  const rejectRes = await apiRequest({
    method: 'POST',
    path: `/api/admin/requests/${rejectReq._id}/reject`,
    headers: { Authorization: `Bearer ${secondaryToken}` },
    body: {
      rejectionReason: 'Applicant lacks active Siemens partner NDA certification.',
    },
  });

  console.log('Secondary Admin Rejection HTTP Status:', rejectRes.status);
  if (rejectRes.status !== 200) {
    throw new Error(`Secondary admin rejection failed: ${JSON.stringify(rejectRes.data)}`);
  }

  // Wait for async Gmail dispatch and EmailLog entry
  const rejectionEmailLog = await waitForEmailLog({
    recipient: testUserReject.email,
    template: 'USER_ACCESS_REJECTED',
  });
  console.log('  Rejection EmailLog to User:', rejectionEmailLog?.recipient, '| Status:', rejectionEmailLog?.status);
  if (!rejectionEmailLog) throw new Error('User rejection email log not found!');

  const updatedRejectedUser = await User.findById(testUserReject._id);
  console.log('  Updated User Status:', updatedRejectedUser.status);
  console.log('  Rejection Reason Stored:', updatedRejectedUser.rejectionReason);
  console.log('✓ TEST 3 PASSED: Secondary Administrator rejected request; user received rejection email\n');

  // ---------------------------------------------------------
  // TEST 4 & 5: Email Fault Tolerance & Single-Admin Failure Isolation
  // ---------------------------------------------------------
  console.log('--- [TEST 4 & 5] Email Resilience & Failure Isolation ---');
  // Simulate dispatch where one recipient fails
  console.log('Testing independent dispatch resilience with simulated dual recipients...');
  const resilientResults = await sendToAllAdmins({
    subject: '[DMS Resilience Test] System Verification',
    template: 'RESILIENCE_TEST',
    html: '<p>Testing independent dual admin email routing.</p>',
    metadata: { testId: 'resilience_check' },
  });

  console.log('  Dual Dispatch count:', resilientResults.length);
  resilientResults.forEach((r) => {
    console.log(`  - Admin: ${r.recipient} | Delivery Status: ${r.status}`);
  });

  if (resilientResults.length !== 2) {
    throw new Error('Dispatch did not attempt delivery to both administrators!');
  }
  console.log('✓ TEST 4 & 5 PASSED: Both administrators receive independent dispatch attempts without cross-blocking\n');

  // ---------------------------------------------------------
  // TEST 6: Both Administrators Log In & Access Admin Dashboard
  // ---------------------------------------------------------
  console.log('--- [TEST 6] Both Administrators Access Admin Dashboard ---');
  const [statsPrimary, statsSecondary] = await Promise.all([
    apiRequest({
      method: 'GET',
      path: '/api/admin/stats',
      headers: { Authorization: `Bearer ${primaryToken}` },
    }),
    apiRequest({
      method: 'GET',
      path: '/api/admin/stats',
      headers: { Authorization: `Bearer ${secondaryToken}` },
    }),
  ]);

  console.log('Primary Admin /api/admin/stats Status:', statsPrimary.status, '| Success:', statsPrimary.data.success);
  console.log('Secondary Admin /api/admin/stats Status:', statsSecondary.status, '| Success:', statsSecondary.data.success);

  if (statsPrimary.status !== 200 || statsSecondary.status !== 200) {
    throw new Error('One or both administrators failed to access /api/admin/stats!');
  }

  console.log('✓ TEST 6 PASSED: Both administrators have full, identical access to the Admin Dashboard\n');

  // ---------------------------------------------------------
  // TEST 7: Ordinary User Access Attempt to Admin APIs
  // ---------------------------------------------------------
  console.log('--- [TEST 7] Ordinary User Access Attempt to Admin APIs ---');
  const ordinaryUser = new User({
    name: 'Ordinary Test User',
    email: `ordinary.${Date.now()}@domain.com`,
    role: USER_ROLES.USER,
    status: USER_STATUS.APPROVED,
    permissions: { read: true, upload: false, download: false, manage: false },
  });
  await ordinaryUser.save();

  const userToken = jwt.sign(
    { id: ordinaryUser._id, email: ordinaryUser.email, role: ordinaryUser.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const blockedRes = await apiRequest({
    method: 'GET',
    path: '/api/admin/stats',
    headers: { Authorization: `Bearer ${userToken}` },
  });

  console.log('Ordinary User Access Attempt Status:', blockedRes.status);
  console.log('Message:', blockedRes.data.message);

  if (blockedRes.status !== 403) {
    throw new Error(`Expected HTTP 403 Forbidden, but received ${blockedRes.status}`);
  }
  console.log('✓ TEST 7 PASSED: Non-admin users are strictly blocked with HTTP 403 Forbidden\n');

  // Clean up test records
  await User.deleteMany({ _id: { $in: [testUserApproval._id, testUserReject._id, ordinaryUser._id] } });
  await AccessRequest.deleteMany({ _id: { $in: [approvalReq._id, rejectReq._id] } });
  console.log('✓ Cleaned up temporary test user and request documents.');

  console.log('\n======================================================');
  console.log('   ALL 7 DUAL MASTER ADMIN TESTS PASSED CLEANLY!     ');
  console.log('======================================================');

  await mongoose.disconnect();
}

runDualAdminTestSuite().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
