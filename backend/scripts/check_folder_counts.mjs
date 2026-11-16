import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const Folder = (await import('../src/models/Folder.js')).default;
const Document = (await import('../src/models/Document.js')).default;

await mongoose.connect(process.env.MONGODB_URI);

const rootFolders = await Folder.find({ parentFolderId: null });
for (const rf of rootFolders) {
  const directCount = await Document.countDocuments({ folderId: rf._id });
  
  const folderIds = [rf._id];
  const q = [rf._id];
  while (q.length > 0) {
    const cur = q.shift();
    const children = await Folder.find({ parentFolderId: cur });
    for (const ch of children) {
      folderIds.push(ch._id);
      q.push(ch._id);
    }
  }
  const recursiveCount = await Document.countDocuments({ folderId: { $in: folderIds } });
  console.log(`"${rf.name}" -> Direct Docs: ${directCount} | Total Descendant Docs: ${recursiveCount} | Subfolders: ${folderIds.length - 1}`);
}

await mongoose.disconnect();
