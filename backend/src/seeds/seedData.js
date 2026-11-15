const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Folder = require('../models/Folder');
const Document = require('../models/Document');
const { USER_ROLES, USER_STATUS } = require('../config/constants');

const SAMPLE_DOCS = [
  // Folder: DOConCD_SINUMERIK_SIMODRIVE -> Operation
  {
    folderName: 'Operation',
    parentCode: 'DOConCD_SINUMERIK_SIMODRIVE',
    system: '840D sl',
    title: 'Operating Manual Universal',
    softwareVersion: '2.7',
    edition: '02/11',
    orderNumber: '6FC5398-6AP40-3BA0',
    documentCode: 'BHUsl',
    category: 'Operation',
    originalFileName: 'BHUsl_0211_en.pdf',
    displayName: 'Operating Manual Universal (BHUsl)',
    fileExtension: 'pdf',
    mimeType: 'application/pdf',
    fileSize: 4850000,
    secureUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    cloudinaryPublicId: 'seed/BHUsl_0211_en',
    description: 'Comprehensive operator instructions for SINUMERIK Operate on turning and milling machines.',
    tags: ['SINUMERIK', 'Operate', 'Turning', 'Milling', 'HMI'],
  },
  {
    folderName: 'Operation',
    parentCode: 'DOConCD_SINUMERIK_SIMODRIVE',
    system: '840D sl',
    title: 'Operating Manual Turning',
    softwareVersion: '2.7',
    edition: '02/11',
    orderNumber: '6FC5398-6AP40-3BA1',
    documentCode: 'BHDsl',
    category: 'Operation',
    originalFileName: 'BHDsl_0211_en.pdf',
    displayName: 'Operating Manual Turning (BHDsl)',
    fileExtension: 'pdf',
    mimeType: 'application/pdf',
    fileSize: 3950000,
    secureUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    cloudinaryPublicId: 'seed/BHDsl_0211_en',
    description: 'Detailed instructions for operating lathe machinery with ShopTurn user interface.',
    tags: ['Lathe', 'ShopTurn', '840D sl'],
  },
  {
    folderName: 'Operation',
    parentCode: 'DOConCD_SINUMERIK_SIMODRIVE',
    system: '840D sl',
    title: 'Operating Manual Milling',
    softwareVersion: '2.7',
    edition: '02/11',
    orderNumber: '6FC5398-6AP40-3BA2',
    documentCode: 'BHMsl',
    category: 'Operation',
    originalFileName: 'BHMsl_0211_en.pdf',
    displayName: 'Operating Manual Milling (BHMsl)',
    fileExtension: 'pdf',
    mimeType: 'application/pdf',
    fileSize: 4200000,
    secureUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    cloudinaryPublicId: 'seed/BHMsl_0211_en',
    description: 'Standard milling operations, coordinate setups, and tool management.',
    tags: ['Milling', 'ShopMill', '840D sl'],
  },
  // Folder: DOConCD_SINUMERIK_SIMODRIVE -> Programming
  {
    folderName: 'Programming',
    parentCode: 'DOConCD_SINUMERIK_SIMODRIVE',
    system: '840D sl',
    title: 'Programming Manual Fundamentals',
    softwareVersion: '2.7',
    edition: '02/11',
    orderNumber: '6FC5398-1BP40-3BA0',
    documentCode: 'PGsl',
    category: 'Programming',
    originalFileName: 'PGsl_0211_en.pdf',
    displayName: 'Programming Manual Fundamentals (PGsl)',
    fileExtension: 'pdf',
    mimeType: 'application/pdf',
    fileSize: 5200000,
    secureUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    cloudinaryPublicId: 'seed/PGsl_0211_en',
    description: 'Fundamental G-codes, coordinate systems, linear and circular interpolation, tool offsets.',
    tags: ['G-code', 'NC-Programming', 'Fundamentals'],
  },
  {
    folderName: 'Programming',
    parentCode: 'DOConCD_SINUMERIK_SIMODRIVE',
    system: '840D sl',
    title: 'Programming Manual Advanced',
    softwareVersion: '2.7',
    edition: '02/11',
    orderNumber: '6FC5398-2BP40-3BA0',
    documentCode: 'PGA',
    category: 'Programming',
    originalFileName: 'PGA_0211_en.pdf',
    displayName: 'Programming Manual Advanced (PGA)',
    fileExtension: 'pdf',
    mimeType: 'application/pdf',
    fileSize: 6800000,
    secureUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    cloudinaryPublicId: 'seed/PGA_0211_en',
    description: 'Advanced programming with parametric variables, macro definitions, and synchronous actions.',
    tags: ['Macros', 'SyncActions', 'Advanced'],
  },
  // Folder: DOConCD_SINUMERIK_SIMODRIVE -> Commissioning
  {
    folderName: 'Commissioning',
    parentCode: 'DOConCD_SINUMERIK_SIMODRIVE',
    system: '840D sl',
    title: 'Commissioning Manual CNC and Drives',
    softwareVersion: '2.7',
    edition: '02/11',
    orderNumber: '6FC5398-5AP40-3BA0',
    documentCode: 'IBs',
    category: 'Commissioning',
    originalFileName: 'IBs_0211_en.pdf',
    displayName: 'Commissioning CNC and Drives (IBs)',
    fileExtension: 'pdf',
    mimeType: 'application/pdf',
    fileSize: 7400000,
    secureUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    cloudinaryPublicId: 'seed/IBs_0211_en',
    description: 'Step-by-step commissioning procedures, NCK reset, axis tuning, and safety integrated.',
    tags: ['Commissioning', 'Drives', 'Tuning'],
  },
  // Folder: DOConCD_SINUMERIK_SIMODRIVE -> Functions
  {
    folderName: 'Functions',
    parentCode: 'DOConCD_SINUMERIK_SIMODRIVE',
    system: '840D sl',
    title: 'Function Manual Basic Functions (FB1)',
    softwareVersion: '2.7',
    edition: '02/11',
    orderNumber: '6FC5398-0BP40-3BA0',
    documentCode: 'FB1',
    category: 'Functions',
    originalFileName: 'FB1_0211_en.pdf',
    displayName: 'Function Manual Basic Functions (FB1)',
    fileExtension: 'pdf',
    mimeType: 'application/pdf',
    fileSize: 9100000,
    secureUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    cloudinaryPublicId: 'seed/FB1_0211_en',
    description: 'Signals, feedrate overrides, spindle monitoring, and auxiliary functions.',
    tags: ['FB1', 'Signals', 'PLC'],
  },
  // Folder: DOConCD_SINUMERIK_SINAMICS -> SINAMICS S120
  {
    folderName: 'SINAMICS S120',
    parentCode: 'DOConCD_SINUMERIK_SINAMICS',
    system: 'SINAMICS S120',
    title: 'Commissioning Manual Drive Functions',
    softwareVersion: '4.5',
    edition: '01/13',
    orderNumber: '6SL3097-4AB00-0AP3',
    documentCode: 'IH1',
    category: 'Commissioning',
    originalFileName: 'IH1_0113_en.pdf',
    displayName: 'SINAMICS S120 Drive Functions (IH1)',
    fileExtension: 'pdf',
    mimeType: 'application/pdf',
    fileSize: 8300000,
    secureUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    cloudinaryPublicId: 'seed/IH1_0113_en',
    description: 'Parameterization and optimization of SINAMICS S120 modular drive systems.',
    tags: ['SINAMICS', 'Inverters', 'Drives', 'S120'],
  },
  // Folder: DOConCD_SINUMERIK_SINAMICS -> SIMATIC S7
  {
    folderName: 'SIMATIC S7',
    parentCode: 'DOConCD_SINUMERIK_SINAMICS',
    system: 'SIMATIC S7-300',
    title: 'PLC Toolbox and Basic Software Manual',
    softwareVersion: '5.5',
    edition: '04/12',
    orderNumber: '6ES7810-4CA10-8BW1',
    documentCode: 'S7sl',
    category: 'SIMATIC',
    originalFileName: 'S7sl_0412_en.pdf',
    displayName: 'SIMATIC S7 Integration Guide (S7sl)',
    fileExtension: 'pdf',
    mimeType: 'application/pdf',
    fileSize: 6100000,
    secureUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    cloudinaryPublicId: 'seed/S7sl_0412_en',
    description: 'Hardware configuration, ladder logic blocks, and DB exchange with CNC.',
    tags: ['SIMATIC', 'STEP 7', 'PLC'],
  },
  // Training Diagram / Image
  {
    folderName: 'Training Documents',
    parentCode: 'DOConCD_SINUMERIK_SINAMICS',
    system: '840D sl / S120',
    title: 'System Architecture & Interconnect Topology Diagram',
    softwareVersion: '4.7',
    edition: '08/18',
    orderNumber: '6FC5398-0TP40-0AA0',
    documentCode: 'ARCH-01',
    category: 'Info / Training',
    originalFileName: 'Sinumerik_S120_Topology.png',
    displayName: 'System Topology Schematic Diagram',
    fileExtension: 'png',
    mimeType: 'image/png',
    fileSize: 1420000,
    secureUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
    cloudinaryPublicId: 'seed/Sinumerik_S120_Topology',
    description: 'High-resolution industrial hardware schematic and bus interconnect diagram.',
    tags: ['Schematic', 'DRIVE-CLiQ', 'Architecture'],
  },
];

