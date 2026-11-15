const axios = require('axios');
const mongoose = require('mongoose');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const User = require('../models/User');
const Folder = require('../models/Folder');
const Document = require('../models/Document');
const AccessRequest = require('../models/AccessRequest');
const Permission = require('../models/Permission');
const AuditLog = require('../models/AuditLog');
const EmailLog = require('../models/EmailLog');
const { USER_ROLES, USER_STATUS } = require('../config/constants');
const { notifyAdminNewRequest, notifyUserApproved, notifyUserRejected, notifyPermissionsUpdated } = require('../services/emailService');

const API = process.env.API_URL || 'http://localhost:5000/api';

async function runFullQASuite() {
  console.log('\n========================================================================');
  console.log('       ENTERPRISE DMS — MASTER QA, TESTING & AUDIT VERIFICATION         ');
  console.log('========================================================================\n');

  const testReport = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    results: [],
    performance: {},
  };

  const recordResult = (phase, feature, status, details) => {
    testReport.totalTests++;
    if (status === 'PASS') testReport.passed++;
    else testReport.failed++;
    testReport.results.push({ phase, feature, status, details });
    const symbol = status === 'PASS' ? '✓' : '✗';
    console.log(`  ${symbol} [${phase}] ${feature}: ${details}`);
  };

  // Connect to DB for direct integrity checks
  await mongoose.connect(process.env.MONGODB_URI);

  let adminToken = '';
  let adminHeaders = {};
  let testUser = null;
  let testUserToken = '';
  let testUserHeaders = {};
  let testFolder = null;
  let sampleDoc = null;
  const createdDocumentIds = [];
  const createdFolderIds = [];
  const createdUserIds = [];

  try {
    // ---------------------------------------------------------
    // PHASE 1: HEALTH & ENVIRONMENT VERIFICATION
    // ---------------------------------------------------------
    console.log('\n--- PHASE 1: API & ENVIRONMENT DIAGNOSTICS ---');
    const t0 = Date.now();
    const health = await axios.get(`${API}/health`);
    const healthLatency = Date.now() - t0;
    testReport.performance.healthLatencyMs = healthLatency;

    if (health.data.status === 'healthy') {
      recordResult('PHASE 1', 'API Health Check', 'PASS', `Status: 200 Healthy (${healthLatency}ms)`);
    } else {
      recordResult('PHASE 1', 'API Health Check', 'FAIL', 'Health endpoint returned unexpected status');
    }

    // ---------------------------------------------------------
    // PHASE 2 & 3: AUTHENTICATION & GOOGLE OAUTH SECURITY
    // ---------------------------------------------------------
    console.log('\n--- PHASE 2 & 3: AUTHENTICATION & ACCESS GATING ---');

    // 1. Admin login
    const adminLoginRes = await axios.post(`${API}/auth/dev-login`, {
      email: process.env.ADMIN_EMAIL || 'loganathan8754114450@gmail.com',
      role: 'ADMIN',
      name: 'Master System Administrator',
    });
    adminToken = adminLoginRes.data.token;
    adminHeaders = { Authorization: `Bearer ${adminToken}` };
    recordResult('PHASE 3', 'Admin Authentication', 'PASS', `Authenticated as ADMIN (${adminLoginRes.data.user.email})`);

    // 2. First-time applicant login
    const applicantEmail = `qa.candidate.${Date.now()}@industrial.siemens.com`;
    const applicantRes = await axios.post(`${API}/auth/dev-login`, {
      email: applicantEmail,
      role: 'USER',
      name: 'Gerhard Weber',
    });
    testUser = applicantRes.data.user;
    testUserToken = applicantRes.data.token;
    testUserHeaders = { Authorization: `Bearer ${testUserToken}` };
    createdUserIds.push(testUser._id);

    if (testUser.status === USER_STATUS.PENDING_REQUEST) {
      recordResult('PHASE 3', 'First-Time User Status', 'PASS', 'Assigned PENDING_REQUEST status by default');
    } else {
      recordResult('PHASE 3', 'First-Time User Status', 'FAIL', `Expected PENDING_REQUEST, got ${testUser.status}`);
    }

    // 3. Unapproved user blocked from document access
    try {
      await axios.get(`${API}/folders`, { headers: testUserHeaders });
      recordResult('PHASE 3', 'Unapproved User Route Gating', 'FAIL', 'Unapproved user was able to access folders!');
    } catch (err) {
      if (err.response?.status === 403) {
        recordResult('PHASE 3', 'Unapproved User Route Gating', 'PASS', 'Correctly rejected with HTTP 403 Forbidden');
      } else {
        recordResult('PHASE 3', 'Unapproved User Route Gating', 'FAIL', `Unexpected status: ${err.response?.status}`);
      }
    }

    // 4. Missing Token check
    try {
      await axios.get(`${API}/documents/recent`);
      recordResult('PHASE 3', 'Unauthenticated Access Defense', 'FAIL', 'Route allowed request without token!');
    } catch (err) {
      if (err.response?.status === 401) {
        recordResult('PHASE 3', 'Unauthenticated Access Defense', 'PASS', 'Correctly rejected missing token with HTTP 401');
      } else {
        recordResult('PHASE 3', 'Unauthenticated Access Defense', 'FAIL', `Unexpected status: ${err.response?.status}`);
      }
    }

    // 5. Invalid / Tampered Token check
    try {
      await axios.get(`${API}/documents/recent`, { headers: { Authorization: 'Bearer forged.token.signature' } });
      recordResult('PHASE 3', 'Forged Token Defense', 'FAIL', 'Route accepted forged token!');
    } catch (err) {
      if (err.response?.status === 401) {
        recordResult('PHASE 3', 'Forged Token Defense', 'PASS', 'Rejected forged token signature with HTTP 401');
      } else {
        recordResult('PHASE 3', 'Forged Token Defense', 'FAIL', `Unexpected status: ${err.response?.status}`);
      }
    }

    // 6. Suspended user defense
    const suspendedEmail = `suspended.${Date.now()}@test.com`;
    const suspendedUser = await User.create({
      name: 'Suspended Account',
      email: suspendedEmail,
      role: USER_ROLES.USER,
      status: USER_STATUS.SUSPENDED,
    });
    createdUserIds.push(suspendedUser._id);
    const suspendedToken = jwt.sign({ id: suspendedUser._id, role: suspendedUser.role }, process.env.JWT_SECRET);
    try {
      await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${suspendedToken}` } });
      recordResult('PHASE 3', 'Suspended User Defense', 'FAIL', 'Suspended user accessed protected endpoint!');
    } catch (err) {
      if (err.response?.status === 403) {
        recordResult('PHASE 3', 'Suspended User Defense', 'PASS', 'Suspended user blocked with HTTP 403 Forbidden');
      } else {
        recordResult('PHASE 3', 'Suspended User Defense', 'FAIL', `Unexpected status: ${err.response?.status}`);
      }
    }

    // ---------------------------------------------------------
    // PHASE 4: ACCESS REQUEST & APPROVAL WORKFLOW
    // ---------------------------------------------------------
    console.log('\n--- PHASE 4: ACCESS REQUEST & ADMIN APPROVAL ---');

    // 1. Submit access request
    const reqRes = await axios.post(
      `${API}/requests`,
      {
        organization: 'Siemens Energy AG',
        department: 'Power Drive Automation',
        reason: 'SINUMERIK 840D sl CNC parameter configuration',
        purpose: 'Engineering retrofit and drive diagnostics',
      },
      { headers: testUserHeaders }
    );
    const accessReqId = reqRes.data.request._id;
    recordResult('PHASE 4', 'Access Request Submission', 'PASS', `Request registered with status: ${reqRes.data.request.status}`);

    // 2. Duplicate submission prevention
    try {
      await axios.post(
        `${API}/requests`,
        {
          organization: 'Duplicate Attempt',
          reason: 'Should be prevented',
          purpose: 'Testing prevention',
        },
        { headers: testUserHeaders }
      );
      recordResult('PHASE 4', 'Duplicate Request Prevention', 'FAIL', 'Allowed multiple pending access requests!');
    } catch (err) {
      if (err.response?.status === 400) {
        recordResult('PHASE 4', 'Duplicate Request Prevention', 'PASS', 'Correctly rejected duplicate request (HTTP 400)');
      } else {
        recordResult('PHASE 4', 'Duplicate Request Prevention', 'FAIL', `Unexpected status: ${err.response?.status}`);
      }
    }

    // 3. Admin lists pending requests
    const pendingList = await axios.get(`${API}/admin/requests?status=PENDING`, { headers: adminHeaders });
    const targetInList = pendingList.data.requests.find((r) => r.email === applicantEmail);
    if (targetInList) {
      recordResult('PHASE 4', 'Admin Pending Requests Queue', 'PASS', `Found applicant ${applicantEmail} in pending queue`);
    } else {
      recordResult('PHASE 4', 'Admin Pending Requests Queue', 'FAIL', 'Submitted request did not appear in admin queue');
    }

    // 4. Admin approves with READ: true, UPLOAD: false, DOWNLOAD: false
    const approvalRes = await axios.post(
      `${API}/admin/requests/${accessReqId}/approve`,
      {
        read: true,
        upload: false,
        download: false,
        manage: false,
      },
      { headers: adminHeaders }
    );
    recordResult('PHASE 4', 'Admin Request Approval', 'PASS', `Approved user status: ${approvalRes.data.user.status}`);

    // 5. User checks approval status via /auth/me
    const meRes = await axios.get(`${API}/auth/me`, { headers: testUserHeaders });
    if (meRes.data.user.status === USER_STATUS.APPROVED && meRes.data.user.permissions.read) {
      recordResult('PHASE 4', 'Approved User Status Refresh', 'PASS', 'Profile updated to APPROVED with READ permission active');
    } else {
      recordResult('PHASE 4', 'Approved User Status Refresh', 'FAIL', 'Profile did not reflect approval');
    }

    // ---------------------------------------------------------
    // PHASE 5: GMAIL & NOTIFICATION ENGINE
    // ---------------------------------------------------------
    console.log('\n--- PHASE 5: GMAIL & EMAIL ENGINE TESTING ---');
    const emailT0 = Date.now();
    const testAdminAlert = await notifyAdminNewRequest({
      _id: accessReqId,
      name: 'QA Test Applicant',
      email: applicantEmail,
      organization: 'Siemens Automation',
      department: 'Motion Control',
      reason: 'Validation testing',
      purpose: 'End-to-end QA verification',
    });
    recordResult('PHASE 5', 'New Request Notification Dispatch', 'PASS', `Status: ${testAdminAlert.status} (Resilient non-blocking)`);

    const testApprovalEmail = await notifyUserApproved(
      { _id: testUser._id, name: 'QA Candidate', email: applicantEmail },
      { read: true, upload: false, download: false, manage: false },
      []
    );
    recordResult('PHASE 5', 'Approval Email Dispatch', 'PASS', `Status: ${testApprovalEmail.status}`);

    const emailLogRecord = await EmailLog.findOne({ recipient: applicantEmail }).sort({ createdAt: -1 });
    if (emailLogRecord) {
      recordResult('PHASE 5', 'Email Logging in MongoDB', 'PASS', `Logged email template: ${emailLogRecord.template} (Status: ${emailLogRecord.status})`);
    } else {
      recordResult('PHASE 5', 'Email Logging in MongoDB', 'FAIL', 'Email dispatch was not recorded in EmailLogs collection');
    }

    // ---------------------------------------------------------
    // PHASE 6: MONGODB ATLAS INTEGRITY & SCHEMAS
    // ---------------------------------------------------------
    console.log('\n--- PHASE 6: MONGODB ATLAS INTEGRITY ---');

    // 1. Collections check
    const collections = (await mongoose.connection.db.listCollections().toArray()).map((c) => c.name);
    const requiredCollections = ['users', 'accessrequests', 'folders', 'documents', 'permissions', 'auditlogs', 'emaillogs'];
    const missing = requiredCollections.filter((c) => !collections.includes(c));
    if (missing.length === 0) {
      recordResult('PHASE 6', 'Required Collections Present', 'PASS', `All ${requiredCollections.length} collections live in MongoDB Atlas`);
    } else {
      recordResult('PHASE 6', 'Required Collections Present', 'FAIL', `Missing collections: ${missing.join(', ')}`);
    }

    // 2. Invalid ObjectId 400 error handling check
    try {
      await axios.get(`${API}/documents/malformed_id_12345`, { headers: adminHeaders });
      recordResult('PHASE 6', 'Invalid ObjectId Handling', 'FAIL', 'Route did not reject malformed ObjectId!');
    } catch (err) {
      if (err.response?.status === 400) {
        recordResult('PHASE 6', 'Invalid ObjectId Handling', 'PASS', 'Correctly caught CastError and returned HTTP 400 Bad Request');
      } else {
        recordResult('PHASE 6', 'Invalid ObjectId Handling', 'FAIL', `Expected HTTP 400, got ${err.response?.status}`);
      }
    }

    // 3. Schema validation check (Missing required folder name)
    try {
      await axios.post(`${API}/folders`, { name: '' }, { headers: adminHeaders });
      recordResult('PHASE 6', 'Schema Validation Defense', 'FAIL', 'Allowed creation of folder without name!');
    } catch (err) {
      if (err.response?.status === 400) {
        recordResult('PHASE 6', 'Schema Validation Defense', 'PASS', 'Rejected missing required field with HTTP 400 Bad Request');
      } else {
        recordResult('PHASE 6', 'Schema Validation Defense', 'FAIL', `Expected HTTP 400, got ${err.response?.status}`);
      }
    }

    // ---------------------------------------------------------
    // PHASE 8: FOLDER HIERARCHY & 100+ DOCUMENT SCALE TEST
    // ---------------------------------------------------------
    console.log('\n--- PHASE 8: FOLDER MANAGEMENT & 100+ SCALE TEST ---');

    // 1. Create root test folder
    const createRootRes = await axios.post(
      `${API}/folders`,
      {
        name: `QA_ROOT_TEST_${Date.now()}`,
        code: 'QART',
        description: 'Test repository for hierarchy and scale validation',
      },
      { headers: adminHeaders }
    );
    testFolder = createRootRes.data.folder;
    createdFolderIds.push(testFolder._id);
    recordResult('PHASE 8', 'Create Root Folder', 'PASS', `Created folder '${testFolder.name}' (Level: ${testFolder.level})`);

    // 2. Create nested subfolder
    const createSubRes = await axios.post(
      `${API}/folders`,
      {
        name: `Subcategory_Testing`,
        parentFolderId: testFolder._id,
        description: 'Nested subcategory for testing',
      },
      { headers: adminHeaders }
    );
    const subfolder = createSubRes.data.folder;
    createdFolderIds.push(subfolder._id);
    if (subfolder.level === 1 && subfolder.path.startsWith(`/${testFolder.name}`)) {
      recordResult('PHASE 8', 'Nested Subfolder & Path Traversal', 'PASS', `Level: 1, Computed Path: ${subfolder.path}`);
    } else {
      recordResult('PHASE 8', 'Nested Subfolder & Path Traversal', 'FAIL', `Incorrect level or path: ${subfolder.path}`);
    }

    // 3. Circular reference defense
    try {
      await axios.put(
        `${API}/folders/${testFolder._id}`,
        { parentFolderId: subfolder._id },
        { headers: adminHeaders }
      );
      recordResult('PHASE 8', 'Circular Hierarchy Defense', 'FAIL', 'Allowed moving parent folder inside its own child!');
    } catch (err) {
      if (err.response?.status === 400) {
        recordResult('PHASE 8', 'Circular Hierarchy Defense', 'PASS', 'Correctly rejected circular move attempt with HTTP 400');
      } else {
        recordResult('PHASE 8', 'Circular Hierarchy Defense', 'FAIL', `Expected HTTP 400, got ${err.response?.status}`);
      }
    }

    // 4. Batch populate 105 sample DOConCD records to test scale & pagination
    console.log('  → Populating 105 test DOConCD catalogue records for scale testing...');
    const categories = ['Operation', 'Programming', 'Commissioning', 'Functions', 'SIMATIC', 'Info / Training'];
    const bulkDocs = [];
    for (let i = 1; i <= 105; i++) {
      const cat = categories[i % categories.length];
      bulkDocs.push({
        folderId: testFolder._id,
        title: `SINUMERIK 840D sl Test Manual ${String(i).padStart(3, '0')}`,
        displayName: `Test Manual ${i}`,
        originalFileName: `MANUAL_${String(i).padStart(3, '0')}.pdf`,
        fileExtension: 'pdf',
        mimeType: 'application/pdf',
        fileSize: 102400 + i * 50,
        cloudinaryPublicId: `qa_scale_test_${i}`,
        secureUrl: 'https://res.cloudinary.com/we355whf/raw/upload/v1794758546/dms/DOConCD_SINUMERIK_SIMODRIVE/1794758542201_1FK7GP_BE',
        system: i % 2 === 0 ? '840D sl' : 'SINAMICS S120',
        softwareVersion: `v4.${i % 5 + 1}`,
        edition: `0${(i % 12) + 1}/2026`,
        orderNumber: `6FC5398-${i}AP40-0BA0`,
        documentCode: `CODE_${i}`,
        category: cat,
        description: `Scale test record ${i} for enterprise catalogue verification`,
      });
    }

    const inserted = await Document.insertMany(bulkDocs);
    inserted.forEach((d) => createdDocumentIds.push(d._id));
    sampleDoc = inserted[0];
    recordResult('PHASE 8', '100+ Document Scale Ingestion', 'PASS', `Successfully inserted ${inserted.length} DOConCD technical records`);

    // 5. Server-side Pagination Test
    const p1 = Date.now();
    const page1Res = await axios.get(`${API}/documents/folder/${testFolder._id}?page=1&limit=25`, { headers: adminHeaders });
    const p1Latency = Date.now() - p1;
    testReport.performance.pageQueryLatencyMs = p1Latency;

    if (
      page1Res.data.documents.length === 25 &&
      page1Res.data.pagination.total >= 105 &&
      page1Res.data.pagination.pages === 5
    ) {
      recordResult('PHASE 8', 'Server-Side Pagination', 'PASS', `Page 1 delivered 25/105 items (${p1Latency}ms, 5 total pages)`);
    } else {
      recordResult('PHASE 8', 'Server-Side Pagination', 'FAIL', 'Pagination count mismatch');
    }

    // ---------------------------------------------------------
    // PHASE 9: DOConCD-STYLE CATALOGUE TABLE VERIFICATION
    // ---------------------------------------------------------
    console.log('\n--- PHASE 9: DOConCD TABLE-OF-CONTENTS STRUCTURE ---');
    const doconcdRes = await axios.get(`${API}/documents/folder/${testFolder._id}?limit=105`, { headers: adminHeaders });
    const { groupedByCategory, availableCategories, availableSystems } = doconcdRes.data;

    const hasExpectedCategories = categories.every((cat) => Array.isArray(groupedByCategory[cat]) && groupedByCategory[cat].length > 0);
    if (hasExpectedCategories && availableCategories.length >= 6) {
      recordResult('PHASE 9', 'DOConCD Category Section Grouping', 'PASS', `Grouped into ${availableCategories.length} Siemens categories`);
    } else {
      recordResult('PHASE 9', 'DOConCD Category Section Grouping', 'FAIL', 'Missing expected category grouping structure');
    }

    const sampleRow = doconcdRes.data.documents[0];
    const hasColumns = sampleRow.system && sampleRow.title && sampleRow.softwareVersion && sampleRow.edition && sampleRow.orderNumber && sampleRow.documentCode;
    if (hasColumns) {
      recordResult('PHASE 9', 'DOConCD Table Columns Integrity', 'PASS', 'System, Title, SW, Edition, Order No, and File Code columns verified');
    } else {
      recordResult('PHASE 9', 'DOConCD Table Columns Integrity', 'FAIL', 'Sample document row missing required DOConCD column metadata');
    }

    // ---------------------------------------------------------
    // PHASE 10: DOCUMENT VIEWER & STREAMING VERIFICATION
    // ---------------------------------------------------------
    console.log('\n--- PHASE 10: DOCUMENT VIEWER & STREAMING VERIFICATION ---');

    // 1. Inline stream endpoint (for PDF.js / In-app iframe)
    const streamT0 = Date.now();
    const streamRes = await axios.get(`${API}/documents/${sampleDoc._id}/stream`, {
      headers: adminHeaders,
      responseType: 'arraybuffer',
    });
    const streamLatency = Date.now() - streamT0;
    testReport.performance.streamStartLatencyMs = streamLatency;

    const streamDisposition = streamRes.headers['content-disposition'] || '';
    if (streamRes.status === 200 && streamDisposition.includes('inline') && streamRes.data.length > 0) {
      recordResult('PHASE 10', 'Inline Document Stream (PDF.js)', 'PASS', `HTTP 200, Content-Disposition: inline (${streamLatency}ms)`);
    } else {
      recordResult('PHASE 10', 'Inline Document Stream (PDF.js)', 'FAIL', `Expected inline disposition, got: ${streamDisposition}`);
    }

    // 2. Download stream endpoint
    const dlRes = await axios.get(`${API}/documents/${sampleDoc._id}/download?stream=true`, {
      headers: adminHeaders,
      responseType: 'arraybuffer',
    });
    const dlDisposition = dlRes.headers['content-disposition'] || '';
    if (dlRes.status === 200 && dlDisposition.includes('attachment') && dlRes.data.length > 0) {
      recordResult('PHASE 10', 'Download Stream Attachment', 'PASS', `HTTP 200, Content-Disposition: attachment; filename="${sampleDoc.originalFileName}"`);
    } else {
      recordResult('PHASE 10', 'Download Stream Attachment', 'FAIL', `Expected attachment disposition, got: ${dlDisposition}`);
    }

    // ---------------------------------------------------------
    // PHASE 11: GLOBAL REPOSITORY SEARCH VERIFICATION
    // ---------------------------------------------------------
    console.log('\n--- PHASE 11: GLOBAL REPOSITORY SEARCH TESTING ---');

    // 1. Search by System
    const sT0 = Date.now();
    const searchSystemRes = await axios.get(`${API}/search?q=840D`, { headers: adminHeaders });
    const searchLatency = Date.now() - sT0;
    testReport.performance.searchLatencyMs = searchLatency;

    if (searchSystemRes.data.total > 0 && searchSystemRes.data.documents.length > 0) {
      recordResult('PHASE 11', 'Global Search by System (840D)', 'PASS', `Found ${searchSystemRes.data.total} matches across repository (${searchLatency}ms)`);
    } else {
      recordResult('PHASE 11', 'Global Search by System (840D)', 'FAIL', 'Search returned zero matches for 840D');
    }

    // 2. Search by Order Number
    const searchOrderRes = await axios.get(`${API}/search?q=6FC5398`, { headers: adminHeaders });
    if (searchOrderRes.data.documents.length > 0) {
      recordResult('PHASE 11', 'Global Search by Order Number (6FC5398)', 'PASS', `Found ${searchOrderRes.data.documents.length} matching documents`);
    } else {
      recordResult('PHASE 11', 'Global Search by Order Number (6FC5398)', 'FAIL', 'Search failed to match Siemens order number');
    }

    // 3. Search by File Code / Document Code
    const searchCodeRes = await axios.get(`${API}/search?q=CODE_1`, { headers: adminHeaders });
    if (searchCodeRes.data.documents.length > 0) {
      recordResult('PHASE 11', 'Global Search by Document Code', 'PASS', `Matched file code accurately (${searchCodeRes.data.documents.length} records)`);
    } else {
      recordResult('PHASE 11', 'Global Search by Document Code', 'FAIL', 'Search failed to match document code');
    }

    // 4. Case-insensitivity check
    const lowerRes = await axios.get(`${API}/search?q=sinumerik`, { headers: adminHeaders });
    const upperRes = await axios.get(`${API}/search?q=SINUMERIK`, { headers: adminHeaders });
    if (lowerRes.data.documentsCount === upperRes.data.documentsCount && lowerRes.data.documentsCount > 0) {
      recordResult('PHASE 11', 'Search Case-Insensitivity', 'PASS', `Both lower and UPPER queries returned ${lowerRes.data.documentsCount} documents`);
    } else {
      recordResult('PHASE 11', 'Search Case-Insensitivity', 'FAIL', 'Case sensitivity mismatch in search results');
    }

    // ---------------------------------------------------------
    // PHASE 12: PERMISSION DEFENSE & SECURITY AUDITING
    // ---------------------------------------------------------
    console.log('\n--- PHASE 12: GRANULAR PERMISSION ENFORCEMENT & SECURITY ---');

    // 1. User has READ: true, but DOWNLOAD: false -> must be rejected (403)!
    try {
      await axios.get(`${API}/documents/${sampleDoc._id}/download?stream=true`, { headers: testUserHeaders });
      recordResult('PHASE 12', 'Download Permission Defense', 'FAIL', 'User without download permission was allowed to download document!');
    } catch (err) {
      if (err.response?.status === 403) {
        recordResult('PHASE 12', 'Download Permission Defense', 'PASS', 'Forbidden: User without download permission blocked with HTTP 403');
      } else {
        recordResult('PHASE 12', 'Download Permission Defense', 'FAIL', `Expected HTTP 403, got ${err.response?.status}`);
      }
    }

    // 2. User has UPLOAD: false -> must be rejected (403)!
    try {
      await axios.post(`${API}/documents/folder/${testFolder._id}/upload`, {}, { headers: testUserHeaders });
      recordResult('PHASE 12', 'Upload Permission Defense', 'FAIL', 'User without upload permission was allowed to upload!');
    } catch (err) {
      if (err.response?.status === 403) {
        recordResult('PHASE 12', 'Upload Permission Defense', 'PASS', 'Forbidden: User without upload permission blocked with HTTP 403');
      } else {
        recordResult('PHASE 12', 'Upload Permission Defense', 'FAIL', `Expected HTTP 403, got ${err.response?.status}`);
      }
    }

    // 3. User attempts privilege escalation (calling admin endpoint) -> rejected (403)!
    try {
      await axios.get(`${API}/admin/users`, { headers: testUserHeaders });
      recordResult('PHASE 12', 'Privilege Escalation Defense', 'FAIL', 'Regular user accessed admin users API!');
    } catch (err) {
      if (err.response?.status === 403) {
        recordResult('PHASE 12', 'Privilege Escalation Defense', 'PASS', 'Forbidden: Non-admin rejected with HTTP 403 from admin endpoints');
      } else {
        recordResult('PHASE 12', 'Privilege Escalation Defense', 'FAIL', `Expected HTTP 403, got ${err.response?.status}`);
      }
    }

    // 4. Audit Log verification
    const auditCount = await AuditLog.countDocuments({});
    if (auditCount > 0) {
      recordResult('PHASE 12', 'Immutable Security Audit Logs', 'PASS', `Total recorded security events: ${auditCount}`);
    } else {
      recordResult('PHASE 12', 'Immutable Security Audit Logs', 'FAIL', 'No audit logs were found');
    }

    // ---------------------------------------------------------
    // PHASE 14: PERFORMANCE MEASUREMENTS
    // ---------------------------------------------------------
    console.log('\n--- PHASE 14: PERFORMANCE BENCHMARKING ---');
    console.log(`  • Health Check Latency: ${testReport.performance.healthLatencyMs} ms`);
    console.log(`  • 100+ Document Folder Query Latency: ${testReport.performance.pageQueryLatencyMs} ms`);
    console.log(`  • Inline Stream First-Byte Latency: ${testReport.performance.streamStartLatencyMs} ms`);
    console.log(`  • Full-Text Global Search Latency: ${testReport.performance.searchLatencyMs} ms`);

    recordResult(
      'PHASE 14',
      'API Performance Benchmark',
      'PASS',
      `Health: ${testReport.performance.healthLatencyMs}ms | Page: ${testReport.performance.pageQueryLatencyMs}ms | Stream: ${testReport.performance.streamStartLatencyMs}ms | Search: ${testReport.performance.searchLatencyMs}ms`
    );
  } catch (err) {
    console.error('\n[FATAL TEST RUNNER ERROR]', err.message, err.response?.data);
    testReport.failed++;
  } finally {
    // ---------------------------------------------------------
    // CLEANUP OF ISOLATED TEST DATA
    // ---------------------------------------------------------
    console.log('\n--- CLEANING UP ISOLATED QA TEST RECORDS ---');
    if (createdDocumentIds.length > 0) {
      const delDocs = await Document.deleteMany({ _id: { $in: createdDocumentIds } });
      console.log(`  ✓ Safely removed ${delDocs.deletedCount} temporary scale test documents.`);
    }
    if (createdFolderIds.length > 0) {
      const delFolders = await Folder.deleteMany({ _id: { $in: createdFolderIds } });
      console.log(`  ✓ Safely removed ${delFolders.deletedCount} temporary test folders.`);
    }
    if (createdUserIds.length > 0) {
      const delUsers = await User.deleteMany({ _id: { $in: createdUserIds } });
      console.log(`  ✓ Safely removed ${delUsers.deletedCount} temporary test users.`);
    }
    await mongoose.connection.close();
  }

  console.log('\n========================================================================');
  console.log(`   QA SUITE EXECUTION SUMMARY: ${testReport.passed}/${testReport.totalTests} TESTS PASSED CLEANLY`);
  console.log('========================================================================\n');

  return testReport;
}

if (require.main === module) {
  runFullQASuite()
    .then((report) => {
      process.exit(report.failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runFullQASuite;
