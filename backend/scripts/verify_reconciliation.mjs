import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function verifyAll() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas\n');

  const Folder = mongoose.model('Folder', new mongoose.Schema({}, { strict: false }));
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));

  const allActiveFolders = await Folder.find({ isArchived: false }).select('_id parentFolderId name path').lean();
  const allActiveDocs = await Document.find({ isArchived: false }).lean();

  const docCountMap = new Map();
  allActiveDocs.forEach((d) => {
    if (d.folderId) {
      const fid = String(d.folderId);
      docCountMap.set(fid, (docCountMap.get(fid) || 0) + 1);
    }
  });

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

  const getDescendantFolderCount = (folderId) => {
    const children = childrenMap.get(String(folderId)) || [];
    let total = children.length;
    for (const child of children) {
      total += getDescendantFolderCount(child._id);
    }
    return total;
  };

  const roots = allActiveFolders.filter((f) => !f.parentFolderId);
  console.log('=== 1. COMPREHENSIVE REPOSITORY RECONCILIATION TABLE ===\n');

  const reconciliationRows = [];

  for (const root of roots) {
    const directDocs = docCountMap.get(String(root._id)) || 0;
    const totalDocs = getDescendantDocCount(root._id);
    const directSubfolders = (childrenMap.get(String(root._id)) || []).length;
    const totalSubfolders = getDescendantFolderCount(root._id);

    // Collect all descendant folder IDs
    const queue = [root._id];
    const descendantFolderIds = [root._id];
    while (queue.length > 0) {
      const cur = queue.shift();
      const kids = childrenMap.get(String(cur)) || [];
      for (const k of kids) {
        descendantFolderIds.push(k._id);
        queue.push(k._id);
      }
    }

    const docsInTree = allActiveDocs.filter((d) =>
      descendantFolderIds.some((fid) => String(fid) === String(d.folderId))
    );
    const uniqueDocIds = new Set(docsInTree.map((d) => String(d._id)));
    const previewableDocs = docsInTree.filter((d) => d.availabilityStatus !== 'UNAVAILABLE');

    reconciliationRows.push({
      repository: root.name,
      rootFolderId: String(root._id),
      directSubfolders,
      totalSubfolders,
      directDocuments: directDocs,
      totalDescendantDocuments: totalDocs,
      uniqueDocumentIds: uniqueDocIds.size,
      previewableDocuments: previewableDocs.length,
    });
  }

  console.table(reconciliationRows);

  // 2. Deep Dive into DOConCD SINUMERIK - SINAMICS 09/2011 English
  console.log('\n=== 2. SIEMENS OFFICIAL CATALOGUE DEEP DIVE ===');
  const doconcdRoot = roots.find((r) => r.name === 'DOConCD SINUMERIK - SINAMICS 09/2011 English');
  if (doconcdRoot) {
    const directChildren = childrenMap.get(String(doconcdRoot._id)) || [];
    console.log(`Direct Subcategories under "${doconcdRoot.name}": ${directChildren.length}`);

    directChildren.forEach((child, idx) => {
      const childDirectDocs = docCountMap.get(String(child._id)) || 0;
      const childTotalDocs = getDescendantDocCount(child._id);
      const grandKids = (childrenMap.get(String(child._id)) || []).length;
      console.log(
        `  ${idx + 1}. [${child.name}] -> Direct Docs: ${childDirectDocs}, Total Docs: ${childTotalDocs}, Subcategories: ${grandKids}`
      );
    });

    const catalogue = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../data/catalogue_matched.json'), 'utf8')
    );
    console.log(`\nOfficial Catalogue Entries from PDF: ${catalogue.length}`);
    console.log(`Total Documents Ingested in Library Tree: ${reconciliationRows.find((r) => r.repository === doconcdRoot.name).totalDescendantDocuments}`);
  }

  await mongoose.disconnect();
}

verifyAll().catch(console.error);
