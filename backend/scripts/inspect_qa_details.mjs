import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function inspect() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Folder = mongoose.model('Folder', new mongoose.Schema({}, { strict: false }));
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));

  const root = await Folder.findOne({ name: 'DOConCD SINUMERIK - SINAMICS 09/2011 English' });
  const allUnder = await Folder.find({
    isArchived: false,
    path: new RegExp(`^${root.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  });
  console.log('Total folders under root path (including root):', allUnder.length);
  const direct = allUnder.filter(f => String(f.parentFolderId) === String(root._id));
  console.log('Direct subfolders count:', direct.length);
  const grandchildren = allUnder.filter(f => String(f.parentFolderId) !== String(root._id) && String(f._id) !== String(root._id));
  console.log('Nested grandchildren count:', grandchildren.length);
  grandchildren.forEach(g => console.log('  Child:', g.name, 'path:', g.path));

  const localDocs = await Document.find({ storageProvider: 'LOCAL_PERSISTED' });
  console.log('\nTotal LOCAL_PERSISTED docs:', localDocs.length);
  localDocs.slice(0, 5).forEach(d => {
    console.log('  Doc:', d.title, '| storageKey:', d.storageKey, '| localPath:', d.localPath, '| storageUrl:', d.storageUrl);
  });

  await mongoose.disconnect();
}

inspect();
