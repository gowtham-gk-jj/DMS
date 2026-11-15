const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  const collections = await mongoose.connection.db.listCollections().toArray();
  for (const c of collections) {
    const count = await mongoose.connection.db.collection(c.name).countDocuments();
    console.log(c.name + ': ' + count);
  }
  const folders = await mongoose.connection.db.collection('folders').find({}).toArray();
  console.log('Existing folders count:', folders.length);
  folders.forEach(f => {
    console.log(`- ${f._id}: ${f.name} (path: ${f.path})`);
  });
  const users = await mongoose.connection.db.collection('users').find({}).toArray();
  console.log('Users count:', users.length);
  users.forEach(u => {
    console.log(`- ${u.email} (${u.role})`);
  });
  await mongoose.disconnect();
}
check().catch(console.error);

async function listDocs() {
  await mongoose.connect(process.env.MONGODB_URI);
  const docs = await mongoose.connection.db.collection('documents').find({}).toArray();
  console.log('--- Current Documents in DB ---');
  docs.forEach(d => console.log(JSON.stringify({ id: d._id, title: d.title, fileName: d.originalFileName, folderId: d.folderId, url: d.secureUrl })));
  await mongoose.disconnect();
}
if (process.argv[2] === 'docs') {
  listDocs().catch(console.error);
}
