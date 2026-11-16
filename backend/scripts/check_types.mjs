import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkTypes() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Folder = mongoose.model('Folder', new mongoose.Schema({}, { strict: false }));
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));

  const folders = await Folder.find().lean();
  console.log('Total folders:', folders.length);
  folders.forEach(f => {
    const pType = typeof f.parentFolderId;
    const isObjId = f.parentFolderId instanceof mongoose.Types.ObjectId;
    // console.log(`Folder: "${f.name}", parentId: ${f.parentFolderId}, type: ${pType}, isObjId: ${isObjId}`);
  });

  const docs = await Document.find({ isArchived: false }).limit(20).lean();
  console.log('Sample Document folderIds:');
  docs.forEach(d => {
    const fType = typeof d.folderId;
    const isObjId = d.folderId instanceof mongoose.Types.ObjectId;
    console.log(`Doc: "${d.title}", folderId: ${d.folderId}, type: ${fType}, isObjId: ${isObjId}`);
  });

  await mongoose.disconnect();
}

checkTypes();
