import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import mongoose from 'mongoose';
import { getDocumentsInFolder } from '../src/controllers/documentController.js';
import Folder from '../src/models/Folder.js';

async function listAvailable() {
  await mongoose.connect(process.env.MONGODB_URI);
  const simFolder = await Folder.findOne({ name: 'DOConCD_SINUMERIK_SIMODRIVE' });

  const req = {
    params: { folderId: simFolder._id.toString() },
    query: {}
  };
  let responseData = null;
  const res = {
    status: (code) => ({
      json: (data) => { responseData = data; }
    })
  };

  await getDocumentsInFolder(req, res, () => {});

  const available = responseData.documents.filter(d => d.status === 'Available');
  console.log('Available count:', available.length);

  // Group by storage provider & url type
  const urlTypes = {};
  for (const d of available) {
    let type = 'UNKNOWN';
    if (d.secureUrl.includes('cloudinary')) type = 'CLOUDINARY';
    else if (d.secureUrl.includes('localhost')) type = 'LOCALHOST';
    else if (d.secureUrl.startsWith('/api')) type = 'RELATIVE';
    urlTypes[type] = (urlTypes[type] || 0) + 1;
  }
  console.log('URL types among available documents:', urlTypes);

  // Print first 10 available docs
  console.log('\nFirst 10 available docs:');
  available.slice(0, 10).forEach(d => {
    console.log(`[#${d.catalogueIndex}] ${d.fileName} | Title: ${d.title} | ID: ${d._id} | URL: ${d.secureUrl.slice(0, 70)}...`);
  });

  // Print all localhost docs
  const localDocs = available.filter(d => d.secureUrl.includes('localhost'));
  console.log(`\nLocalhost available docs (${localDocs.length}):`);
  localDocs.forEach(d => {
    console.log(`[#${d.catalogueIndex}] ${d.fileName} | Title: ${d.title} | ID: ${d._id} | URL: ${d.secureUrl}`);
  });

  await mongoose.disconnect();
}

listAvailable().catch(console.error);
