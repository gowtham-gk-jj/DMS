const mongoose = require('mongoose');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Document = require('../src/models/Document');
const User = require('../src/models/User');
const { IMPORT_ID } = require('../src/services/migrationService');

async function testAPIs() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Verify Document Queries
  const searchTest1 = await Document.find({ importId: IMPORT_ID, $text: { $search: 'Universal' } });
  console.log(`Text search 'Universal': Found ${searchTest1.length} docs`);
  searchTest1.forEach((d) => console.log(` - ${d.title} (${d.fileName})`));

  const searchTest2 = await Document.find({ importId: IMPORT_ID, fileName: '1FK7_BE' });
  console.log(`Exact search '1FK7_BE': Found ${searchTest2.length} docs`);
  searchTest2.forEach((d) => console.log(` - ${d.title} (Order: ${d.orderNumber})`));

  // Check Cloudinary asset vs Local persisted asset
  const cloudDoc = await Document.findOne({ importId: IMPORT_ID, storageProvider: 'CLOUDINARY' });
  console.log(`\nCloudinary Doc Sample:`);
  console.log(` - Title: ${cloudDoc.title}`);
  console.log(` - Public ID: ${cloudDoc.cloudinaryPublicId}`);
  console.log(` - Secure URL: ${cloudDoc.secureUrl}`);

  const localDoc = await Document.findOne({ importId: IMPORT_ID, storageProvider: 'LOCAL_PERSISTED' });
  console.log(`\nLocal Persisted Doc Sample:`);
  console.log(` - Title: ${localDoc.title}`);
  console.log(` - Public ID: ${localDoc.cloudinaryPublicId}`);
  console.log(` - Secure URL: ${localDoc.secureUrl}`);

  await mongoose.disconnect();
}

testAPIs().catch(console.error);
