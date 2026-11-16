import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testFolderApi() {
  console.log('Testing Folder API responses...\n');

  // Let's test the local controller directly
  const mongoose = (await import('mongoose')).default;
  await mongoose.connect(process.env.MONGODB_URI);
  
  const Folder = mongoose.model('Folder', new mongoose.Schema({}, { strict: false }));
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));

  // Simulate folderController.js logic
  const query = {
    isArchived: false,
    parentFolderId: null,
  };

  const folders = await Folder.find(query).sort({ name: 1 });
  const allActiveFolders = await Folder.find({ isArchived: false }).select('_id parentFolderId path').lean();
  const docCountsAgg = await Document.aggregate([
    { $match: { isArchived: false, folderId: { $ne: null } } },
    { $group: { _id: '$folderId', count: { $sum: 1 } } },
  ]);

  const docCountMap = new Map();
  docCountsAgg.forEach((d) => docCountMap.set(String(d._id), d.count));

  const childrenMap = new Map();
  allActiveFolders.forEach((f) => {
    const pid = f.parentFolderId ? String(f.parentFolderId) : 'root';
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid).push(f);
  });

  const getDescendantDocCount = (folderId) => {
    let total = docCountMap.get(String(folderId)) || 0;
    const children = childrenMap.get(String(folderId)) || [];
    for (const child of children) {
      total += getDescendantDocCount(child._id);
    }
    return total;
  };

  console.log('=== REPOSITORY DATA RECONCILIATION ===');
  for (const folder of folders) {
    const directDocs = docCountMap.get(String(folder._id)) || 0;
    const totalDocs = getDescendantDocCount(folder._id);
    const subfolders = (childrenMap.get(String(folder._id)) || []).length;

    // Also count all descendant folders
    const allDescendants = allActiveFolders.filter(f => f.path?.startsWith(folder.path + '/'));

    console.log({
      name: folder.name,
      id: folder._id,
      path: folder.path,
      directDocs,
      totalDescendantDocs: totalDocs,
      directSubfolders: subfolders,
      totalDescendantFolders: allDescendants.length,
    });
  }

  await mongoose.disconnect();
}

testFolderApi().catch(console.error);
