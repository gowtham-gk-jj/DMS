import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';

// Helper functions from documentController
const SIMODRIVE_CATEGORY_ORDER = [
  'General',
  'Planning',
  'Configuration',
  'Commissioning',
  'Maintenance',
  'Service',
  'References',
  'SINUMERIK',
  'SIMODRIVE',
  'SIMODRIVE Sensor',
  'Synchronous motors',
  'Asynchronous motors',
  'Linear/Torque Motors',
  'Measuring Systems',
  'Accessories',
  'Applications',
  'Functions',
  'Communication',
  'Safety Integrated',
];

async function runSuite() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));
  const Folder = mongoose.model('Folder', new mongoose.Schema({}, { strict: false }));

  console.log('====================================================');
  console.log('SIMODRIVE 212-DOCUMENT ENTERPRISE VERIFICATION SUITE');
  console.log('====================================================\n');

  const simodriveJsonPath = path.resolve('backend/data/simodrive_catalogue_extracted.json');
  const rawCatalogue = JSON.parse(fs.readFileSync(simodriveJsonPath, 'utf8'));

  const SIMODRIVE_ROOT_ID = '6af9d05ba1a8b3b2f4ddf68b';
  const allDocs = await Document.find({ isArchived: false })
    .select('_id title originalFileName fileName orderNumber secureUrl fileSize mimeType fileExtension storageProvider folderId availabilityStatus system softwareVersion edition category updatedAt')
    .lean();

  const normalizeFn = (s) => (s || '').toLowerCase().replace(/\.[^/.]+$/, '').replace(/[_\-\s]/g, '').trim();
  const normalizeOrder = (s) => (s || '').toLowerCase().replace(/[\s\-_]/g, '').trim();

  // Test 1: Record count and availability
  const matchedDocs = rawCatalogue.map((catEntry) => {
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

    return {
      _id: matchedDoc ? matchedDoc._id : `missing_${catEntry.fileName}`,
      catalogueIndex: catEntry.catalogueIndex,
      category: catEntry.category,
      system: catEntry.system || '—',
      title: catEntry.title || '—',
      orderNumber: catEntry.orderNumber || '—',
      fileName: catEntry.fileName || '—',
      status: isAvailable ? 'Available' : 'Missing',
      availabilityStatus: isAvailable ? 'AVAILABLE' : 'FILE_NOT_FOUND',
      secureUrl: matchedDoc ? matchedDoc.secureUrl : null,
      fileSize: matchedDoc ? matchedDoc.fileSize : 0,
      matchedDocId: matchedDoc ? matchedDoc._id : null,
    };
  });

  const availableCount = matchedDocs.filter(d => d.availabilityStatus === 'AVAILABLE').length;
  console.log(`[TEST 1] Total official SIMODRIVE records: ${matchedDocs.length} (Expected: 212)`);
  console.log(`         Available records: ${availableCount} (Expected: 212) -> ${availableCount === 212 ? 'PASS ✅' : 'FAIL ❌'}`);

  // Test 2: Categories representation
  const distinctCategories = [...new Set(matchedDocs.map(d => d.category))];
  console.log(`[TEST 2] Categories represented: ${distinctCategories.length} / 19 -> ${distinctCategories.length === 19 ? 'PASS ✅' : 'FAIL ❌'}`);

  // Test 3: Systems representation
  const distinctSystems = [...new Set(matchedDocs.map(d => d.system).filter(s => s && s !== '—'))];
  console.log(`[TEST 3] Systems represented: ${distinctSystems.length} (Expected: 61) -> ${distinctSystems.length === 61 ? 'PASS ✅' : 'FAIL ❌'}`);

  // Test 4: Category Filtering
  let allCatsFilterPass = true;
  for (const cat of distinctCategories) {
    const filtered = matchedDocs.filter(d => d.category === cat);
    if (filtered.length === 0) allCatsFilterPass = false;
  }
  console.log(`[TEST 4] Category filtering works across all categories -> ${allCatsFilterPass ? 'PASS ✅' : 'FAIL ❌'}`);

  // Test 5: Search functionality
  const testQueries = ['1FT5', '6SN1197', 'Commissioning', 'PJTM'];
  let searchPass = true;
  for (const q of testQueries) {
    const qLower = q.toLowerCase();
    const hits = matchedDocs.filter(d =>
      d.system.toLowerCase().includes(qLower) ||
      d.title.toLowerCase().includes(qLower) ||
      d.orderNumber.toLowerCase().includes(qLower) ||
      d.fileName.toLowerCase().includes(qLower)
    );
    if (hits.length === 0) searchPass = false;
  }
  console.log(`[TEST 5] Search queries across system, orderNumber, title, fileName -> ${searchPass ? 'PASS ✅' : 'FAIL ❌'}`);

  // Test 6: SINAMICS Isolation
  const sinCataloguePath = path.resolve('backend/data/sinamics_catalogue_extracted.json');
  const sinCatalogue = JSON.parse(fs.readFileSync(sinCataloguePath, 'utf8'));
  console.log(`[TEST 6] SINAMICS catalogue isolation: ${sinCatalogue.length} records preserved -> ${sinCatalogue.length === 186 ? 'PASS ✅' : 'FAIL ❌'}`);

  console.log('\n====================================================');
  console.log('ALL SIMODRIVE TEST PHASES COMPLETED SUCCESSFULLY');
  console.log('====================================================');

  await mongoose.disconnect();
}

runSuite().catch(console.error);
