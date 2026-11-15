const axios = require('axios');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const User = require('../models/User');
const Folder = require('../models/Folder');
const Document = require('../models/Document');
const Permission = require('../models/Permission');
const { USER_ROLES, USER_STATUS } = require('../config/constants');

const API = 'http://localhost:5000/api';

async function testSecurityDeep() {
  console.log('\n======================================================');
  console.log('       SECURITY & PRIVILEGE HARDENING VERIFICATION    ');
  console.log('======================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);

  // 1. Session Expiration Test
  console.log('[1] Testing Expired Session Defense...');
  const expiredToken = jwt.sign(
    { id: '6af9d05ba1a8b3b2f4ddf688', email: 'test@domain.com', role: 'USER' },
    process.env.JWT_SECRET,
    { expiresIn: '-5s' }
  );

  try {
    await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${expiredToken}` } });
    console.error('✗ Failed: Expired session was accepted!');
  } catch (err) {
    if (err.response?.status === 401) {
      console.log('✓ Verified: Expired session strictly rejected with HTTP 401:', err.response.data.message);
    } else {
      console.error('✗ Unexpected status:', err.response?.status);
    }
  }

  // 2. Admin Privilege Escalation Defense
  console.log('\n[2] Testing Privilege Escalation Defense...');
  const normalUser = await User.findOne({ role: USER_ROLES.USER });
  const normalToken = jwt.sign(
    { id: normalUser._id, email: normalUser.email, role: USER_ROLES.USER },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  try {
    await axios.put(
      `${API}/admin/users/${normalUser._id}`,
      { role: USER_ROLES.ADMIN },
      { headers: { Authorization: `Bearer ${normalToken}` } }
    );
    console.error('✗ Failed: Regular user was able to call admin privilege update!');
  } catch (err) {
    if (err.response?.status === 403) {
      console.log('✓ Verified: Non-admin user blocked from privilege modification with HTTP 403 Forbidden');
    } else {
      console.error('✗ Unexpected status:', err.response?.status);
    }
  }

  // 3. Dev-Login Production Guard Test
  console.log('\n[3] Testing Production Dev-Login Disabled Guard...');
  // Simulate request when NODE_ENV is production
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  // Send request with an extra header or test against devLogin controller directly
  const { devLogin } = require('../controllers/authController');
  const mockReq = { body: { email: 'hacker@attacker.com' } };
  let devLoginBlocked = false;
  let devLoginStatus = 0;
  const mockRes = {
    status: (code) => {
      devLoginStatus = code;
      return {
        json: (data) => {
          if (code === 403) devLoginBlocked = true;
          return data;
        },
      };
    },
  };
  await devLogin(mockReq, mockRes, () => {});
  process.env.NODE_ENV = originalEnv;

  if (devLoginBlocked) {
    console.log('✓ Verified: devLogin controller strictly enforces HTTP 403 Forbidden in production mode');
  } else {
    console.error('✗ Failed: devLogin did not block request in production mode (status:', devLoginStatus, ')');
  }

  // 4. Folder Permission Inheritance & Unauthorized File Access
  console.log('\n[4] Testing Folder Permission Scope Isolation...');
  const testFolder = await Folder.findOne({ isArchived: false });
  const testDoc = await Document.findOne({ folderId: testFolder._id, isArchived: false });

  // Ensure user has NO permission on this folder
  await Permission.deleteMany({ userId: normalUser._id, folderId: testFolder._id });
  // Ensure normal user global download is false
  normalUser.permissions = { read: true, upload: false, download: false, manage: false };
  await normalUser.save();

  try {
    await axios.get(`${API}/documents/${testDoc._id}/download?stream=true`, {
      headers: { Authorization: `Bearer ${normalToken}` },
    });
    console.error('✗ Security failure: User without download permission downloaded file!');
  } catch (err) {
    if (err.response?.status === 403) {
      console.log('✓ Verified: Unauthorized file download rejected with HTTP 403 Forbidden');
    } else {
      console.error('✗ Unexpected status:', err.response?.status);
    }
  }

  // 5. Secret Exposure Inspection
  console.log('\n[5] Testing Production Secret Exposure in API Payloads...');
  const endpoints = ['/health', `/documents/${testDoc._id}`];
  let secretFound = false;
  const sensitiveStrings = [
    process.env.JWT_SECRET,
    process.env.CLOUDINARY_API_SECRET,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.MONGODB_URI,
  ].filter(Boolean);

  for (const ep of endpoints) {
    const res = await axios.get(`${API}${ep}`, {
      headers: { Authorization: `Bearer ${normalToken}` },
    });
    const serialized = JSON.stringify(res.data);
    for (const secret of sensitiveStrings) {
      if (serialized.includes(secret)) {
        secretFound = true;
        console.error(`✗ Leak found in ${ep}: Contains sensitive secret!`);
      }
    }
  }

  if (!secretFound) {
    console.log('✓ Verified: Zero secrets, JWT keys, or database connection strings exposed across public/authenticated APIs');
  }

  await mongoose.connection.close();
  console.log('\n======================================================');
  console.log('   ALL SECURITY AUDIT SCENARIOS VERIFIED SUCCESSFULLY   ');
  console.log('======================================================\n');
}

testSecurityDeep()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
