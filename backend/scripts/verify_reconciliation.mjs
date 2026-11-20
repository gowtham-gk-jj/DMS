import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';

async function testReconciliation() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));

  const simodriveJsonPath = path.resolve('backend/data/simodrive_catalogue_extracted.json');
  const rawCatalogue = JSON.parse(fs.readFileSync(simodriveJsonPath, 'utf8'));

  const SIMODRIVE_ROOT_ID = '6af9d05ba1a8b3b2f4ddf68b';
  const allDocs = await Document.find({ isArchived: false })
    .select('_id title originalFileName fileName orderNumber secureUrl fileSize mimeType fileExtension storageProvider folderId availabilityStatus system softwareVersion edition category updatedAt')
    .lean();

  const normalizeFn = (s) => (s || '').toLowerCase().replace(/\.[^/.]+$/, '').replace(/[_\-\s]/g, '').trim();
  const normalizeOrder = (s) => (s || '').toLowerCase().replace(/[\s\-_]/g, '').trim();

  let availableCount = 0;
  let missingCount = 0;
  const missingEntries = [];

  for (const catEntry of rawCatalogue) {
    const rawFn = (catEntry.fileName || '').trim().toLowerCase();
    const normFn = normalizeFn(catEntry.fileName);
    const normOrd = normalizeOrder(catEntry.orderNumber);

    const exactMatches = allDocs.filter((d) => {
      const dfn = (d.fileName || '').trim().toLowerCase();
      const dofn = (d.originalFileName || '').trim().toLowerCase();
      const base = dofn.replace(/\.[^/.]+$/, '').trim();
      return dfn === rawFn || dofn === `${rawFn}.pdf` || base === rawFn;
    });

    const orderMatches = normOrd && normOrd !== '—'
      ? allDocs.filter((d) => normalizeOrder(d.orderNumber) === normOrd)
      : [];

    let matchedDoc = null;
    const simDirExact = exactMatches.find((d) => String(d.folderId) === SIMODRIVE_ROOT_ID);
    if (simDirExact) {
      matchedDoc = simDirExact;
    } else if (exactMatches.length === 1) {
      matchedDoc = exactMatches[0];
    } else if (exactMatches.length > 1) {
      const withOrder = exactMatches.find((d) => normalizeOrder(d.orderNumber) === normOrd);
      matchedDoc = withOrder || exactMatches[0];
    } else if (orderMatches.length > 0) {
      matchedDoc = orderMatches[0];
    } else {
      const normMatch = allDocs.find((d) => {
        const dNorm = normalizeFn(d.fileName || d.originalFileName);
        return dNorm === normFn;
      });
      if (normMatch) {
        matchedDoc = normMatch;
      }
    }

    const isAvailable = Boolean(matchedDoc && (matchedDoc.secureUrl || matchedDoc.availabilityStatus === 'AVAILABLE'));

    if (isAvailable) {
      availableCount++;
    } else {
      missingCount++;
      missingEntries.push(catEntry);
    }
  }

  console.log(`Reconciliation results:`);
  console.log(`- Total Official Catalogue Records: ${rawCatalogue.length}`);
  console.log(`- Available: ${availableCount}`);
  console.log(`- Missing: ${missingCount}`);

  if (missingCount > 0) {
    console.log('Missing entries:', missingEntries);
  }

  await mongoose.disconnect();
}

testReconciliation().catch(console.error);
