import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import mongoose from 'mongoose';
import { streamDocument } from '../src/controllers/documentController.js';

async function testStream() {
  await mongoose.connect(process.env.MONGODB_URI);

  const Document = mongoose.model('Document');
  const doc = await Document.findById('6afa7865d8496612d7ceb7bb');
  console.log('Doc found:', doc.title, doc.secureUrl);

  const req = {
    params: { id: '6afa7865d8496612d7ceb7bb' },
    headers: {
      range: 'bytes=0-65535'
    },
    user: { _id: '6af9d059a1a8b3b2f4ddf68a', role: 'ADMIN' }
  };

  const headers = {};
  let statusCode = 200;
  let chunks = [];

  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    setHeader: (k, v) => {
      headers[k] = v;
    },
    write: (chunk) => {
      chunks.push(chunk);
    },
    end: (chunk) => {
      if (chunk) chunks.push(chunk);
      console.log('--- Stream completed ---');
      console.log('Status code:', statusCode);
      console.log('Headers sent:', headers);
      const totalBytes = chunks.reduce((a, c) => a + c.length, 0);
      console.log('Total bytes received:', totalBytes);
      if (chunks.length > 0) {
        const first = Buffer.concat(chunks).slice(0, 20).toString();
        console.log('First 20 bytes:', first);
      }
    },
    json: (obj) => {
      console.log('res.json called:', statusCode, obj);
    }
  };

  // Note: streamRemoteFile pipes to res. In Node stream piping:
  // res needs to implement Writable stream interface.
  const { Writable } = await import('stream');
  const writableRes = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(chunk);
      callback();
    }
  });
  writableRes.status = (c) => { statusCode = c; return writableRes; };
  writableRes.setHeader = (k, v) => { headers[k] = v; };
  writableRes.json = (obj) => { console.log('res.json called:', statusCode, obj); };
  writableRes.on('finish', () => {
    console.log('--- Writable stream finished ---');
    console.log('Status code:', statusCode);
    console.log('Headers sent:', headers);
    const totalBytes = chunks.reduce((a, c) => a + c.length, 0);
    console.log('Total bytes received:', totalBytes);
    if (chunks.length > 0) {
      const first = Buffer.concat(chunks).slice(0, 20).toString();
      console.log('First 20 bytes:', first);
    }
    mongoose.disconnect();
  });

  await streamDocument(req, writableRes, (err) => console.error(err));
}

testStream().catch(console.error);
