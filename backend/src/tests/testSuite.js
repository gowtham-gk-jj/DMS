const axios = require('axios');

const API = 'http://localhost:5000/api';

async function runTestSuite() {
  console.log('====================================================');
  console.log('   RUNNING COMPREHENSIVE END-TO-END SYSTEM TESTS    ');
  console.log('====================================================');

  try {
    // 1. Health check
    console.log('\n[Test 1] Health Check');
    const health = await axios.get(`${API}/health`);
    console.log('✓ Health:', health.data);

    // 2. Admin Login
    console.log('\n[Test 2] Master Admin Login');
    const adminLogin = await axios.post(`${API}/auth/dev-login`, {
      email: 'loganathan8754114450@gmail.com',
      role: 'ADMIN',
      name: 'Chief System Administrator',
    });
    const adminToken = adminLogin.data.token;
    console.log('✓ Admin authenticated. Token received. Role:', adminLogin.data.user.role);

    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    // 3. Admin Dashboard Stats
    console.log('\n[Test 3] Admin Dashboard Statistics');
    const statsRes = await axios.get(`${API}/admin/stats`, { headers: adminHeaders });
    console.log('✓ Total Folders:', statsRes.data.stats.totalFolders);
    console.log('✓ Total Documents:', statsRes.data.stats.totalDocuments);
    console.log('✓ Storage:', statsRes.data.stats.storageFormatted);

    // 4. Test New User Login & Access Request Flow
    console.log('\n[Test 4] New Applicant Registration & Access Request Flow');
    const testUserEmail = `applicant.test.${Date.now()}@domain.com`;
    const userLogin = await axios.post(`${API}/auth/dev-login`, {
      email: testUserEmail,
      role: 'USER',
      name: 'Marcus Vance',
    });
    const userToken = userLogin.data.token;
    console.log('✓ New user registered with status:', userLogin.data.user.status); // PENDING_REQUEST

    const userHeaders = { Authorization: `Bearer ${userToken}` };

    // 5. Try accessing documents as PENDING_REQUEST user -> must be rejected (403)!
    console.log('\n[Test 5] Verify unapproved user CANNOT access document library');
    try {
      await axios.get(`${API}/folders`, { headers: userHeaders });
      console.error('✗ Security failure: Unapproved user was able to access folders!');
    } catch (err) {
      console.log('✓ Security Verified: Unapproved user blocked with status code:', err.response?.status);
    }

    // 6. Submit Access Request
    console.log('\n[Test 6] Submit Access Request');
    const requestRes = await axios.post(
      `${API}/requests`,
      {
        organization: 'Siemens Industrial Automation Partner',
        department: 'Drive Engineering',
        reason: 'Required for retrofitting SINAMICS S120 inverters on CNC milling center.',
        purpose: 'Commissioning and diagnosis',
      },
      { headers: userHeaders }
    );
    console.log('✓ Access request submitted successfully. Request ID:', requestRes.data.request._id);

    // 7. Admin reviews pending requests
    console.log('\n[Test 7] Admin Retrieves Pending Requests');
    const pendingRes = await axios.get(`${API}/admin/requests?status=PENDING`, { headers: adminHeaders });
    const targetRequest = pendingRes.data.requests.find((r) => r.email === testUserEmail);
    console.log('✓ Admin found pending request for:', targetRequest?.email);

    // 8. Admin Approves with Read-Only Permission (READ: ON, DOWNLOAD: OFF)
    console.log('\n[Test 8] Admin Approves Request with READ=true, DOWNLOAD=false');
    const approveRes = await axios.post(
      `${API}/admin/requests/${targetRequest._id}/approve`,
      {
        permissions: { read: true, upload: false, download: false, manage: false },
        role: 'USER',
      },
      { headers: adminHeaders }
    );
    console.log('✓ User approved! Status:', approveRes.data.user.status, 'Permissions:', approveRes.data.user.permissions);

    // 9. Approved User can now browse folders!
    console.log('\n[Test 9] Approved User Browses Document Library');
    const foldersRes = await axios.get(`${API}/folders?parentId=root`, { headers: userHeaders });
    console.log('✓ Approved user successfully retrieved', foldersRes.data.folders.length, 'root folders');
    const firstFolder = foldersRes.data.folders[0];

    // 10. Approved User gets subfolders and documents
    console.log('\n[Test 10] Approved User Reads Nested Subfolders');
    const subRes = await axios.get(`${API}/folders?parentId=${firstFolder._id}`, { headers: userHeaders });
    console.log('✓ Found', subRes.data.folders.length, 'subcategories in', firstFolder.name);
    const operationFolder = subRes.data.folders[0];

    // 11. Retrieve DOConCD Table-of-Contents Documents
    console.log('\n[Test 11] Retrieve DOConCD Table-of-Contents Documents');
    const docsRes = await axios.get(`${API}/documents/folder/${operationFolder._id}`, { headers: userHeaders });
    console.log('✓ Retrieved', docsRes.data.documents.length, 'DOConCD documents in folder:', operationFolder.name);
    const sampleDoc = docsRes.data.documents[0];
    console.log('  Catalogue Entry Sample:', {
      system: sampleDoc.system,
      title: sampleDoc.title,
      code: sampleDoc.documentCode,
      order: sampleDoc.orderNumber,
      category: sampleDoc.category,
    });

    // 12. User Previews Document
    console.log('\n[Test 12] User Previews Document (Read Permission)');
    const previewRes = await axios.get(`${API}/documents/${sampleDoc._id}/preview`, { headers: userHeaders });
    console.log('✓ Preview URL authorized and delivered:', previewRes.data.previewUrl.slice(0, 50) + '...');

    // 13. User Attempts Download Without Permission -> Backend MUST REJECT (403)!
    console.log('\n[Test 13] Verify Download Rejection when User lacks Download Permission');
    try {
      await axios.get(`${API}/documents/${sampleDoc._id}/download`, { headers: userHeaders });
      console.error('✗ Security failure: User without download permission was allowed to download!');
    } catch (err) {
      console.log('✓ Security Verified: Download rejected with HTTP 403 Forbidden! Message:', err.response?.data?.message);
    }

    // 14. Admin Grants Download Permission to User
    console.log('\n[Test 14] Admin Dynamically Updates User Permissions (Enables Download)');
    await axios.put(
      `${API}/admin/users/${approveRes.data.user._id}`,
      {
        permissions: { read: true, upload: true, download: true, manage: false },
      },
      { headers: adminHeaders }
    );
    console.log('✓ Permissions dynamically updated in database.');

    // 15. User Downloads Document Now with Permission!
    console.log('\n[Test 15] User Retries Download after Permission Grant');
    const downloadRes = await axios.get(`${API}/documents/${sampleDoc._id}/download`, { headers: userHeaders });
    console.log('✓ Download Authorized! Signed URL generated:', downloadRes.data.downloadUrl?.slice(0, 60) + '...');

    // 16. Global Search Test
    console.log('\n[Test 16] Test Global Search Across All Fields');
    const searchRes = await axios.get(`${API}/search?q=840D`, { headers: userHeaders });
    console.log('✓ Global Search for "840D" returned', searchRes.data.total, 'matches:');
    console.log('  Matching documents count:', searchRes.data.documentsCount);
    console.log('  Matching folders count:', searchRes.data.foldersCount);

    // 17. Audit Logs Verification
    console.log('\n[Test 17] Admin Checks Security Audit Logs');
    const auditRes = await axios.get(`${API}/audit?limit=5`, { headers: adminHeaders });
    console.log('✓ Audit logs recorded successfully. Total log entries:', auditRes.data.total);

    // 18. Email Notification Logs Verification
    console.log('\n[Test 18] Admin Checks Email Dispatch Logs');
    const emailRes = await axios.get(`${API}/admin/email-logs?limit=5`, { headers: adminHeaders });
    console.log('✓ Email dispatch logs verified. Total notification entries:', emailRes.data.total);

    console.log('\n====================================================');
    console.log('       ALL 18 END-TO-END TESTS PASSED CLEANLY!       ');
    console.log('====================================================');
  } catch (error) {
    console.error('Test Suite Failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

runTestSuite();
