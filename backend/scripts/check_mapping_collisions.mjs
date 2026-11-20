import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

async function checkCollisions() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));

  const catPath = path.resolve('backend/data/simodrive_catalogue_extracted.json');
  const catEntries = JSON.parse(fs.readFileSync(catPath, 'utf8'));

  const sinPath = path.resolve('backend/data/sinamics_catalogue_extracted.json');
  const sinEntries = JSON.parse(fs.readFileSync(sinPath, 'utf8'));

  const allDocs = await Document.find({ isArchived: false }).lean();

  console.log(`Checking matching for all ${catEntries.length} SIMODRIVE entries...`);

  const normalizeFn = (s) => (s || '').toLowerCase().replace(/\.[^/.]+$/, '').replace(/[_\-\s]/g, '').trim();
  const normalizeOrder = (s) => (s || '').toLowerCase().replace(/[\s\-_]/g, '').trim();

  // Test multi-priority matching
  let matchedCount = 0;
  let matches = [];

  for (const entry of catEntries) {
    const rawFn = (entry.fileName || '').trim().toLowerCase();
    const normFn = normalizeFn(entry.fileName);
    const normOrd = normalizeOrder(entry.orderNumber);

    // Exact fileName match candidates
    const exactMatches = allDocs.filter(d => {
      const dfn = (d.fileName || '').trim().toLowerCase();
      const dofn = (d.originalFileName || '').trim().toLowerCase();
      const base = dofn.replace(/\.[^/.]+$/, '').trim();
      return dfn === rawFn || dofn === `${rawFn}.pdf` || base === rawFn;
    });

    // Order number match candidates
    const orderMatches = normOrd && normOrd !== '—'
      ? allDocs.filter(d => normalizeOrder(d.orderNumber) === normOrd)
      : [];

    let selectedDoc = null;
    let matchType = 'NONE';

    // Priority 1: Exact fileName match within SIMODRIVE folder
    const simDirExact = exactMatches.find(d => d.folderId?.toString() === '6af9d05ba1a8b3b2f4ddf68b');
    if (simDirExact) {
      selectedDoc = simDirExact;
      matchType = 'EXACT_FN_SIM_DIR';
    } else if (exactMatches.length === 1) {
      selectedDoc = exactMatches[0];
      matchType = 'EXACT_FN_SHARED';
    } else if (exactMatches.length > 1) {
      // If multiple, check order number or title
      const withOrder = exactMatches.find(d => normalizeOrder(d.orderNumber) === normOrd);
      if (withOrder) {
        selectedDoc = withOrder;
        matchType = 'EXACT_FN_AND_ORDER';
      } else {
        selectedDoc = exactMatches[0];
        matchType = 'EXACT_FN_MULTIPLE';
      }
    } else if (orderMatches.length > 0) {
      selectedDoc = orderMatches[0];
      matchType = 'ORDER_NO';
    }

    if (selectedDoc) {
      matchedCount++;
      matches.push({
        index: entry.catalogueIndex,
        fileName: entry.fileName,
        title: entry.title,
        orderNumber: entry.orderNumber,
        matchedDocId: selectedDoc._id.toString(),
        matchedDocTitle: selectedDoc.title,
        matchedDocFile: selectedDoc.originalFileName,
        matchedDocUrl: selectedDoc.secureUrl,
        matchedDocFolder: selectedDoc.folderId?.toString(),
        matchType
      });
    } else {
      console.log(`UNMATCHED: [#${entry.catalogueIndex}] ${entry.fileName} | Order: ${entry.orderNumber} | Title: ${entry.title}`);
    }
  }

  console.log(`\nMatched ${matchedCount} / ${catEntries.length} SIMODRIVE entries.`);
  const matchTypes = {};
  matches.forEach(m => matchTypes[m.matchType] = (matchTypes[m.matchType] || 0) + 1);
  console.log('Match types breakdown:', matchTypes);

  // Write matches to inspect
  fs.writeFileSync('backend/data/simodrive_verified_matches.json', JSON.stringify(matches, null, 2));

  await mongoose.disconnect();
}

checkCollisions().catch(console.error);
