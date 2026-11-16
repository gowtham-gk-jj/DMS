import https from 'https';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function checkProduction() {
  const token = jwt.sign(
    { id: '6af9d059a1a8b3b2f4ddf68a', role: 'ADMIN', email: 'technova552026@gmail.com' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const options = {
    hostname: 'dms-dab9.onrender.com',
    path: '/api/folders?parentId=root',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  console.log('Querying production Render backend with JWT...');

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('Status code:', res.statusCode);
      try {
        const json = JSON.parse(data);
        console.log('Success:', json.success);
        if (json.folders) {
          json.folders.forEach(f => {
            console.log('-----------------------------------------');
            console.log('Folder:', f.name);
            console.log('  subfoldersCount:', f.subfoldersCount);
            console.log('  documentsCount:', f.documentsCount);
            console.log('  directDocumentsCount:', f.directDocumentsCount);
            console.log('  totalDocumentsCount:', f.totalDocumentsCount);
          });
        } else {
          console.log('Response body:', data.slice(0, 300));
        }
      } catch (e) {
        console.log('Raw output:', data.slice(0, 300));
      }
    });
  });

  req.on('error', (err) => console.error('Request error:', err.message));
  req.end();
}

checkProduction();
