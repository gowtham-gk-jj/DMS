import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

async function analyzeAll212() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));
  const Folder = mongoose.model('Folder', new mongoose.Schema({}, { strict: false }));

  // Load the 212 catalogue entries
  const catPath = path.resolve('backend/data/simodrive_catalogue_extracted.json');
  const catEntries = JSON.parse(fs.readFileSync(catPath, 'utf8'));
  console.log(`Loaded ${catEntries.length} official SIMODRIVE catalogue entries.`);

  // Find all documents in MongoDB
  const allDocs = await Document.find({ isArchived: false }).lean();
  console.log(`Loaded ${allDocs.length} total active documents from MongoDB.`);

  // Find all physical files on disk in the workspace
  const diskFiles = new Map();
  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        scanDir(fullPath);
      } else if (ent.isFile()) {
        const lowerName = ent.name.toLowerCase();
        diskFiles.set(lowerName, {
          name: ent.name,
          fullPath,
          size: fs.statSync(fullPath).size
        });
      }
    }
  }

  console.log('Scanning disk for PDF files...');
  scanDir(path.resolve('backend/uploads'));
  scanDir(path.resolve('backend/temp_migration'));
  scanDir(path.resolve('temp_migration'));
  console.log(`Found ${diskFiles.size} unique filenames on disk.`);

  // Let's inspect each of the 212 entries
  let foundInMongo = 0;
  let foundOnDisk = 0;
  let foundInCloudinary = 0;

  const mongoByExactFn = new Map();
  const mongoByBaseFn = new Map();
  const mongoByOrder = new Map();
  const mongoByTitle = new Map();

  for (const doc of allDocs) {
    if (doc.fileName) {
      mongoByExactFn.set(doc.fileName.trim().toLowerCase(), doc);
    }
    if (doc.originalFileName) {
      const base = doc.originalFileName.replace(/\.[^/.]+$/, '').trim().toLowerCase();
      mongoByBaseFn.set(base, doc);
      mongoByExactFn.set(doc.originalFileName.trim().toLowerCase(), doc);
    }
    if (doc.orderNumber && doc.orderNumber.trim()) {
      mongoByOrder.set(doc.orderNumber.replace(/[\s\-_]/g, '').toLowerCase(), doc);
    }
    if (doc.title) {
      mongoByTitle.set(doc.title.trim().toLowerCase(), doc);
    }
  }

  let matchedEntries = [];

  for (const entry of catEntries) {
    const fn = (entry.fileName || '').trim().toLowerCase();
    const pdfFn = `${fn}.pdf`;
    const cleanOrder = (entry.orderNumber || '').replace(/[\s\-_]/g, '').toLowerCase();

    // Check disk
    const onDisk = diskFiles.get(pdfFn) || diskFiles.get(fn);

    // Check mongo
    let inMongo = mongoByExactFn.get(fn) || mongoByBaseFn.get(fn);
    if (!inMongo && cleanOrder && cleanOrder !== '—') {
      inMongo = mongoByOrder.get(cleanOrder);
    }
    if (!inMongo && entry.title) {
      inMongo = mongoByTitle.get(entry.title.trim().toLowerCase());
    }

    if (inMongo) foundInMongo++;
    if (onDisk) foundOnDisk++;
    if (inMongo && inMongo.secureUrl && inMongo.secureUrl.includes('cloudinary')) foundInCloudinary++;

    matchedEntries.push({
      index: entry.catalogueIndex,
      category: entry.category,
      system: entry.system,
      title: entry.title,
      fileName: entry.fileName,
      orderNumber: entry.orderNumber,
      onDisk: onDisk ? onDisk.fullPath : null,
      onDiskSize: onDisk ? onDisk.size : null,
      inMongoId: inMongo ? inMongo._id.toString() : null,
      inMongoFolderId: inMongo ? inMongo.folderId?.toString() : null,
      inMongoStorageProvider: inMongo ? inMongo.storageProvider : null,
      inMongoSecureUrl: inMongo ? inMongo.secureUrl : null,
      inMongoPublicId: inMongo ? inMongo.cloudinaryPublicId : null,
      inMongoAvailability: inMongo ? inMongo.availabilityStatus : null,
    });
  }

  console.log(`\nAnalysis of 212 SIMODRIVE Catalogue Entries:`);
  console.log(`- Matched in MongoDB: ${foundInMongo} / 212`);
  console.log(`- Found on Local Disk: ${foundOnDisk} / 212`);
  console.log(`- Stored in Cloudinary (via Mongo): ${foundInCloudinary} / 212`);

  // Print first 20 entries
  console.log('\nFirst 20 entries detail:');
  matchedEntries.slice(0, 20).forEach(e => {
    console.log(`[#${e.index}] ${e.fileName} | Title: "${e.title.slice(0, 30)}" | Order: ${e.orderNumber}`);
    console.log(`     Disk: ${e.onDisk ? 'YES (' + e.onDiskSize + 'B)' : 'NO'}`);
    console.log(`     Mongo: ${e.inMongoId ? 'YES (' + e.inMongoId + ', fld=' + e.inMongoFolderId + ', prov=' + e.inMongoStorageProvider + ')' : 'NO'}`);
    console.log(`     Url: ${e.inMongoSecureUrl ? e.inMongoSecureUrl.slice(0, 80) : 'NONE'}`);
  });

  // Write full analysis to a json file for inspection
  fs.writeFileSync('backend/data/simodrive_212_analysis.json', JSON.stringify(matchedEntries, null, 2));
  console.log('\nWrote full analysis to backend/data/simodrive_212_analysis.json');

  await mongoose.disconnect();
}

analyzeAll212().catch(console.error);
