import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import jwt from 'jsonwebtoken';
import https from 'https';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

const token = jwt.sign(
  {
    id: '6af9e5e81afb351711b36fdd',
    email: 'technova552026@gmail.com',
    role: 'ADMIN',
    status: 'APPROVED',
  },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

function uploadFileToRender(filePath, originalname, folderId) {
  return new Promise((resolve, reject) => {
    const fileStats = fs.statSync(filePath);
    console.log(`Uploading ${originalname} (${(fileStats.size / (1024*1024)).toFixed(2)} MB) to Render...`);

    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

    const header = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="files"; filename="${originalname}"\r\n` +
      `Content-Type: application/pdf\r\n\r\n`
    );

    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const fileData = fs.readFileSync(filePath);
    const body = Buffer.concat([header, fileData, footer]);

    const options = {
      hostname: 'dms-dab9.onrender.com',
      path: `/api/documents/folder/${folderId}/upload`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      }
    };

    const req = https.request(options, (res) => {
      let resBody = '';
      res.on('data', d => resBody += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(resBody);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, body: resBody });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function syncAll() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));

  // Files to upload
  const filesToSync = [
    {
      code: 'APPL_HB',
      targetDocId: '6afa7848d8496612d7ceb72f',
      localPath: path.resolve('backend/uploads/1794799688759_APPL_HB_APPL_HB.pdf'),
      filename: 'APPL_HB.pdf',
      folderId: '6af9d05ba1a8b3b2f4ddf68b'
    },
    {
      code: 'BH',
      targetDocId: '6afa7866d8496612d7ceb7bd',
      localPath: path.resolve('backend/uploads/1794799718561_BH_BH.pdf'),
      filename: 'BH.pdf',
      folderId: '6af9d05ba1a8b3b2f4ddf68b'
    },
    {
      code: 'BNM',
      targetDocId: '6afa7868d8496612d7ceb7bf',
      localPath: path.resolve('backend/uploads/1794799719972_BNM_BNM.pdf'),
      filename: 'BNM.pdf',
      folderId: '6af9d05ba1a8b3b2f4ddf68b'
    },
    {
      code: 'FB1',
      targetDocId: '6afa7880d8496612d7ceb83d',
      localPath: path.resolve('backend/uploads/1794799744492_FB1_FB1.pdf'),
      filename: 'FB1.pdf',
      folderId: '6af9d05ba1a8b3b2f4ddf68b'
    },
    {
      code: 'FB3',
      targetDocId: '6afa788dd8496612d7ceb871',
      localPath: path.resolve('backend/uploads/1794799756818_FB3_FB3.pdf'),
      filename: 'FB3.pdf',
      folderId: '6af9d05ba1a8b3b2f4ddf68b'
    },
    {
      code: 'BAD',
      targetDocId: '6af9f448600e90616dc6cd78',
      localPath: path.resolve('backend/uploads/1794765896341_BAD_BAD.pdf'),
      filename: 'BAD.pdf',
      folderId: '6af9f28ef959aeeb3d00e1cb'
    },
    {
      code: 'PFE1',
      targetDocId: '6af9f5d9600e90616dc6ceb1',
      localPath: path.resolve('backend/uploads/1794766297570_PFE1_PFE1.pdf'),
      filename: 'PFE1.pdf',
      folderId: '6af9f323d6e0139164aa7de5'
    },
    {
      code: 'BTDI',
      targetDocId: '6af9f6ae600e90616dc6cff3',
      localPath: path.resolve('backend/uploads/1794766510372_BTDI_BTDI.pdf'),
      filename: 'BTDI.pdf',
      folderId: '6af9f323d6e0139164aa7de8'
    },
    {
      code: 'TUSM',
      targetDocId: '6af9f72e600e90616dc6d05b',
      localPath: path.resolve('backend/uploads/1794766638646_TUSM_TUSM.pdf'),
      filename: 'TUSM.pdf',
      folderId: '6af9f323d6e0139164aa7deb'
    }
  ];

  // Also PJTM target doc update (already uploaded as local_1795186279406_PJTM_PJTM.pdf)
  await Document.updateOne(
    { _id: new mongoose.Types.ObjectId('6afadd3c480f676f52aca39d') },
    {
      $set: {
        cloudinaryPublicId: 'local_1795186279406_PJTM_PJTM.pdf',
        secureUrl: 'http://localhost:5000/uploads/1795186279406_PJTM_PJTM.pdf',
        storageProvider: 'LOCAL_PERSISTED',
        availabilityStatus: 'AVAILABLE',
        fileSize: 10843829,
        originalFileName: 'PJTM.pdf'
      }
    }
  );
  // Remove temporary doc 6b005e67b85595de1fbe3f32
  await Document.deleteOne({ _id: new mongoose.Types.ObjectId('6b005e67b85595de1fbe3f32') });
  console.log('Updated official PJTM doc with persistent disk file and removed temp duplicate.');

  for (const item of filesToSync) {
    if (!fs.existsSync(item.localPath)) {
      console.warn(`File does not exist: ${item.localPath}`);
      continue;
    }

    const res = await uploadFileToRender(item.localPath, item.filename, item.folderId);
    if (res.status === 201 && res.data?.documents?.[0]) {
      const uploadedDoc = res.data.documents[0];
      const newPublicId = uploadedDoc.cloudinaryPublicId;
      const newSecureUrl = uploadedDoc.secureUrl;
      const newTempId = uploadedDoc._id;

      console.log(`Uploaded ${item.code} -> new publicId: ${newPublicId}`);

      // Update the target official document
      await Document.updateOne(
        { _id: new mongoose.Types.ObjectId(item.targetDocId) },
        {
          $set: {
            cloudinaryPublicId: newPublicId,
            secureUrl: newSecureUrl,
            storageProvider: 'LOCAL_PERSISTED',
            availabilityStatus: 'AVAILABLE',
            fileSize: uploadedDoc.fileSize,
            originalFileName: item.filename
          }
        }
      );

      // Delete the temporary document created by the upload endpoint
      await Document.deleteOne({ _id: new mongoose.Types.ObjectId(newTempId) });
      console.log(`Updated official doc ${item.targetDocId} and cleaned up temp doc ${newTempId}`);
    } else {
      console.error(`Failed to upload ${item.code}:`, res);
    }
  }

  console.log('All local files synced to Render persistent storage successfully!');
  await mongoose.disconnect();
}

syncAll().catch(console.error);
