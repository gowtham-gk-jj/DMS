import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import jwt from 'jsonwebtoken';
import https from 'https';

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

function testStream(headers = {}) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'dms-dab9.onrender.com',
      path: `/api/documents/6afa7865d8496612d7ceb7bb/stream?token=${encodeURIComponent(token)}`,
      method: 'GET',
      headers: {
        'Origin': 'https://frontend-chi-ten-77.vercel.app',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const total = chunks.reduce((a, c) => a + c.length, 0);
        const first = chunks.length > 0 ? Buffer.concat(chunks).slice(0, 30).toString() : '';
        resolve({
          status: res.statusCode,
          headers: res.headers,
          bytesReceived: total,
          firstBytes: first
        });
      });
    });
    req.on('error', (err) => resolve({ error: err.message }));
    req.end();
  });
}

async function run() {
  console.log('--- 1. Testing Stream with Range: bytes=0-65535 ---');
  const resRange = await testStream({
    'Authorization': `Bearer ${token}`,
    'Range': 'bytes=0-65535'
  });
  console.log(resRange);

  console.log('\n--- 2. Testing Stream without Range header ---');
  const resFull = await testStream({
    'Authorization': `Bearer ${token}`
  });
  console.log({
    status: resFull.status,
    headers: resFull.headers,
    bytesReceived: resFull.bytesReceived,
    firstBytes: resFull.firstBytes
  });

  console.log('\n--- 3. Testing Stream for localhost doc (BNM: 6afa7868d8496612d7ceb7bf) ---');
  const optionsBNM = {
    hostname: 'dms-dab9.onrender.com',
    path: `/api/documents/6afa7868d8496612d7ceb7bf/stream?token=${encodeURIComponent(token)}`,
    method: 'GET',
    headers: {
      'Origin': 'https://frontend-chi-ten-77.vercel.app',
      'Authorization': `Bearer ${token}`
    }
  };
  const reqBNM = https.request(optionsBNM, (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      console.log('BNM stream result on Render:', res.statusCode, body);
    });
  });
  reqBNM.end();
}

run().catch(console.error);
