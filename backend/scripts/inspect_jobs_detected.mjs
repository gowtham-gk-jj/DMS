import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkJobs() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Job = mongoose.model('MigrationJob', new mongoose.Schema({}, { strict: false }));
  const Det = mongoose.model('DetectedRepositoryFile', new mongoose.Schema({}, { strict: false }));
  const Asset = mongoose.model('MigrationAsset', new mongoose.Schema({}, { strict: false }));

  console.log('--- ALL MIGRATION JOBS ---');
  const jobs = await Job.find().lean();
  jobs.forEach(j => console.log('Job:', j.jobId, '| file:', j.file, '| fileName:', j.fileName, '| status:', j.status, '| folder:', j.folderName, '| targetFolder:', j.targetFolder));

  console.log('\n--- ALL DETECTED FILES ---');
  const dets = await Det.find().lean();
  dets.forEach(d => console.log('Det:', d.name, '| status:', d.importStatus, '| category:', d.category));

  console.log('\n--- MIGRATION ASSETS SAMPLE ---');
  const assets = await Asset.find().limit(5).lean();
  assets.forEach(a => console.log('Asset keys:', Object.keys(a)));

  await mongoose.disconnect();
}

checkJobs();
