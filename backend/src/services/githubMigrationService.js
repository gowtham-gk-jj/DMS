const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const yauzl = require('yauzl');
const GitHubSyncState = require('../models/GitHubSyncState');
const DetectedRepositoryFile = require('../models/DetectedRepositoryFile');
const MigrationJob = require('../models/MigrationJob');
const MigrationAsset = require('../models/MigrationAsset');
const Document = require('../models/Document');
const Folder = require('../models/Folder');
const { uploadToCloudinary } = require('./cloudinaryService');
const { CATEGORY_TO_FOLDER_NAME, IMPORT_ID } = require('./migrationService');

const DEFAULT_REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'gowtham-gk-jj';
const DEFAULT_REPO_NAME = process.env.GITHUB_REPO_NAME || 'fileforDMS';
const DEFAULT_BRANCH = process.env.GITHUB_REPO_BRANCH || 'main';

/**
 * Determine persistent working directory for downloads and extractions.
 * Prefers MIGRATION_TEMP_DIR or persistent volume mounted on Render at /var/data/uploads.
 */
const resolveTempBaseDir = () => {
  if (process.env.MIGRATION_TEMP_DIR && process.env.MIGRATION_TEMP_DIR.trim()) {
    return process.env.MIGRATION_TEMP_DIR.trim();
  }
  if (process.env.UPLOADS_DIR && process.env.UPLOADS_DIR.trim()) {
    return path.join(process.env.UPLOADS_DIR.trim(), 'temp_migration');
  }
  if (fs.existsSync('/var/data/uploads')) {
    return '/var/data/uploads/temp_migration';
  }
  return path.resolve(__dirname, '../../temp_migration/github_downloads');
};

const TEMP_BASE_DIR = resolveTempBaseDir();
if (!fs.existsSync(TEMP_BASE_DIR)) {
  try {
    fs.mkdirSync(TEMP_BASE_DIR, { recursive: true });
  } catch (err) {
    console.error(`[MIGRATION STORAGE ERROR] Unable to create TEMP_BASE_DIR at ${TEMP_BASE_DIR}:`, err.message);
  }
}

// Active jobs cancellation flags
const activeJobCancellations = new Set();

/**
 * Get GitHub request headers with optional token authentication
 */
const getGitHubHeaders = (extraHeaders = {}) => {
  const headers = {
    'User-Agent': 'Enterprise-DMS-Agent',
    Accept: 'application/vnd.github.v3+json',
    ...extraHeaders,
  };
  const token = process.env.GITHUB_TOKEN;
  if (token && token.trim()) {
    headers['Authorization'] = `token ${token.trim()}`;
  }
  return headers;
};

/**
 * Log an event to a MigrationJob document
 */
const logJobEvent = async (job, level, message) => {
  const timestamp = new Date();
  console.log(`[JOB ${job.jobId} ${level}] ${message}`);
  job.logs.push({ timestamp, level, message });
  if (job.logs.length > 500) {
    job.logs = job.logs.slice(-500);
  }
  try {
    await job.save();
  } catch {}
};

/**
 * Check persistent disk space before high-volume operations
 */
const checkDiskSpace = (targetDir, requiredBytes = 100 * 1024 * 1024) => {
  try {
    if (fs.existsSync(targetDir) && typeof fs.statfsSync === 'function') {
      const stats = fs.statfsSync(targetDir);
      const freeBytes = (stats.bavail || stats.bfree || 0) * (stats.bsize || 4096);
      if (freeBytes > 0 && freeBytes < requiredBytes) {
        const freeMb = Math.round(freeBytes / (1024 * 1024));
        const reqMb = Math.round(requiredBytes / (1024 * 1024));
        return {
          ok: false,
          freeBytes,
          requiredBytes,
          message: `Insufficient persistent disk space in ${targetDir}. Free: ${freeMb} MB, Required: ${reqMb} MB.`,
        };
      }
      return { ok: true, freeBytes, requiredBytes };
    }
  } catch (err) {
    console.warn('[Disk Space Check Warning]', err.message);
  }
  return { ok: true, freeBytes: -1, requiredBytes };
};

/**
 * Calculate SHA-256 hash of a file with streaming zero-memory overhead
 */
const calculateSha256 = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
};

/**
 * Verify ZIP archive integrity, file size, magic bytes, Git LFS text pointer rejection,
 * SHA-256 matching against Git LFS OID, and central directory readability.
 */
