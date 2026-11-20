import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import mongoose from 'mongoose';

async function inspect() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Folder = mongoose.model('Folder', new mongoose.Schema({}, { strict: false }));
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));

  const folders = await Folder.find({ name: /SIMODRIVE|SINAMICS|DOConCD/i }).lean();
  console.log('--- Folders matching SIMODRIVE/SINAMICS/DOConCD ---');
  folders.forEach(f => {
    console.log({ id: f._id.toString(), name: f.name, path: f.path, parentId: f.parentFolderId?.toString() });
  });

  const simFolder = folders.find(f => f.name.includes('SIMODRIVE'));
  if (simFolder) {
    const simDocs = await Document.find({ folderId: simFolder._id }).lean();
    console.log(`Docs directly in simFolder (${simFolder.name}):`, simDocs.length);

    const allSimFolders = await Folder.find({ 
      $or: [
        { _id: simFolder._id },
        { parentFolderId: simFolder._id },
        { path: new RegExp('^' + simFolder.path) }
      ]
    }).lean();
    console.log('Total SIMODRIVE folders tree count:', allSimFolders.length);
    const folderIds = allSimFolders.map(f => f._id);
    const docsInTree = await Document.find({ folderId: { $in: folderIds } }).lean();
    console.log('Total docs in SIMODRIVE folder tree:', docsInTree.length);
  }

  const totalDocs = await Document.countDocuments({ isArchived: false });
  console.log('Total active documents across entire DB:', totalDocs);

  // Group all documents by folder or category to see where files are!
  const docDistribution = await Document.aggregate([
    { $match: { isArchived: false } },
    { $group: { _id: '$folderId', count: { $sum: 1 }, sampleTitle: { $first: '$title' } } }
  ]);
  console.log('Document distribution across folders:');
  for (const item of docDistribution) {
    const f = await Folder.findById(item._id).lean();
    console.log(`Folder [${f ? f.name : 'UNKNOWN'} (${item._id})]: count=${item.count}, sample="${item.sampleTitle}"`);
  }

  await mongoose.disconnect();
}

inspect().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
