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

const options = {
  hostname: 'dms-dab9.onrender.com',
  path: `/api/documents/6b005e67b85595de1fbe3f32/stream?token=${encodeURIComponent(token)}`,
  method: 'GET',
  headers: {
    'Origin': 'https://frontend-chi-ten-77.vercel.app',
    'Authorization': `Bearer ${token}`,
    'Range': 'bytes=0-1023'
  }
};

const req = https.request(options, (res) => {
  let chunks = [];
  res.on('data', d => chunks.push(d));
  res.on('end', () => {
    console.log('Stream Status:', res.statusCode);
    console.log('Stream Headers:', res.headers);
    const buf = Buffer.concat(chunks);
    console.log('Bytes received:', buf.length);
    console.log('First 20 bytes:', buf.slice(0, 20).toString());
  });
});
req.on('error', console.error);
req.end();