const verifyArchive = async (filePath, expectedSize = 0, expectedSha256 = '', isLfs = false) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archive file does not exist at ${filePath}`);
  }

  const stat = fs.statSync(filePath);
  const actualSize = stat.size;

  if (actualSize === 0) {
    throw new Error('Downloaded archive file is empty (0 bytes).');
  }

  // Inspect first 4 magic bytes
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(4);
  fs.readSync(fd, buffer, 0, 4, 0);
  fs.closeSync(fd);

  // Check if Git LFS pointer text file was mistakenly downloaded
  const firstFourStr = buffer.toString('utf8');
  if (firstFourStr === 'vers') {
    const textSnippet = fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' }).slice(0, 100);
    if (textSnippet.startsWith('version https://git-lfs')) {
      throw new Error(
        'Downloaded file is a Git LFS pointer text file, not a binary ZIP archive. Git LFS batch resolution required.'
      );
    }
  }

  if (expectedSize > 0 && actualSize !== expectedSize) {
    throw new Error(
      `Archive file size mismatch: Expected ${expectedSize} bytes, but file on disk is ${actualSize} bytes.`
    );
  }

  const magicHex = buffer.toString('hex').toLowerCase();
  // Valid ZIP starts with 504b0304 (PK\x03\x04), 504b0506 (empty ZIP), or 504b0708 (spanned ZIP)
  if (!['504b0304', '504b0506', '504b0708'].includes(magicHex)) {
    throw new Error(
      `Invalid ZIP header signature (magic bytes: 0x${magicHex}). File is not a valid ZIP archive.`
    );
  }

  // Streaming SHA-256 calculation
  const computedSha256 = await calculateSha256(filePath);

  if (isLfs && expectedSha256 && expectedSha256.trim()) {
    if (computedSha256.toLowerCase() !== expectedSha256.toLowerCase().trim()) {
      throw new Error(
        `SHA-256 checksum mismatch! Expected Git LFS OID: ${expectedSha256}, but computed hash is: ${computedSha256}. Archive is corrupted or truncated.`
      );
    }
  }

  // Validate ZIP Central Directory with yauzl
  await new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true, autoClose: true }, (err, zipfile) => {
      if (err) {
        return reject(new Error(`Corrupted ZIP central directory: ${err.message}`));
      }
      zipfile.close();
      resolve();
    });
  });

  return {
    valid: true,
    size: actualSize,
    sha256: computedSha256,
  };
};

/**
 * Check if a file is Git LFS pointer and extract OID and size
 */
const checkLfsPointer = async (owner, repo, branch, filePath) => {
  try {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
    const res = await axios.get(rawUrl, {
      headers: getGitHubHeaders(),
      timeout: 10000,
      transformResponse: [(data) => data],
    });

    if (typeof res.data === 'string' && res.data.startsWith('version https://git-lfs.github.com/spec/v1')) {
      const oidMatch = res.data.match(/oid sha256:([a-f0-9]{64})/i);
      const sizeMatch = res.data.match(/size (\d+)/i);
      if (oidMatch && sizeMatch) {
        return {
          isLfs: true,
          oid: oidMatch[1],
          size: parseInt(sizeMatch[1], 10),
        };
      }
    }
  } catch (err) {}
  return { isLfs: false, oid: '', size: 0 };
};

/**
 * Query GitHub repository API for newly added, modified, or existing files
 */
const checkGitHubRepository = async (options = {}) => {
  const owner = options.repoOwner || DEFAULT_REPO_OWNER;
  const repo = options.repoName || DEFAULT_REPO_NAME;
  const branch = options.branch || DEFAULT_BRANCH;

  let syncState = await GitHubSyncState.findOne({ repoOwner: owner, repoName: repo, branch });
  if (!syncState) {
    syncState = new GitHubSyncState({
      repoOwner: owner,
      repoName: repo,
      branch,
      syncStatus: 'SYNCING',
      lastCheckedAt: new Date(),
    });
  } else {
    syncState.syncStatus = 'SYNCING';
    syncState.lastCheckedAt = new Date();
  }
  await syncState.save();

  try {
    // 1. Fetch latest commit on branch
    const commitUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`;
    const commitRes = await axios.get(commitUrl, {
      headers: getGitHubHeaders(),
      timeout: 15000,
    });

    const latestCommit = commitRes.data;
    const latestCommitSha = latestCommit.sha;
    const latestCommitMessage = latestCommit.commit?.message || '';
    const latestCommitDate = latestCommit.commit?.author?.date
      ? new Date(latestCommit.commit.author.date)
      : new Date();
    const treeSha = latestCommit.commit?.tree?.sha;

    if (!treeSha) {
      throw new Error('Could not retrieve repository tree SHA from latest commit.');
    }

    // 2. Fetch recursive repository tree
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`;
    const treeRes = await axios.get(treeUrl, {
      headers: getGitHubHeaders(),
      timeout: 30000,
    });

    const tree = treeRes.data.tree || [];
    let newlyDetectedCount = 0;

    for (const item of tree) {
      if (item.type !== 'blob') continue;

      // Skip internal git metadata
      if (item.path.startsWith('.git') && !item.path.endsWith('.zip') && !item.path.endsWith('.pdf')) {
        continue;
      }

      const fileName = path.basename(item.path);
      const ext = path.extname(item.path).toLowerCase().replace('.', '');
      const category = DetectedRepositoryFile.classifyExtension(ext);

      let isLfs = false;
      let lfsOid = '';
      let lfsSize = 0;
      let actualSize = item.size || 0;

      if (['ZIP', 'PDF', 'CAD', 'DOCUMENT'].includes(category) && actualSize < 500) {
        const lfsInfo = await checkLfsPointer(owner, repo, branch, item.path);
        if (lfsInfo.isLfs) {
          isLfs = true;
          lfsOid = lfsInfo.oid;
          lfsSize = lfsInfo.size;
          actualSize = lfsInfo.size;
        }
      }

      const existingRecord = await DetectedRepositoryFile.findOne({ repoPath: item.path });

      if (!existingRecord) {
        await DetectedRepositoryFile.create({
          fileName,
          repoPath: item.path,
          fileExtension: ext,
          fileSize: actualSize,
          gitBlobSha: item.sha,
          commitSha: latestCommitSha,
          lastCommitDate: latestCommitDate,
          isLfs,
          lfsOid,
          lfsSize,
          fileTypeCategory: category,
          importStatus: 'NEW',
          detectedDate: new Date(),
        });
        newlyDetectedCount += 1;
      } else {
        let hasChanged = false;
        if (existingRecord.gitBlobSha !== item.sha) {
          existingRecord.gitBlobSha = item.sha;
          existingRecord.commitSha = latestCommitSha;
          existingRecord.lastCommitDate = latestCommitDate;
          existingRecord.fileSize = actualSize;
          existingRecord.isLfs = isLfs;
          existingRecord.lfsOid = lfsOid;
          existingRecord.lfsSize = lfsSize;
          hasChanged = true;
        }
        if (hasChanged) {
          await existingRecord.save();
        }
      }
    }

    // 3. Compute aggregate statistics
    const totalFiles = await DetectedRepositoryFile.countDocuments();
    const pendingZips = await DetectedRepositoryFile.countDocuments({
      fileTypeCategory: 'ZIP',
      importStatus: { $in: ['NEW', 'PENDING'] },
    });
    const pendingDocs = await DetectedRepositoryFile.countDocuments({
      fileTypeCategory: { $in: ['PDF', 'DOCUMENT', 'SPREADSHEET', 'IMAGE', 'CAD'] },
      importStatus: { $in: ['NEW', 'PENDING'] },
    });
    const importedCount = await DetectedRepositoryFile.countDocuments({ importStatus: 'COMPLETED' });
    const failedCount = await DetectedRepositoryFile.countDocuments({ importStatus: 'FAILED' });

    syncState.lastCommitSha = latestCommitSha;
    syncState.lastCommitMessage = latestCommitMessage;
    syncState.lastCommitDate = latestCommitDate;
    syncState.syncStatus = 'SUCCESS';
    syncState.syncError = '';
    syncState.totalDetectedFiles = totalFiles;
    syncState.pendingZipCount = pendingZips;
    syncState.pendingDocCount = pendingDocs;
    syncState.importedCount = importedCount;
    syncState.failedCount = failedCount;
    await syncState.save();

    return {
      success: true,
      message: `GitHub repository checked successfully. Found ${tree.length} files in tree (${newlyDetectedCount} new).`,
      newlyDetectedCount,
      syncState,
    };
  } catch (err) {
    console.error('[GitHub Sync Error]', err.message);
    syncState.syncStatus = 'ERROR';
    syncState.syncError = err.response?.data?.message || err.message;
    await syncState.save();
    return {
      success: false,
      message: `Failed to check GitHub repository: ${syncState.syncError}`,
      syncState,
    };
  }
};

/**
 * Get current synchronization status and statistics
 */
const getGitHubSyncStatus = async () => {
  let syncState = await GitHubSyncState.findOne({
    repoOwner: DEFAULT_REPO_OWNER,
    repoName: DEFAULT_REPO_NAME,
    branch: DEFAULT_BRANCH,
  });

  if (!syncState) {
    return await checkGitHubRepository();
  }

  const totalFiles = await DetectedRepositoryFile.countDocuments();
  const pendingZips = await DetectedRepositoryFile.countDocuments({
    fileTypeCategory: 'ZIP',
    importStatus: { $in: ['NEW', 'PENDING'] },
  });
  const pendingDocs = await DetectedRepositoryFile.countDocuments({
    fileTypeCategory: { $in: ['PDF', 'DOCUMENT', 'SPREADSHEET', 'IMAGE', 'CAD'] },
    importStatus: { $in: ['NEW', 'PENDING'] },
  });
  const importedCount = await DetectedRepositoryFile.countDocuments({ importStatus: 'COMPLETED' });
  const failedCount = await DetectedRepositoryFile.countDocuments({ importStatus: 'FAILED' });

  syncState.totalDetectedFiles = totalFiles;
  syncState.pendingZipCount = pendingZips;
  syncState.pendingDocCount = pendingDocs;
  syncState.importedCount = importedCount;
  syncState.failedCount = failedCount;
  await syncState.save();

  return {
    success: true,
    syncState,
  };
};

/**
 * List detected repository files with filtering, search, and pagination
 */
const getDetectedFiles = async (query = {}) => {
  const {
    type = 'ALL',
    status = 'ALL',
    search = '',
    page = 1,
    limit = 20,
    sortBy = 'detectedDate',
    sortOrder = -1,
  } = query;

  const filter = {};

  if (type && type !== 'ALL') {
    if (type === 'OTHER') {
      filter.fileTypeCategory = { $nin: ['ZIP', 'PDF'] };
    } else {
      filter.fileTypeCategory = type;
    }
  }

  if (status && status !== 'ALL') {
    filter.importStatus = status;
  }

  if (search && search.trim()) {
    const term = search.trim();
    filter.$or = [
      { fileName: { $regex: term, $options: 'i' } },
      { repoPath: { $regex: term, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;
  const sort = { [sortBy]: parseInt(sortOrder, 10) || -1 };

  const [files, total] = await Promise.all([
    DetectedRepositoryFile.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate('associatedJobId', 'jobId status progressPercent currentStage errorMessage isResumable'),
    DetectedRepositoryFile.countDocuments(filter),
  ]);

  return {
    success: true,
    files,
    pagination: {
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      limit: limitNum,
    },
  };
};

/**
 * Download a file from GitHub with byte Range resumption, LFS batch resolution,
 * streaming disk write, and active cancellation check.
 */
const downloadFileFromGitHub = async (detectedFile, destPath, job, onProgress = null) => {
  const owner = DEFAULT_REPO_OWNER;
  const repo = DEFAULT_REPO_NAME;
  const branch = DEFAULT_BRANCH;

  const expectedSize = detectedFile.lfsSize || detectedFile.fileSize || 0;

  // Pre-flight disk space verification: ensure at least 2.5x archive size free on disk
  const diskCheck = checkDiskSpace(path.dirname(destPath), expectedSize > 0 ? expectedSize * 2.5 : 100 * 1024 * 1024);
  if (!diskCheck.ok) {
    throw new Error(diskCheck.message);
  }

  // Check if file already exists on persistent disk
  let existingBytes = 0;
  if (fs.existsSync(destPath)) {
    const stat = fs.statSync(destPath);
    existingBytes = stat.size;

    if (expectedSize > 0 && existingBytes === expectedSize) {
      try {
        await logJobEvent(job, 'INFO', `Found complete file on persistent disk (${(existingBytes / (1024 * 1024)).toFixed(1)} MB). Verifying integrity...`);
        const ver = await verifyArchive(destPath, expectedSize, detectedFile.lfsOid, detectedFile.isLfs);
        await logJobEvent(job, 'SUCCESS', `File integrity verified (SHA-256: ${ver.sha256.slice(0, 16)}...). Skipping network download.`);
        if (onProgress) onProgress(existingBytes, expectedSize);
        return { reused: true, size: existingBytes, sha256: ver.sha256 };
      } catch (verErr) {
        await logJobEvent(job, 'WARN', `Existing file failed integrity check (${verErr.message}). Overwriting from source...`);
        try { fs.unlinkSync(destPath); } catch {}
        existingBytes = 0;
      }
    } else if (expectedSize > 0 && existingBytes > expectedSize) {
      await logJobEvent(job, 'WARN', `Existing file on disk (${existingBytes} bytes) exceeds expected size. Re-downloading.`);
      try { fs.unlinkSync(destPath); } catch {}
      existingBytes = 0;
    } else if (existingBytes > 0) {
      await logJobEvent(job, 'INFO', `Found partially downloaded file (${(existingBytes / (1024 * 1024)).toFixed(1)} MB / ${(expectedSize / (1024 * 1024)).toFixed(1)} MB). Resuming download via HTTP Range...`);
    }
  }

  let downloadUrl = '';
  let requestHeaders = {};

  if (detectedFile.isLfs && detectedFile.lfsOid) {
    // Git LFS batch API resolution
    const batchUrl = `https://github.com/${owner}/${repo}.git/info/lfs/objects/batch`;
    const batchRes = await axios.post(
      batchUrl,
      {
        operation: 'download',
        transfers: ['basic'],
        objects: [{ oid: detectedFile.lfsOid, size: detectedFile.lfsSize }],
      },
      {
        headers: getGitHubHeaders({
          Accept: 'application/vnd.git-lfs+json',
          'Content-Type': 'application/vnd.git-lfs+json',
        }),
        timeout: 30000,
      }
    );

    downloadUrl = batchRes.data?.objects?.[0]?.actions?.download?.href;
    if (!downloadUrl) {
      throw new Error(`Git LFS download link could not be resolved for ${detectedFile.fileName}`);
    }
    const lfsHeaders = batchRes.data?.objects?.[0]?.actions?.download?.header || {};
    requestHeaders = { ...lfsHeaders };
  } else {
    downloadUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${detectedFile.repoPath}`;
    requestHeaders = getGitHubHeaders();
  }

  if (existingBytes > 0) {
    requestHeaders['Range'] = `bytes=${existingBytes}-`;
  }

  const response = await axios({
    method: 'GET',
    url: downloadUrl,
    headers: requestHeaders,
    responseType: 'stream',
    timeout: 600000, // 10 minute timeout for large multi-hundred-MB archives
    validateStatus: (status) => status === 200 || status === 206,
  });

  const isPartial = response.status === 206;
  const writer = fs.createWriteStream(destPath, { flags: isPartial ? 'a' : 'w' });
  let downloadedBytes = isPartial ? existingBytes : 0;
  const totalBytes = expectedSize || parseInt(response.headers['content-length'] || 0, 10);

  let lastProgressUpdate = Date.now();

  return new Promise((resolve, reject) => {
    let streamClosed = false;

    response.data.on('data', (chunk) => {
      downloadedBytes += chunk.length;

      const now = Date.now();
      if (now - lastProgressUpdate > 2000) {
        lastProgressUpdate = now;
        if (onProgress && totalBytes > 0) {
          onProgress(downloadedBytes, totalBytes);
        }
      }

      if (activeJobCancellations.has(job.jobId)) {
        if (!streamClosed) {
          streamClosed = true;
          response.data.destroy();
          writer.end();
          reject(new Error('MIGRATION_CANCELLED'));
        }
      }
    });

    response.data.pipe(writer);

    writer.on('finish', () => {
      if (onProgress && totalBytes > 0) {
        onProgress(downloadedBytes, totalBytes);
      }
      resolve({ reused: false, size: downloadedBytes });
    });

    writer.on('error', (err) => {
      if (!streamClosed) {
        streamClosed = true;
        reject(err);
      }
    });

    response.data.on('error', (err) => {
      if (!streamClosed) {
        streamClosed = true;
        writer.end();
        reject(err);
      }
    });
  });
};

/**
 * Extract a single ZIP file using yauzl streaming (zero contiguous RAM buffer).
 * Includes Zip Slip protection, Zip Bomb protection, dangerous file filtering,
 * and periodic event loop yielding.
 */
const extractSingleZipStreaming = (zipFilePath, targetDir, job, onEntryExtracted = null) => {
  return new Promise((resolve, reject) => {
    yauzl.open(zipFilePath, { lazyEntries: true, autoClose: true }, (err, zipfile) => {
      if (err) return reject(new Error(`Failed to open ZIP archive (${path.basename(zipFilePath)}): ${err.message}`));

      let totalUncompressed = 0;
      let fileCount = 0;
      const MAX_UNCOMPRESSED_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB safety limit
      const MAX_FILES = 25000;
      const nestedZips = [];

      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        // Zip Slip path traversal check
        if (entry.fileName.includes('..') || path.isAbsolute(entry.fileName)) {
          console.warn(`[Security Alert] Rejected insecure ZIP entry: ${entry.fileName}`);
          zipfile.readEntry();
          return;
        }

        const fullDestPath = path.resolve(targetDir, entry.fileName);
        if (!fullDestPath.startsWith(path.resolve(targetDir))) {
          console.warn(`[Security Alert] Traversal attempt outside target dir: ${entry.fileName}`);
          zipfile.readEntry();
          return;
        }

        // Dangerous executable file extension check
        const ext = path.extname(entry.fileName).toLowerCase();
        if (['.exe', '.bat', '.cmd', '.sh', '.vbs', '.ps1', '.msi', '.com'].includes(ext)) {
          console.warn(`[Security Alert] Skipped dangerous executable file: ${entry.fileName}`);
          zipfile.readEntry();
          return;
        }

        totalUncompressed += entry.uncompressedSize || 0;
        fileCount++;

        if (totalUncompressed > MAX_UNCOMPRESSED_SIZE) {
          zipfile.close();
          return reject(new Error('Archive exceeds maximum safe uncompressed size limit (5 GB).'));
        }
        if (fileCount > MAX_FILES) {
          zipfile.close();
          return reject(new Error('Archive exceeds maximum safe file count limit (25,000 files).'));
        }

        if (/\/$/.test(entry.fileName)) {
          // Directory
          fs.mkdirSync(fullDestPath, { recursive: true });
          zipfile.readEntry();
        } else {
          // File
          const parentDir = path.dirname(fullDestPath);
          fs.mkdirSync(parentDir, { recursive: true });

          zipfile.openReadStream(entry, (streamErr, readStream) => {
            if (streamErr) {
              zipfile.close();
              return reject(streamErr);
            }

            const writeStream = fs.createWriteStream(fullDestPath);
            readStream.pipe(writeStream);

            writeStream.on('finish', async () => {
              if (ext === '.zip') {
                nestedZips.push(fullDestPath);
              }

              if (onEntryExtracted) {
                onEntryExtracted(fileCount, totalUncompressed, entry.fileName);
              }

              // Yield to event loop every 20 entries to allow HTTP server health checks to respond
              if (fileCount % 20 === 0) {
                await new Promise((r) => setImmediate(r));
              }

              if (activeJobCancellations.has(job.jobId)) {
                zipfile.close();
                return reject(new Error('MIGRATION_CANCELLED'));
              }

              zipfile.readEntry();
            });

            writeStream.on('error', (wErr) => {
              zipfile.close();
              reject(wErr);
            });

            readStream.on('error', (rErr) => {
              zipfile.close();
              reject(rErr);
            });
          });
        }
      });

      zipfile.on('end', () => {
        resolve({ fileCount, totalUncompressed, nestedZips });
      });

      zipfile.on('error', (zErr) => {
        reject(zErr);
      });
    });
  });
};

/**
 * Iterative streaming extraction for outer and nested archives.
 * Uses a work queue instead of call-stack recursion to guarantee low memory usage.
 */
const extractZipRecursivelyStreaming = async (outerZipPath, targetDir, job) => {
  const queue = [{ zipPath: outerZipPath, outDir: targetDir, depth: 0 }];
  let totalFilesExtracted = 0;
  let totalBytesExtracted = 0;
  let nestedArchivesProcessed = 0;

  let lastSaveTime = Date.now();

  while (queue.length > 0) {
    if (activeJobCancellations.has(job.jobId)) {
      throw new Error('MIGRATION_CANCELLED');
    }

    const current = queue.shift();

    const { fileCount, totalUncompressed, nestedZips } = await extractSingleZipStreaming(
      current.zipPath,
      current.outDir,
      job,
      (count, bytes, fileName) => {
        const now = Date.now();
        if (now - lastSaveTime > 3000) {
          lastSaveTime = now;
          const currentTotal = totalFilesExtracted + count;
          job.extractionProgress = currentTotal;
          job.stats.extractedCount = currentTotal;
          job.lastProcessedFile = path.basename(fileName);
          job.currentStage = `Extracting archives (${currentTotal} files extracted)...`;
          job.save().catch(() => {});
        }
      }
    );

    totalFilesExtracted += fileCount;
    totalBytesExtracted += totalUncompressed;

    if (current.depth > 0) {
      nestedArchivesProcessed++;
      // Delete extracted nested .zip to reclaim persistent disk space
      try {
        fs.unlinkSync(current.zipPath);
      } catch {}
    }

    // Queue nested archives if under max nesting depth (5)
    if (current.depth < 5) {
      for (const nestedZipPath of nestedZips) {
        if (fs.existsSync(nestedZipPath)) {
          const nestedBase = path.basename(nestedZipPath, '.zip');
          const nestedOutDir = path.join(path.dirname(nestedZipPath), nestedBase);
          fs.mkdirSync(nestedOutDir, { recursive: true });
          queue.push({
            zipPath: nestedZipPath,
            outDir: nestedOutDir,
            depth: current.depth + 1,
          });
        }
      }
    }

    await new Promise((r) => setImmediate(r));
  }

  job.stats.extractedCount = totalFilesExtracted;
  job.extractionProgress = totalFilesExtracted;
  await job.save();

  return { totalFilesExtracted, totalBytesExtracted, nestedArchivesProcessed };
};

/**
 * Recursively walk directory and collect all files
 */
const walkDir = (dir, fileList = []) => {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath, fileList);
      } else {
        fileList.push({
          fullPath,
          fileName: file,
          size: stat.size,
          ext: path.extname(file).toLowerCase().replace('.', ''),
        });
      }
    } catch {}
  }
  return fileList;
};

/**
 * Background migration job execution pipeline with checkpointing and auto-resume
 */
const runJobProcess = async (jobId) => {
  const job = await MigrationJob.findOne({ jobId });
  if (!job) return;

  const detectedFile = await DetectedRepositoryFile.findById(job.detectedFileId);
  if (!detectedFile) {
    job.status = 'FAILED';
    job.errorMessage = 'Associated DetectedRepositoryFile was not found in database.';
    await logJobEvent(job, 'ERROR', job.errorMessage);
    return;
  }

  const jobWorkDir = path.join(TEMP_BASE_DIR, jobId);
  if (!fs.existsSync(jobWorkDir)) {
    fs.mkdirSync(jobWorkDir, { recursive: true });
  }

  try {
    if (!job.startedAt) {
      job.startedAt = new Date();
    }
    job.status = 'DOWNLOADING';
    job.errorMessage = '';
    job.isResumable = true;
    job.currentStage = 'Validating archive and preparing streaming download...';
    if (job.progressPercent < 5) job.progressPercent = 5;
    detectedFile.importStatus = 'PROCESSING';
    detectedFile.lastImportAttempt = new Date();
    detectedFile.lastError = '';
    await detectedFile.save();
    await logJobEvent(job, 'INFO', `Starting migration for ${detectedFile.repoPath} (${detectedFile.fileName})`);

    if (activeJobCancellations.has(jobId)) throw new Error('MIGRATION_CANCELLED');

    // 1. Download file from GitHub or resume existing download
    const downloadedFilePath = path.join(jobWorkDir, detectedFile.fileName);
    job.currentStage = `Downloading from GitHub (${(detectedFile.fileSize / (1024 * 1024)).toFixed(1)} MB)...`;
    await job.save();

    await downloadFileFromGitHub(detectedFile, downloadedFilePath, job, (downloaded, total) => {
      const pct = Math.min(30, 10 + Math.round((downloaded / total) * 20));
      job.downloadedBytes = downloaded;
      job.totalBytes = total;
      if (pct !== job.progressPercent) {
        job.progressPercent = pct;
        job.save().catch(() => {});
      }
    });

    if (activeJobCancellations.has(jobId)) throw new Error('MIGRATION_CANCELLED');

    // 2. Verification Stage
    job.status = 'VERIFYING';
    job.currentStage = 'Verifying archive integrity, magic bytes, and SHA-256 checksum...';
    job.progressPercent = 32;
    await job.save();
    await logJobEvent(job, 'INFO', 'Verifying downloaded archive integrity...');

    const isZip = detectedFile.fileTypeCategory === 'ZIP';
    if (isZip) {
      const verResult = await verifyArchive(
        downloadedFilePath,
        detectedFile.lfsSize || detectedFile.fileSize,
        detectedFile.lfsOid,
        detectedFile.isLfs
      );
      job.archiveSha256 = verResult.sha256;
      await logJobEvent(
        job,
        'SUCCESS',
        `Archive verified successfully. SHA-256: ${verResult.sha256}, Size: ${(verResult.size / (1024 * 1024)).toFixed(1)} MB`
      );
    } else {
      const docSha = await calculateSha256(downloadedFilePath);
      job.archiveSha256 = docSha;
    }

    job.progressPercent = 35;
    await job.save();

    const extractedDir = path.join(jobWorkDir, 'extracted');
    if (!fs.existsSync(extractedDir)) {
      fs.mkdirSync(extractedDir, { recursive: true });
    }

    // 3. Extraction Stage (if ZIP)
    if (isZip) {
      // Check if files were already extracted in a previous interrupted run
      const existingExtractedFiles = walkDir(extractedDir);
      if (
        existingExtractedFiles.length > 50 &&
        (job.checkpoint?.processedCount > 0 || job.stats.extractedCount > 0)
      ) {
        await logJobEvent(
          job,
          'INFO',
          `Found ${existingExtractedFiles.length} already extracted files on persistent storage. Reusing extracted archive.`
        );
      } else {
        job.status = 'EXTRACTING';
        job.currentStage = 'Extracting archive and inspecting internal nested archives...';
        job.progressPercent = 40;
        await job.save();
        await logJobEvent(job, 'INFO', 'Unpacking archive with streaming yauzl (zero-buffer)...');

        const { totalFilesExtracted, nestedArchivesProcessed } = await extractZipRecursivelyStreaming(
          downloadedFilePath,
          extractedDir,
          job
        );

        if (activeJobCancellations.has(jobId)) throw new Error('MIGRATION_CANCELLED');

        await logJobEvent(
          job,
          'SUCCESS',
          `Archive unpacked successfully: ${totalFilesExtracted} total files extracted (${nestedArchivesProcessed} nested archives processed).`
        );
      }
    } else {
      const singleDest = path.join(extractedDir, detectedFile.fileName);
      fs.copyFileSync(downloadedFilePath, singleDest);
    }

    // 4. Scanning Stage
    job.status = 'SCANNING';
    job.currentStage = 'Scanning extracted files and inventorying supported formats...';
    job.progressPercent = 50;
    await job.save();

    const allDiscoveredFiles = walkDir(extractedDir);
    job.stats.discoveredCount = allDiscoveredFiles.length;
    job.stats.extractedCount = allDiscoveredFiles.length;

    await logJobEvent(
      job,
      'INFO',
      `Found ${allDiscoveredFiles.length} extracted files. Classifying documents and CAD files...`
    );

    const supportedFiles = [];
    let unsupportedCount = 0;

    for (const fileInfo of allDiscoveredFiles) {
      const ext = fileInfo.ext;
      if (ext === 'zip') continue;

      if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        supportedFiles.push(fileInfo);
      } else {
        unsupportedCount++;
      }
    }

    job.stats.unsupportedCount = unsupportedCount;
    job.progressPercent = 60;
    await job.save();

    // 5. Matching Stage
    job.status = 'MATCHING';
    job.currentStage = 'Matching documents with DOConCD catalogue & folder hierarchy...';
    await logJobEvent(job, 'INFO', `Processing ${supportedFiles.length} supported documents (${unsupportedCount} other files).`);

    const matchedCataloguePath = path.join(__dirname, '../../data/catalogue_matched.json');
    const folderLookupPath = path.join(__dirname, '../../data/folder_lookup.json');

    const catalogueList = fs.existsSync(matchedCataloguePath)
      ? JSON.parse(fs.readFileSync(matchedCataloguePath, 'utf8'))
      : [];
    const folderLookup = fs.existsSync(folderLookupPath)
      ? JSON.parse(fs.readFileSync(folderLookupPath, 'utf8'))
      : {};

    let rootFolder = await Folder.findOne({ parentFolderId: null });
    if (!rootFolder) {
      rootFolder = await Folder.findOne();
    }

    // 6. Ingestion & Upload Loop with Checkpointing
    job.status = 'UPLOADING';
    job.currentStage = 'Uploading documents to storage and updating library...';
    job.progressPercent = 70;
    await job.save();

    const importedDocIds = [];
    const processedHashSet = new Set(job.processedFileHashes || []);
    let matchedCount = job.stats.matchedCount || 0;
    let uploadedCount = job.stats.uploadedCount || 0;
    let duplicateCount = job.stats.duplicateCount || 0;
    let failedCount = job.stats.failedCount || 0;

    for (let idx = 0; idx < supportedFiles.length; idx++) {
      if (activeJobCancellations.has(jobId)) throw new Error('MIGRATION_CANCELLED');

      // Yield to event loop on every file so background tasks and health checks remain smooth
      await new Promise((r) => setImmediate(r));

      const fileInfo = supportedFiles[idx];
      const baseNameWithoutExt = path.basename(fileInfo.fileName, path.extname(fileInfo.fileName));

      try {
        const fileHash = await calculateSha256(fileInfo.fullPath);

        // Check if hash already completed in this job checkpoint
        if (processedHashSet.has(fileHash)) {
          duplicateCount++;
          continue;
        }

        // Deduplication against existing MigrationAsset or Document
        let existingAsset = await MigrationAsset.findOne({ sha256: fileHash });
        let existingDoc = await Document.findOne({
          $or: [
            { originalFileName: fileInfo.fileName },
            { fileName: baseNameWithoutExt },
          ],
        });

        // Match against DOConCD catalogue
        const catalogueItem = catalogueList.find(
          (c) =>
            c.fileName?.toLowerCase() === baseNameWithoutExt.toLowerCase() ||
            c.originalFileName?.toLowerCase() === fileInfo.fileName.toLowerCase() ||
            c.title?.toLowerCase() === baseNameWithoutExt.toLowerCase()
        );

        if (catalogueItem) {
          matchedCount++;
        }

        // Determine target folder
        let targetFolderId = null;
        if (catalogueItem && catalogueItem.categoryPath) {
          const folderName = CATEGORY_TO_FOLDER_NAME[catalogueItem.categoryPath] || catalogueItem.category;
          targetFolderId = folderLookup[folderName] || folderLookup[catalogueItem.categoryPath];
        }

        if (!targetFolderId) {
          const archiveSubfolderName = detectedFile.fileName.replace(/\.zip$/i, '');
          let subFolder = await Folder.findOne({ name: archiveSubfolderName });
          if (!subFolder && rootFolder) {
            subFolder = await Folder.create({
              name: archiveSubfolderName,
              parentFolderId: rootFolder._id,
              path: `/${archiveSubfolderName}`,
              level: 1,
            });
          }
          targetFolderId = subFolder?._id || rootFolder?._id;
        }

        let uploadResult = null;

        if (existingAsset && existingAsset.secureUrl) {
          // Instant Deduplication: reuse stored asset without uploading
          duplicateCount++;
          uploadResult = {
            asset_id: existingAsset.cloudinaryPublicId,
            public_id: existingAsset.cloudinaryPublicId,
            secure_url: existingAsset.secureUrl,
            storage: existingAsset.storageProvider,
            format: fileInfo.ext,
            bytes: fileInfo.size,
          };
        } else if (existingDoc && existingDoc.secureUrl) {
          duplicateCount++;
          uploadResult = {
            asset_id: existingDoc.cloudinaryAssetId,
            public_id: existingDoc.cloudinaryPublicId,
            secure_url: existingDoc.secureUrl,
            storage: existingDoc.storageProvider,
            format: existingDoc.fileExtension,
            bytes: existingDoc.fileSize,
          };
          await MigrationAsset.findOneAndUpdate(
            { sha256: fileHash },
            {
              sha256: fileHash,
              fileName: fileInfo.fileName,
              documentId: existingDoc._id,
              fileSize: fileInfo.size,
              mimeType: existingDoc.mimeType,
              storageProvider: existingDoc.storageProvider,
              secureUrl: existingDoc.secureUrl,
              cloudinaryPublicId: existingDoc.cloudinaryPublicId,
            },
            { upsert: true }
          );
        } else {
          // Stream upload to Cloudinary directly from file path (zero RAM buffer)
          uploadResult = await uploadToCloudinary(
            fileInfo.fullPath,
            fileInfo.fileName,
            `dms/${detectedFile.fileName.replace(/\.zip$/i, '')}`
          );
          uploadedCount++;

          await MigrationAsset.create({
            sha256: fileHash,
            fileName: fileInfo.fileName,
            fileSize: fileInfo.size,
            storageProvider: uploadResult.storage || 'CLOUDINARY',
            secureUrl: uploadResult.secure_url || '',
            cloudinaryPublicId: uploadResult.public_id || '',
          });
        }

        let mimeType = 'application/octet-stream';
        if (fileInfo.ext === 'pdf') mimeType = 'application/pdf';
        else if (fileInfo.ext === 'doc') mimeType = 'application/msword';
        else if (fileInfo.ext === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        else if (fileInfo.ext === 'xls') mimeType = 'application/vnd.ms-excel';
        else if (fileInfo.ext === 'xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        else if (['jpg', 'jpeg'].includes(fileInfo.ext)) mimeType = 'image/jpeg';
        else if (fileInfo.ext === 'png') mimeType = 'image/png';
        else if (fileInfo.ext === 'webp') mimeType = 'image/webp';
        else if (fileInfo.ext === 'gif') mimeType = 'image/gif';

        const docPayload = {
          displayName: catalogueItem?.title || baseNameWithoutExt,
          title: catalogueItem?.title || baseNameWithoutExt,
          originalFileName: fileInfo.fileName,
          fileName: baseNameWithoutExt,
          system: catalogueItem?.system || 'DOConCD',
          softwareVersion: catalogueItem?.softwareVersion || '',
          edition: catalogueItem?.edition || '',
          orderNumber: catalogueItem?.orderNumber || '',
          documentCode: catalogueItem?.orderNumber || baseNameWithoutExt,
          category: catalogueItem?.category || detectedFile.fileName.replace(/\.zip$/i, ''),
          subcategory: catalogueItem?.subcategory || '',
          cataloguePage: catalogueItem?.cataloguePage || 1,
          folderId: targetFolderId,
          storageProvider: uploadResult.storage || 'CLOUDINARY',
          cloudinaryAssetId: uploadResult.asset_id || '',
          cloudinaryPublicId: uploadResult.public_id || '',
          secureUrl: uploadResult.secure_url || '',
          fileExtension: fileInfo.ext,
          fileSize: fileInfo.size,
          mimeType,
          availabilityStatus: 'AVAILABLE',
          displayOrder: catalogueItem?.displayOrder || idx + 1,
          importId: IMPORT_ID,
          uploadedBy: job.createdBy || null,
          isArchived: false,
        };

        let savedDoc;
        if (existingDoc) {
          Object.assign(existingDoc, docPayload);
          savedDoc = await existingDoc.save();
        } else {
          savedDoc = await Document.create(docPayload);
        }

        importedDocIds.push(savedDoc._id);
        processedHashSet.add(fileHash);
        if (!job.processedFileHashes.includes(fileHash)) {
          job.processedFileHashes.push(fileHash);
        }

        // Save persistent checkpoint every 5 files or on final file
        if ((idx + 1) % 5 === 0 || idx === supportedFiles.length - 1) {
          const currentProgress = 70 + Math.round(((idx + 1) / supportedFiles.length) * 25);
          job.progressPercent = currentProgress;
          job.currentStage = `Ingesting documents (${idx + 1}/${supportedFiles.length}) - [Uploaded: ${uploadedCount}, Duplicates: ${duplicateCount}]`;
          job.stats.uploadedCount = uploadedCount;
          job.stats.duplicateCount = duplicateCount;
          job.stats.matchedCount = matchedCount;
          job.stats.failedCount = failedCount;
          job.lastProcessedFile = fileInfo.fileName;
          job.checkpoint = {
            lastProcessedIndex: idx,
            totalFilesCount: supportedFiles.length,
            processedCount: idx + 1,
            lastProcessedFile: fileInfo.fileName,
            updatedAt: new Date(),
          };
          await job.save();
        }
      } catch (docErr) {
        failedCount++;
        job.errorLog.push({
          timestamp: new Date(),
          message: docErr.message,
          filePath: fileInfo.fileName,
        });
        await logJobEvent(job, 'WARN', `Failed importing ${fileInfo.fileName}: ${docErr.message}`);
      }
    }

    // 7. Completion & Report
    job.stats.matchedCount = matchedCount;
    job.stats.uploadedCount = uploadedCount;
    job.stats.duplicateCount = duplicateCount;
    job.stats.failedCount = failedCount;
    job.stats.unsupportedCount = unsupportedCount;
    job.progressPercent = 100;
    job.currentStage = 'Migration completed successfully.';
    job.completedAt = new Date();
    job.status = failedCount > 0 ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED';

    const finalReport = {
      jobId,
      sourceFile: detectedFile.fileName,
      repoPath: detectedFile.repoPath,
      commitSha: detectedFile.commitSha,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      durationMs: job.completedAt - job.startedAt,
      stats: { ...job.stats },
      importedDocumentsCount: importedDocIds.length,
      errorsCount: job.errorLog.length,
      errors: job.errorLog,
    };
    job.report = finalReport;
    await job.save();

    detectedFile.importStatus = failedCount > 0 && uploadedCount === 0 ? 'FAILED' : 'COMPLETED';
    detectedFile.associatedJobId = job._id;
    detectedFile.importedDocumentIds = importedDocIds;
    detectedFile.lastError = job.errorLog.length > 0 ? job.errorLog[0].message : '';
    await detectedFile.save();

    await logJobEvent(
      job,
      'SUCCESS',
      `Migration completed. Imported: ${importedDocIds.length}, Uploaded: ${uploadedCount}, Duplicates: ${duplicateCount}, Failed: ${failedCount}`
    );

    await getGitHubSyncStatus();

    // Clean up temporary extracted directory upon successful completion
    try {
      if (fs.existsSync(jobWorkDir)) {
        fs.rmSync(jobWorkDir, { recursive: true, force: true });
      }
    } catch {}
  } catch (err) {
    if (err.message === 'MIGRATION_CANCELLED') {
      job.status = 'CANCELLED';
      job.currentStage = 'Migration cancelled by administrator.';
      await logJobEvent(job, 'WARN', 'Migration process cancelled by administrator.');
      detectedFile.importStatus = 'PENDING';
      await detectedFile.save();
    } else {
      job.status = 'FAILED';
      job.errorMessage = err.message;
      job.currentStage = `Migration failed: ${err.message}`;
      job.errorLog.push({
        timestamp: new Date(),
        message: err.message,
        filePath: detectedFile.fileName,
      });
      await logJobEvent(job, 'ERROR', `Fatal migration error: ${err.message}`);
      detectedFile.importStatus = 'FAILED';
      detectedFile.lastError = err.message;
      await detectedFile.save();
    }
    job.completedAt = new Date();
    await job.save();

    await getGitHubSyncStatus();

    // Do NOT immediately delete jobWorkDir on failure if it contains valid files for resumption!
  } finally {
    activeJobCancellations.delete(jobId);
  }
};

/**
 * Queue a migration job for a detected file
 */
const createMigrationJob = async (fileId, adminUserId) => {
  const file = await DetectedRepositoryFile.findById(fileId);
  if (!file) {
    throw new Error('Detected repository file not found.');
  }

  const jobId = `MIG-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const job = await MigrationJob.create({
    jobId,
    jobType: file.fileTypeCategory === 'ZIP' ? 'SINGLE_ZIP' : 'MANUAL_IMPORT',
    sourceFile: file.fileName,
    repoPath: file.repoPath,
    detectedFileId: file._id,
    commitSha: file.commitSha,
    status: 'QUEUED',
    currentStage: 'Job queued in background pipeline',
    progressPercent: 0,
    createdBy: adminUserId,
  });

  file.importStatus = 'PENDING';
  file.associatedJobId = job._id;
  await file.save();

  setImmediate(() => {
    runJobProcess(jobId).catch((err) => {
      console.error(`[Background Job Error ${jobId}]`, err);
    });
  });

  return {
    success: true,
    jobId: job.jobId,
    message: `Migration job ${job.jobId} created and queued successfully.`,
    job,
  };
};