async function seedDatabase() {
  try {
    console.log('[Seed] Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_URI);

    // 1. Ensure Master Admin User
    const adminEmail = (process.env.ADMIN_EMAIL || 'loganathan8754114450@gmail.com').toLowerCase().trim();
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      admin = new User({
        name: 'Chief System Administrator',
        email: adminEmail,
        role: USER_ROLES.ADMIN,
        status: USER_STATUS.APPROVED,
        permissions: { read: true, upload: true, download: true, manage: true },
        organization: 'Enterprise Engineering Core',
        department: 'Systems & Architecture',
        lastLoginAt: new Date(),
      });
      await admin.save();
      console.log(`[Seed] Created Master Administrator: ${adminEmail}`);
    } else {
      admin.role = USER_ROLES.ADMIN;
      admin.status = USER_STATUS.APPROVED;
      admin.permissions = { read: true, upload: true, download: true, manage: true };
      await admin.save();
      console.log(`[Seed] Verified Master Administrator: ${adminEmail}`);
    }

    // 2. Ensure Root Folders
    const rootFolders = [
      {
        name: 'DOConCD_SINUMERIK_SIMODRIVE',
        code: 'DOConCD_SINUMERIK_SIMODRIVE',
        description: 'Complete documentation for SINUMERIK 840D/840Di/810D and SIMODRIVE 611 drives.',
        path: '/DOConCD_SINUMERIK_SIMODRIVE',
        level: 0,
      },
      {
        name: 'DOConCD_SINUMERIK_SINAMICS',
        code: 'DOConCD_SINUMERIK_SINAMICS',
        description: 'Technical document repository for SINUMERIK Solution Line and SINAMICS S120 drives.',
        path: '/DOConCD_SINUMERIK_SINAMICS',
        level: 0,
      },
    ];

    const folderMap = {};

    for (const rf of rootFolders) {
      let folder = await Folder.findOne({ name: rf.name, parentFolderId: null });
      if (!folder) {
        folder = new Folder({ ...rf, createdBy: admin._id });
        await folder.save();
        console.log(`[Seed] Created Root Folder: ${folder.name}`);
      }
      folderMap[rf.code] = folder;
    }

    // 3. Ensure Subfolders
    const subfolders = [
      // For DOConCD_SINUMERIK_SIMODRIVE
      { name: 'Operation', parentCode: 'DOConCD_SINUMERIK_SIMODRIVE' },
      { name: 'Programming', parentCode: 'DOConCD_SINUMERIK_SIMODRIVE' },
      { name: 'Commissioning', parentCode: 'DOConCD_SINUMERIK_SIMODRIVE' },
      { name: 'Functions', parentCode: 'DOConCD_SINUMERIK_SIMODRIVE' },
      { name: 'Diagnostics', parentCode: 'DOConCD_SINUMERIK_SIMODRIVE' },

      // For DOConCD_SINUMERIK_SINAMICS
      { name: 'SINAMICS S120', parentCode: 'DOConCD_SINUMERIK_SINAMICS' },
      { name: 'SIMATIC S7', parentCode: 'DOConCD_SINUMERIK_SINAMICS' },
      { name: 'Motors & Encoders', parentCode: 'DOConCD_SINUMERIK_SINAMICS' },
      { name: 'Training Documents', parentCode: 'DOConCD_SINUMERIK_SINAMICS' },
    ];

    for (const sf of subfolders) {
      const parent = folderMap[sf.parentCode];
      if (!parent) continue;

      let sub = await Folder.findOne({ name: sf.name, parentFolderId: parent._id });
      if (!sub) {
        sub = new Folder({
          name: sf.name,
          parentFolderId: parent._id,
          level: 1,
          path: `${parent.path}/${sf.name}`,
          createdBy: admin._id,
        });
        await sub.save();
        console.log(`[Seed] Created Subfolder: ${parent.name} -> ${sub.name}`);
      }
      folderMap[`${sf.parentCode}/${sf.name}`] = sub;
    }

    // 4. Ensure Sample Documents
    for (const docData of SAMPLE_DOCS) {
      const targetFolder = folderMap[`${docData.parentCode}/${docData.folderName}`];
      if (!targetFolder) continue;

      const existingDoc = await Document.findOne({
        originalFileName: docData.originalFileName,
        folderId: targetFolder._id,
      });

      if (!existingDoc) {
        const { folderName, parentCode, ...cleanDoc } = docData;
        const newDoc = new Document({
          ...cleanDoc,
          folderId: targetFolder._id,
          uploadedBy: admin._id,
        });
        await newDoc.save();
        console.log(`[Seed] Created Document: ${newDoc.documentCode} - ${newDoc.title}`);
      }
    }

    console.log('[Seed] Database initialization completed successfully!');
    await mongoose.disconnect();
  } catch (err) {
    console.error('[Seed Error]', err);
    process.exit(1);
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
