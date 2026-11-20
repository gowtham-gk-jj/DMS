import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import mongoose from 'mongoose';

async function inspect() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Folder = mongoose.model('Folder', new mongoose.Schema({}, { strict: false }));
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));

  const f = await Folder.findById('6af9f28ef959aeeb3d00e1cb').lean();
  console.log('Folder 6af9f28ef959aeeb3d00e1cb:', f);

  // Check the document 6af9f448600e90616dc6cd78 (BAD)
  const docBAD = await Document.findById('6af9f448600e90616dc6cd78').lean();
  console.log('Doc BAD:', docBAD);

  // Check the document 6afa7865d8496612d7ceb7bb (BEM)
  const docBEM = await Document.findById('6afa7865d8496612d7ceb7bb').lean();
  console.log('Doc BEM:', docBEM);

  await mongoose.disconnect();
}

inspect().catch(console.error);
