import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import https from 'https';

async function generateReport() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));
  const Folder = mongoose.model('Folder', new mongoose.Schema({}, { strict: false }));

  const catPath = path.resolve('backend/data/simodrive_catalogue_extracted.json');
  const catEntries = JSON.parse(fs.readFileSync(catPath, 'utf8'));

  const allDocs = await Document.find({ isArchived: false }).lean();

  const SIMODRIVE_ROOT_ID = '6af9d05ba1a8b3b2f4ddf68b';
  const simFolders = await Folder.find({
    $or: [
      { _id: new mongoose.Types.ObjectId(SIMODRIVE_ROOT_ID) },
      { parentFolderId: new mongoose.Types.ObjectId(SIMODRIVE_ROOT_ID) },
      { path: new RegExp('^/DOConCD_SINUMERIK_SIMODRIVE') }
    ],
    isArchived: false
  }).lean();
  const simFolderIds = new Set(simFolders.map(f => f._id.toString()));

  // Build lookups
  const allDocsById = new Map();
  const allDocsByExactFn = new Map();
  const allDocsByBaseFn = new Map();
  const allDocsByOrder = new Map();
  const allDocsByTitleSys = new Map();

  const normalizeFn = (s) => (s || '').toLowerCase().replace(/\.[^/.]+$/, '').replace(/[_\-\s]/g, '').trim();
  const normalizeOrder = (s) => (s || '').toLowerCase().replace(/[\s\-_]/g, '').trim();

  for (const d of allDocs) {
    allDocsById.set(d._id.toString(), d);
    if (d.fileName) {
      allDocsByExactFn.set(d.fileName.trim().toLowerCase(), d);
      const n = normalizeFn(d.fileName);
      if (n && !allDocsByBaseFn.has(n)) allDocsByBaseFn.set(n, d);
    }
    if (d.originalFileName) {
      allDocsByExactFn.set(d.originalFileName.trim().toLowerCase(), d);
      const base = d.originalFileName.replace(/\.[^/.]+$/, '').trim().toLowerCase();
      if (!allDocsByExactFn.has(base)) allDocsByExactFn.set(base, d);
      const n = normalizeFn(d.originalFileName);
      if (n && !allDocsByBaseFn.has(n)) allDocsByBaseFn.set(n, d);
    }
    const no = normalizeOrder(d.orderNumber);
    if (no && !allDocsByOrder.has(no)) allDocsByOrder.set(no, d);

    if (d.title && d.title !== '—' && d.system && d.system !== '—') {
      const key = `${d.system.trim().toLowerCase()}__${d.title.trim().toLowerCase()}`;
      if (!allDocsByTitleSys.has(key)) allDocsByTitleSys.set(key, d);
    }
  }

  // Scan disk for files
  const diskFiles = new Map();
  function scan(dir) {
    if (!fs.existsSync(dir)) return;
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of list) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) scan(full);
      else if (ent.isFile()) diskFiles.set(ent.name.toLowerCase(), full);
    }
  }
  scan(path.resolve('backend/uploads'));
  scan(path.resolve('backend/temp_migration'));
  scan(path.resolve('temp_migration'));

  // Test streaming from Render for verification
  const prodStreamResults = JSON.parse(fs.readFileSync('backend/data/prod_stream_test_results.json', 'utf8'));
  const prodStreamMap = new Map();
  prodStreamResults.forEach(r => prodStreamMap.set(r.index, r));

  const report = [];
  const classCounts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 };

  for (const entry of catEntries) {
    const rawFn = (entry.fileName || '').trim().toLowerCase();
    const normFn = normalizeFn(entry.fileName);
    const normOrd = normalizeOrder(entry.orderNumber);
    const titleSysKey = `${(entry.system || '').trim().toLowerCase()}__${(entry.title || '').trim().toLowerCase()}`;

    // Match priority
    let matchedDoc = allDocsByExactFn.get(rawFn) ||
                     allDocsByBaseFn.get(normFn) ||
                     (normOrd && normOrd !== '—' ? allDocsByOrder.get(normOrd) : null) ||
                     allDocsByTitleSys.get(titleSysKey);

    // Old matching logic check (scoped strictly to simFolderIds)
    const oldMatched = matchedDoc && simFolderIds.has(matchedDoc.folderId?.toString()) ? matchedDoc : null;
    const currentAvailability = oldMatched && oldMatched.secureUrl ? 'AVAILABLE' : 'MISSING';

    const pdfName = `${rawFn}.pdf`;
    const localPath = diskFiles.get(pdfName) || diskFiles.get(rawFn) || null;
    const physicalExists = Boolean(localPath);

    const prodStream = prodStreamMap.get(entry.catalogueIndex);
    const assetAccessible = prodStream ? (prodStream.status === 200 || prodStream.status === 206) : false;

    // Classification
    let classification = 'E';
    let recommendation = '';

    if (matchedDoc && matchedDoc.secureUrl && matchedDoc.secureUrl.includes('localhost')) {
      classification = 'D'; // Database contains outdated/broken local URL
      recommendation = 'Upload physical PDF to persistent storage / Cloudinary and update secureUrl and storageProvider to ensure accessible remote streaming.';
    } else if (currentAvailability === 'AVAILABLE' && assetAccessible) {
      classification = 'A'; // PDF exists and mapping is correct
      recommendation = 'Retain verified mapping and ensure PDF.js HTTP Range streaming is properly utilized.';
    } else if (currentAvailability === 'MISSING' && matchedDoc && assetAccessible) {
      classification = 'B'; // PDF exists in database/Cloudinary but mapping was scoped out by folder filter
      recommendation = 'Correct catalogue mapping scope to include shared Siemens DOConCD documents and set availabilityStatus=AVAILABLE.';
    } else if (physicalExists && !matchedDoc) {
      classification = 'C'; // PDF exists on disk but DB reference missing
      recommendation = 'Register document in MongoDB repository with exact Siemens catalogue metadata.';
    } else if (!physicalExists && !matchedDoc && !assetAccessible) {
      classification = 'E'; // Genuine missing document
      recommendation = 'Retain MISSING status in catalogue as no physical asset exists.';
    } else {
      classification = 'B';
      recommendation = 'Update catalogue document mapping and resolve storage URL.';
    }

    classCounts[classification] = (classCounts[classification] || 0) + 1;

    report.push({
      catalogueRecordId: entry.catalogueIndex,
      documentTitle: entry.title,
      system: entry.system,
      orderNumber: entry.orderNumber,
      expectedFilename: `${entry.fileName}.pdf`,
      databaseAssetReference: matchedDoc ? matchedDoc._id.toString() : null,
      folderId: matchedDoc ? matchedDoc.folderId?.toString() : null,
      cloudinaryPublicId: matchedDoc ? matchedDoc.cloudinaryPublicId : null,
      localDiskPath: localPath,
      physicalAssetExists: physicalExists,
      assetAccessible,
      currentAvailabilityStatus: currentAvailability,
      classification,
      recommendation
    });
  }

  console.log('=== PHASE 1 DIAGNOSTIC CLASSIFICATION SUMMARY ===');
  console.log(`Total Records: ${catEntries.length}`);
  console.log(`Class A (PDF exists and mapping is correct): ${classCounts.A}`);
  console.log(`Class B (PDF exists but mapping is incorrect / folder scoped out): ${classCounts.B}`);
  console.log(`Class C (PDF exists in storage but DB reference missing): ${classCounts.C}`);
  console.log(`Class D (Database contains outdated/broken localhost URL): ${classCounts.D}`);
  console.log(`Class E (File genuinely does not exist): ${classCounts.E}`);
  console.log(`Class F (Duplicate or ambiguous document mapping): ${classCounts.F}`);
  console.log(`Class G (Access or permission failure): ${classCounts.G}`);

  fs.writeFileSync('backend/data/simodrive_phase1_diagnostic_report.json', JSON.stringify(report, null, 2));
  console.log('Wrote complete Phase 1 diagnostic report to backend/data/simodrive_phase1_diagnostic_report.json');

  await mongoose.disconnect();
}

generateReport().catch(console.error);
