import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkSubfolders() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Folder = mongoose.model('Folder', new mongoose.Schema({}, { strict: false }));
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));

  const allActiveFolders = await Folder.find({ isArchived: false }).select('_id parentFolderId name path').lean();
  
  const childrenMap = new Map();
  allActiveFolders.forEach((f) => {
    const pid = f.parentFolderId ? String(f.parentFolderId) : 'root';
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid).push(f);
  });

  const getDescendantFolderCount = (folderId) => {
    const children = childrenMap.get(String(folderId)) || [];
    let total = children.length;
    for (const child of children) {
      total += getDescendantFolderCount(child._id);
    }
    return total;
  };

  const roots = allActiveFolders.filter(f => !f.parentFolderId);
  console.log('Roots count:', roots.length);
  for (const r of roots) {
    const directSubfolders = (childrenMap.get(String(r._id)) || []).length;
    const totalSubfolders = getDescendantFolderCount(r._id);
    console.log(`Root: "${r.name}" -> Direct Subfolders: ${directSubfolders}, Total Descendant Subfolders: ${totalSubfolders}`);
  }

  await mongoose.disconnect();
}

checkSubfolders().catch(console.error);
