import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import fs from 'fs';
import mongoose from 'mongoose';

async function checkWhereDocsAre() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));
  const Folder = mongoose.model('Folder', new mongoose.Schema({}, { strict: false }));

  const data = JSON.parse(fs.readFileSync('backend/data/simodrive_212_analysis.json', 'utf8'));
  
  const folderCounts = {};
  const folderDetails = {};

  for (const item of data) {
    const fId = item.inMongoFolderId || 'NO_MONGO_MATCH';
    folderCounts[fId] = (folderCounts[fId] || 0) + 1;
    if (fId !== 'NO_MONGO_MATCH' && !folderDetails[fId]) {
      const f = await Folder.findById(fId).lean();
      folderDetails[fId] = f ? `${f.name} (${f.path})` : 'FOLDER_NOT_FOUND_IN_DB';
    }
  }

  console.log('Folder distribution of the 212 SIMODRIVE entries:');
  for (const [fId, count] of Object.entries(folderCounts)) {
    console.log(`- Folder ${fId} [${folderDetails[fId] || fId}]: ${count} docs`);
  }

  await mongoose.disconnect();
}

checkWhereDocsAre().catch(console.error);
