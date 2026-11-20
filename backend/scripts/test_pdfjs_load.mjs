import * as pdfjsLib from '../../frontend/node_modules/pdfjs-dist/legacy/build/pdf.mjs';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import jwt from 'jsonwebtoken';

async function testPdfJs() {
  console.log('PDF.js version:', pdfjsLib.version);

  const token = jwt.sign(
    { id: '6af9e5e81afb351711b36fdd', email: 'technova552026@gmail.com', role: 'ADMIN', status: 'APPROVED' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  // 1. Direct Cloudinary URL
  console.log('--- Test 1: Direct Cloudinary URL ---');
  try {
    const task1 = pdfjsLib.getDocument({
      url: 'https://res.cloudinary.com/we355whf/raw/upload/v1794799717/dms/DOConCD_SINUMERIK_SIMODRIVE/1794799714649_BEM',
      disableAutoFetch: true,
      disableStream: false,
    });
    const doc1 = await task1.promise;
    console.log('Test 1 SUCCESS! Num pages:', doc1.numPages);
  } catch (e) {
    console.error('Test 1 FAILED:', e.message);
  }

  // 2. Production Stream URL
  console.log('--- Test 2: Production Stream URL with Authorization header ---');
  try {
    const task2 = pdfjsLib.getDocument({
      url: `https://dms-dab9.onrender.com/api/documents/6afa7865d8496612d7ceb7bb/stream?token=${encodeURIComponent(token)}`,
      httpHeaders: {
        Authorization: `Bearer ${token}`
      },
      disableAutoFetch: true,
      disableStream: false,
    });
    const doc2 = await task2.promise;
    console.log('Test 2 SUCCESS! Num pages:', doc2.numPages);
  } catch (e) {
    console.error('Test 2 FAILED:', e.message);
  }
}

testPdfJs().catch(console.error);
