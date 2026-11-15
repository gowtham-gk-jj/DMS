const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Folder = require('../src/models/Folder');
const User = require('../src/models/User');

const FOLDER_TREE = {
  name: 'DOConCD SINUMERIK - SINAMICS 09/2011 English',
  code: 'DOCONCD_0911',
  description: 'Master Siemens DOConCD SINUMERIK / SINAMICS 09/2011 English Technical Documentation Library',
  children: [
    {
      name: '840D sl / 840Di sl / 828D User',
      code: '840D_USER',
      description: 'Operator and programming guides for 840D sl, 840Di sl, and 828D',
      children: [
        {
          name: 'Operation',
          code: '840D_USER_OP',
          description: 'Universal, Turning, Milling, HMI-Embedded, HMI-Advanced, and Diagnostics',
        },
        {
          name: 'Programming',
          code: '840D_USER_PROG',
          description: 'Fundamentals, Job Planning, Measuring Cycles, ISO dialects, and System Variables',
        },
      ],
    },
    {
      name: '840D sl Manufacturer / Service',
      code: '840D_MFG',
      description: 'Configuring and commissioning documentation for machine manufacturers and service',
      children: [
        {
          name: 'Configuring',
          code: '840D_MFG_CONF',
          description: 'NCU hardware, machine configuration guidelines, Ctrl-Energy, and networking',
        },
        {
          name: 'Commissioning',
          code: '840D_MFG_COMM',
          description: 'CNC: NCK, PLC, drive, HMI-Advanced, basesoftware, lists, and machine data',
        },
      ],
    },
    {
      name: 'Functions',
      code: 'FUNCTIONS',
      description: 'Basic Functions, Extended Functions, Special Functions, Tool Management, and Safety Integrated',
    },
    {
      name: '828D Manufacturer / Service',
      code: '828D_MFG',
      description: '828D commissioning, diagnostics, parameter lists, and service manuals',
      children: [
        {
          name: 'Version 4.3',
          code: '828D_V43',
          description: '828D SW Version 4.3 Diagnostics, Parameter Manual, PPU, and Service Manual',
        },
        {
          name: 'Version 2.6',
          code: '828D_V26',
          description: '828D SW Version 2.6 Diagnostics, Parameter Manual, PPU, and Service Manual',
        },
      ],
    },
    {
      name: '802D sl',
      code: '802D_SL',
      description: 'SINUMERIK 802D sl User and Manufacturer / Service manuals',
      children: [
        {
          name: 'User',
          code: '802D_USER',
          description: '802D sl Operation and Programming for Turning, Milling, Grinding, and Nibbling',
        },
        {
          name: 'Manufacturer / Service',
          code: '802D_MFG',
          description: '802D sl Function Manual, Diagnostics, and Parameter description',
        },
      ],
    },
    {
      name: 'SINAMICS S120',
      code: 'SINAMICS_S120',
      description: 'Control Units, Booksize power units, Chassis, Commissioning, and Drive functions',
    },
    {
      name: 'Measuring Systems',
      code: 'MEASURING_SYSTEMS',
      description: 'Absolute value encoders, hollow-shaft measuring systems, ERN 1381/1387, and connection caps',
    },
    {
      name: 'Synchronous Motors',
      code: 'SYNC_MOTORS',
      description: '1FK7, 1FT7, 1FT6, 1FE1, 1FN, and 1FW synchronous motors and voltage limiting modules',
    },
    {
      name: 'Asynchronous Motors',
      code: 'ASYNC_MOTORS',
      description: '1PH8, 1PH7, 1PL6, 1PH4, 1PM4, 1PM6, 1PH2 induction and spindle motors',
    },
    {
      name: 'Linear / Torque Motors',
      code: 'LINEAR_TORQUE',
      description: '1FN1, 1FN3 linear motors and 1FW6, 1FW3 complete torque motors',
    },
    {
      name: 'Motion Control Information System',
      code: 'MCIS',
      description: 'Computer Link RPC, DNC, TDI Tool Data Information, ADDM, and MDA Machine Evaluations',
    },
    {
      name: 'ePS Network Services',
      code: 'EPS_SERVICES',
      description: 'ePS Network Services Configuration, Function Manual, and eP-Satellite server',
    },
    {
      name: 'SIMATIC',
      code: 'SIMATIC',
      description: 'STEP 7, LAD, FBD, STL, CPU 31xC/31x, S7-200, PROFINET, and Mobile Panel 177',
    },
    {
      name: 'Info / Training',
      code: 'INFO_TRAINING',
      description: 'Training documents for ShopMill, ShopTurn, 5-axis machining, mold making, and glossaries',
    },
    {
      name: 'Control System Overview',
      code: 'CONTROL_OVERVIEW',
      description: 'SINUMERIK solution line and 828D overviews of functions and operator interfaces',
    },
  ],
};

async function createHierarchy() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const admin = (await User.findOne({ role: 'ADMIN' }).lean()) || (await User.findOne().lean());
  const adminId = admin ? admin._id : null;

  // Fetch all existing folders into memory
  const existingFolders = await Folder.find({ isArchived: false }).lean();
  const folderByPath = new Map(existingFolders.map((f) => [f.path, f]));
  const folderByNameAndParent = new Map(existingFolders.map((f) => [`${f.name}_${f.parentFolderId}`, f]));

  const toInsert = [];
  const folderIdMap = new Map();

  // Pre-generate ObjectIDs for any new nodes so we can insert in bulk!
  function prepareNode(node, parentId = null, currentPath = '') {
    const nodePath = `${currentPath}/${node.name}`;
    let existing = folderByPath.get(nodePath) || folderByNameAndParent.get(`${node.name}_${parentId}`);

    let nodeId;
    if (existing) {
      nodeId = existing._id;
      console.log(`[EXISTING] ${nodePath} (ID: ${nodeId})`);
    } else {
      nodeId = new mongoose.Types.ObjectId();
      toInsert.push({
        _id: nodeId,
        name: node.name,
        code: node.code,
        description: node.description || '',
        parentFolderId: parentId,
        path: nodePath,
        level: parentId ? currentPath.split('/').length - 1 : 0,
        createdBy: adminId,
        isArchived: false,
      });
      console.log(`[QUEUED INSERT] ${nodePath} (ID: ${nodeId})`);
    }

    folderIdMap.set(node.name, nodeId);
    folderIdMap.set(nodePath, nodeId);

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        prepareNode(child, nodeId, nodePath);
      }
    }
  }

  prepareNode(FOLDER_TREE, null, '');

  if (toInsert.length > 0) {
    console.log(`\nInserting ${toInsert.length} new folders in bulk...`);
    await Folder.insertMany(toInsert);
    console.log(`Successfully inserted ${toInsert.length} folders!`);
  } else {
    console.log('\nAll folders already exist in MongoDB!');
  }

  const allFolders = await Folder.find({ isArchived: false }).lean();
  console.log(`Total active folders in database: ${allFolders.length}`);

  // Save folder mapping to JSON for migration script
  const folderLookup = {};
  allFolders.forEach((f) => {
    folderLookup[f.name] = f._id.toString();
    folderLookup[f.path] = f._id.toString();
  });
  const fs = require('fs');
  fs.writeFileSync(
    path.join(__dirname, '../data/folder_lookup.json'),
    JSON.stringify(folderLookup, null, 2)
  );
  console.log('Saved folder lookup to data/folder_lookup.json');

  await mongoose.disconnect();
}

createHierarchy().catch((err) => {
  console.error('Failed to provision folder tree:', err);
  process.exit(1);
});