/**
 * Queue multiple detected files for import
 */
const createBulkMigrationJob = async (fileIds, adminUserId) => {
  if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
    throw new Error('Please select at least one file to import.');
  }

  const files = await DetectedRepositoryFile.find({ _id: { $in: fileIds } });
  if (files.length === 0) {
    throw new Error('No valid repository files found for selected IDs.');
  }

  const queuedJobs = [];

  for (const file of files) {
    const jobId = `MIG-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const job = await MigrationJob.create({
      jobId,
      jobType: file.fileTypeCategory === 'ZIP' ? 'SINGLE_ZIP' : 'MANUAL_IMPORT',
      sourceFile: file.fileName,
      repoPath: file.repoPath,
      detectedFileId: file._id,
      commitSha: file.commitSha,
      status: 'QUEUED',
      currentStage: 'Queued in bulk batch import',
      progressPercent: 0,
      createdBy: adminUserId,
    });

    file.importStatus = 'PENDING';
    file.associatedJobId = job._id;
    await file.save();

    queuedJobs.push(job);
  }

  setImmediate(async () => {
    for (const job of queuedJobs) {
      try {
        await runJobProcess(job.jobId);
      } catch (err) {
        console.error(`[Bulk Job Loop Error ${job.jobId}]`, err);
      }
    }
  });

  return {
    success: true,
    message: `Successfully queued ${queuedJobs.length} file(s) for background migration.`,
    jobIds: queuedJobs.map((j) => j.jobId),
  };
};

/**
 * Cancel an active or queued migration job
 */
const cancelMigrationJob = async (jobId) => {
  const job = await MigrationJob.findOne({ jobId });
  if (!job) {
    throw new Error('Migration job not found.');
  }

  if (['COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'CANCELLED'].includes(job.status)) {
    return {
      success: false,
      message: `Job is already in ${job.status} state.`,
    };
  }

  activeJobCancellations.add(jobId);
  job.status = 'CANCELLED';
  job.currentStage = 'Cancellation requested by administrator.';
  await job.save();

  return {
    success: true,
    message: `Cancellation requested for job ${jobId}.`,
    job,
  };
};

/**
 * Resume an interrupted, failed, or paused migration job from its persistent checkpoint
 */
const resumeMigrationJob = async (jobId, adminUserId) => {
  const job = await MigrationJob.findOne({ jobId });
  if (!job) {
    throw new Error('Migration job not found.');
  }

  if (job.status === 'COMPLETED') {
    return {
      success: false,
      message: `Job ${jobId} has already completed successfully.`,
      job,
    };
  }

  job.status = 'QUEUED';
  job.currentStage = 'Job queued for resumption from checkpoint...';
  job.isResumable = true;
  job.retryCount = (job.retryCount || 0) + 1;
  job.errorMessage = '';
  await job.save();

  if (job.detectedFileId) {
    await DetectedRepositoryFile.findByIdAndUpdate(job.detectedFileId, {
      importStatus: 'PROCESSING',
      lastError: '',
    });
  }

  setImmediate(() => {
    runJobProcess(jobId).catch((err) => {
      console.error(`[Resume Job Error ${jobId}]`, err);
    });
  });

  return {
    success: true,
    message: `Migration job ${jobId} resumed from checkpoint successfully.`,
    job,
  };
};

/**
 * Retry a failed migration job (resumes if checkpoint exists, or restarts safely)
 */
const retryMigrationJob = async (jobId, adminUserId) => {
  const oldJob = await MigrationJob.findOne({ jobId });
  if (!oldJob) {
    throw new Error('Migration job not found.');
  }

  // If the job already has checkpoint data, resume it directly
  if (oldJob.checkpoint && oldJob.checkpoint.processedCount > 0) {
    return await resumeMigrationJob(jobId, adminUserId);
  }

  const file = await DetectedRepositoryFile.findById(oldJob.detectedFileId);
  if (!file) {
    throw new Error('Associated file no longer exists.');
  }

  return await createMigrationJob(file._id, adminUserId);
};

/**
 * Get migration job by jobId
 */
const getMigrationJob = async (jobId) => {
  const job = await MigrationJob.findOne({ jobId })
    .populate('detectedFileId')
    .populate('createdBy', 'name email');
  if (!job) {
    throw new Error('Migration job not found.');
  }
  return job;
};

/**
 * Get migration jobs list / history
 */
const getMigrationJobs = async (query = {}) => {
  const { page = 1, limit = 15, status = 'ALL' } = query;
  const filter = {};
  if (status && status !== 'ALL') {
    filter.status = status;
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [jobs, total] = await Promise.all([
    MigrationJob.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('createdBy', 'name email')
      .populate('detectedFileId', 'fileName repoPath fileSize isLfs'),
    MigrationJob.countDocuments(filter),
  ]);

  return {
    success: true,
    jobs,
    pagination: {
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      limit: limitNum,
    },
  };
};

/**
 * Export migration job report as JSON
 */
const exportJobReport = async (jobId) => {
  const job = await MigrationJob.findOne({ jobId }).populate('detectedFileId');
  if (!job) {
    throw new Error('Migration job not found.');
  }

  return {
    jobId: job.jobId,
    sourceFile: job.sourceFile,
    repoPath: job.repoPath,
    commitSha: job.commitSha,
    status: job.status,
    progressPercent: job.progressPercent,
    currentStage: job.currentStage,
    stats: job.stats,
    errors: job.errorLog,
    logs: job.logs,
    report: job.report,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    generatedAt: new Date(),
  };
};

/**
 * Server boot hook to automatically recover any in-progress jobs interrupted by a restart or deploy
 */
const recoverInterruptedJobs = async () => {
  try {
    const interruptedJobs = await MigrationJob.find({
      status: { $in: ['DOWNLOADING', 'VERIFYING', 'EXTRACTING', 'SCANNING', 'MATCHING', 'UPLOADING'] },
    });

    if (interruptedJobs.length === 0) {
      console.log('[Job Recovery] No interrupted migration jobs found.');
      return;
    }

    console.log(`[Job Recovery] Found ${interruptedJobs.length} interrupted job(s). Resuming from persistent checkpoints...`);

    for (const job of interruptedJobs) {
      job.status = 'QUEUED';
      job.currentStage = 'Server restart detected. Auto-recovering and resuming job from checkpoint...';
      job.isResumable = true;
      job.retryCount = (job.retryCount || 0) + 1;
      await job.save();

      if (job.detectedFileId) {
        await DetectedRepositoryFile.findByIdAndUpdate(job.detectedFileId, {
          importStatus: 'PROCESSING',
          lastError: '',
        });
      }

      await logJobEvent(
        job,
        'INFO',
        `Server restart recovery triggered. Resuming from checkpoint (${job.checkpoint?.processedCount || 0} files previously processed).`
      );

      setImmediate(() => {
        runJobProcess(job.jobId).catch((err) => {
          console.error(`[Auto-Recovery Job Error ${job.jobId}]`, err);
        });
      });
    }
  } catch (err) {
    console.error('[Job Recovery Warning]', err.message);
  }
};

module.exports = {
  checkGitHubRepository,
  getGitHubSyncStatus,
  getDetectedFiles,
  createMigrationJob,
  createBulkMigrationJob,
  cancelMigrationJob,
  resumeMigrationJob,
  retryMigrationJob,
  getMigrationJob,
  getMigrationJobs,
  exportJobReport,
  recoverInterruptedJobs,
  verifyArchive,
  downloadFileFromGitHub,
  extractZipRecursivelyStreaming,
  calculateSha256,
};
