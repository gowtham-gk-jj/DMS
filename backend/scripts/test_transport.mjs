import * as pdfjsLib from '../../frontend/node_modules/pdfjs-dist/legacy/build/pdf.mjs';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import jwt from 'jsonwebtoken';

class TestTransport extends pdfjsLib.PDFDataRangeTransport {
  constructor(length, initialData, streamUrl, token) {
    super(length, initialData, false);
    this.streamUrl = streamUrl;
    this.token = token;
  }

  async requestDataRange(begin, end) {
    console.log(`[TestTransport] requestDataRange called for ${begin}-${end}`);
    try {
      const res = await fetch(this.streamUrl, {
        headers: {
          Range: `bytes=${begin}-${end - 1}`,
          Authorization: `Bearer ${this.token}`
        }
      });
      const buffer = await res.arrayBuffer();
      console.log(`[TestTransport] received ${buffer.byteLength} bytes for range ${begin}-${end}`);
      this.onDataRange(begin, new Uint8Array(buffer));
    } catch (e) {
      console.error(`[TestTransport] error:`, e);
    }
  }
}

async function run() {
  const token = jwt.sign(
    { id: '6af9e5e81afb351711b36fdd', email: 'technova552026@gmail.com', role: 'ADMIN', status: 'APPROVED' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  const streamUrl = `https://dms-dab9.onrender.com/api/documents/6afa7865d8496612d7ceb7bb/stream?token=${encodeURIComponent(token)}`;

  // First fetch initial 64KB
  console.log('Fetching initial 64KB...');
  const res = await fetch(streamUrl, {
    headers: {
      Range: 'bytes=0-65535',
      Authorization: `Bearer ${token}`
    }
  });
  const initialBuffer = await res.arrayBuffer();
  console.log('Got initial 64KB:', initialBuffer.byteLength);

  const totalLen = 3371040;
  const transport = new TestTransport(totalLen, new Uint8Array(initialBuffer), streamUrl, token);

  console.log('Initializing PDF.js with range transport...');
  try {
    const task = pdfjsLib.getDocument({
      range: transport,
      rangeChunkSize: 65536,
      disableAutoFetch: true,
      disableStream: false,
    });
    const doc = await task.promise;
    console.log('Transport SUCCESS! Num pages:', doc.numPages);
    const page = await doc.getPage(1);
    console.log('Page 1 loaded successfully! Viewport:', page.getViewport({ scale: 1 }));
  } catch (err) {
    console.error('Transport FAILED with error:', err);
  }
}

run().catch(console.error);
