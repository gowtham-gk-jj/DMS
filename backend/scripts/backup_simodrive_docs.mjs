import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

async function backup() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));

  const docs = await Document.find({
    folderId: new mongoose.Types.ObjectId('6af9d05ba1a8b3b2f4ddf68b')
  }).lean();

  const backupDir = path.resolve('backend/data/backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const backupPath = path.join(backupDir, `backup_simodrive_docs_${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(docs, null, 2));

  console.log(`Backed up ${docs.length} SIMODRIVE documents to ${backupPath}`);
  await mongoose.disconnect();
}

backup().catch(console.error);
