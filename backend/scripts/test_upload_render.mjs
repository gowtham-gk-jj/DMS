import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import jwt from 'jsonwebtoken';
import https from 'https';
import fs from 'fs';
import path from 'path';

const token = jwt.sign(
  {
    id: '6af9e5e81afb351711b36fdd',
    email: 'technova552026@gmail.com',
    role: 'ADMIN',
    status: 'APPROVED',
  },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

async function testUploadOne() {
  const filePath = path.resolve('backend/temp_migration/github_downloads/MIG-1794799277928-0AB6A3/extracted/DOConCD_SINUMERIK_SIMODRIVE/English/pdf/PJTM.pdf');
  const fileStats = fs.statSync(filePath);
  console.log(`Testing upload of PJTM.pdf (${fileStats.size} bytes) to production Render...`);

  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

  const header = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="files"; filename="PJTM.pdf"\r\n` +
    `Content-Type: application/pdf\r\n\r\n`
  );

  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const fileData = fs.readFileSync(filePath);
  const body = Buffer.concat([header, fileData, footer]);

  const options = {
    hostname: 'dms-dab9.onrender.com',
    path: '/api/documents/folder/6af9d05ba1a8b3b2f4ddf68b/upload',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length,
    }
  };

  const req = https.request(options, (res) => {
    let resBody = '';
    res.on('data', d => resBody += d);
    res.on('end', () => {
      console.log('Upload response status:', res.statusCode);
      console.log('Upload response body:', resBody);
    });
  });

  req.on('error', console.error);
  req.write(body);
  req.end();
}

testUploadOne().catch(console.error);
