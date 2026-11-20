import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import jwt from 'jsonwebtoken';
import https from 'https';
import fs from 'fs';

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

const analysis = JSON.parse(fs.readFileSync('backend/data/simodrive_212_analysis.json', 'utf8'));

// Filter only those in mongo with an ID
const docsToTest = analysis.filter(d => d.inMongoId);
console.log(`Testing ${docsToTest.length} SIMODRIVE docs on production Render...`);

function checkDocStream(doc) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'dms-dab9.onrender.com',
      path: `/api/documents/${doc.inMongoId}/stream?token=${encodeURIComponent(token)}`,
      method: 'GET',
      headers: {
        'Origin': 'https://frontend-chi-ten-77.vercel.app',
        'Authorization': `Bearer ${token}`,
        'Range': 'bytes=0-1023'
      }
    };

    const req = https.request(options, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const total = chunks.reduce((a, c) => a + c.length, 0);
        const header = chunks.length > 0 ? Buffer.concat(chunks).slice(0, 10).toString() : '';
        resolve({
          index: doc.index,
          fileName: doc.fileName,
          docId: doc.inMongoId,
          status: res.statusCode,
          contentType: res.headers['content-type'],
          contentRange: res.headers['content-range'],
          bytes: total,
          isPdf: header.startsWith('%PDF')
        });
      });
    });
    req.on('error', (err) => resolve({
      index: doc.index,
      fileName: doc.fileName,
      docId: doc.inMongoId,
      error: err.message
    }));
    req.end();
  });
}

async function run() {
  const results = [];
  // Run with concurrency 5
  const CONCURRENCY = 5;
  for (let i = 0; i < docsToTest.length; i += CONCURRENCY) {
    const batch = docsToTest.slice(i, i + CONCURRENCY);
    const batchRes = await Promise.all(batch.map(checkDocStream));
    results.push(...batchRes);
    process.stdout.write(`Tested ${results.length}/${docsToTest.length}...\r`);
  }

  console.log(`\nCompleted testing ${results.length} documents.`);

  const passed206 = results.filter(r => r.status === 206 && r.isPdf);
  const status404 = results.filter(r => r.status === 404);
  const status500 = results.filter(r => r.status >= 500);
  const other = results.filter(r => r.status !== 206 && r.status !== 404 && r.status < 500);

  console.log(`Results summary:`);
  console.log(`- Valid PDF streaming (206 %PDF): ${passed206.length}`);
  console.log(`- 404 Not Found: ${status404.length}`);
  console.log(`- 5xx Server Error: ${status500.length}`);
  console.log(`- Other status / error: ${other.length}`);

  if (status404.length > 0) {
    console.log('\nSample 404 documents:');
    status404.slice(0, 10).forEach(d => console.log(d));
  }

  if (status500.length > 0) {
    console.log('\nSample 5xx documents:');
    status500.slice(0, 10).forEach(d => console.log(d));
  }

  fs.writeFileSync('backend/data/prod_stream_test_results.json', JSON.stringify(results, null, 2));
}

run().catch(console.error);
