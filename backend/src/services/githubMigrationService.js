const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const AdmZip = require('adm-zip');
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

// Working temp directory for downloads and extractions
const TEMP_BASE_DIR =
  process.env.MIGRATION_TEMP_DIR ||
  path.resolve(__dirname, '../../temp_migration/github_downloads');

if (!fs.existsSync(TEMP_BASE_DIR)) {
  fs.mkdirSync(TEMP_BASE_DIR, { recursive: true });
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
  await job.save();
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
      transformResponse: [(data) => data], // Raw text
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
  } catch (err) {
    // If not accessible or not LFS, ignore
  }
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
      // We only track files ('blob')
      if (item.type !== 'blob') continue;

      // Skip internal repository metadata files
      if (item.path.startsWith('.git') && !item.path.endsWith('.zip') && !item.path.endsWith('.pdf')) {
        continue;
      }

      const fileName = path.basename(item.path);
      const ext = path.extname(item.path).toLowerCase().replace('.', '');
      const category = DetectedRepositoryFile.classifyExtension(ext);

      // Check if file is an LFS pointer
      let isLfs = false;
      let lfsOid = '';
      let lfsSize = 0;
      let actualSize = item.size || 0;

      // Git LFS pointer files are small blobs (< 500 bytes) with media/archive extensions
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
        // If git blob SHA changed, mark as updated
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
    // If not checked yet, run initial check
    return await checkGitHubRepository();
  }

  // Refresh dynamic counts
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
      .populate('associatedJobId', 'jobId status progressPercent'),
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
 * Download a file from GitHub (handles both direct raw / API and Git LFS objects)
 */
const downloadFileFromGitHub = async (detectedFile, destPath, onProgress = null) => {
  const owner = DEFAULT_REPO_OWNER;
  const repo = DEFAULT_REPO_NAME;
  const branch = DEFAULT_BRANCH;

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
        timeout: 20000,
      }
    );

    const downloadHref = batchRes.data?.objects?.[0]?.actions?.download?.href;
    if (!downloadHref) {
      throw new Error(`Git LFS download link could not be resolved for ${detectedFile.fileName}`);
    }

    // Stream download the LFS media asset
    const response = await axios({
      method: 'GET',
      url: downloadHref,
      responseType: 'stream',
      timeout: 300000, // 5 min timeout for large LFS assets
    });

    const writer = fs.createWriteStream(destPath);
    let downloadedBytes = 0;
    const totalBytes = detectedFile.lfsSize || parseInt(response.headers['content-length'] || 0, 10);

    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (onProgress && totalBytes > 0) {
          onProgress(downloadedBytes, totalBytes);
        }
      });
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } else {
    // Standard file download via raw.githubusercontent.com
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${detectedFile.repoPath}`;
    const response = await axios({
      method: 'GET',
      url: rawUrl,
      headers: getGitHubHeaders(),
      responseType: 'stream',
      timeout: 120000,
    });

    const writer = fs.createWriteStream(destPath);
    let downloadedBytes = 0;
    const totalBytes = detectedFile.fileSize || parseInt(response.headers['content-length'] || 0, 10);

    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (onProgress && totalBytes > 0) {
          onProgress(downloadedBytes, totalBytes);
        }
      });
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }
};

/**
 * Recursive extraction helper with Zip Slip and Zip Bomb protection
 */
const extractZipRecursively = (zipFilePath, targetDir, currentDepth = 0, maxDepth = 5) => {
  if (currentDepth > maxDepth) {
    console.warn(`[ZIP Warning] Reached maximum nesting depth (${maxDepth}) at ${zipFilePath}`);
    return;
  }

  const zip = new AdmZip(zipFilePath);
  const zipEntries = zip.getEntries();

  // Zip Bomb safety limit: 10,000 files or 3 GB total uncompressed
  let totalUncompressed = 0;
  for (const entry of zipEntries) {
    totalUncompressed += entry.header.size;
    if (totalUncompressed > 3 * 1024 * 1024 * 1024) {
      throw new Error('Archive exceeds maximum safe uncompressed size limit (3 GB).');
    }
  }

  for (const entry of zipEntries) {
    const entryName = entry.entryName;

    // Zip Slip security validation: forbid path traversal
    if (entryName.includes('..') || path.isAbsolute(entryName)) {
      console.warn(`[Security Alert] Rejected insecure ZIP entry: ${entryName}`);
      continue;
    }

    const fullDestPath = path.join(targetDir, entryName);

    if (entry.isDirectory) {
      if (!fs.existsSync(fullDestPath)) {
        fs.mkdirSync(fullDestPath, { recursive: true });
      }
    } else {
      const parentDir = path.dirname(fullDestPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(fullDestPath, entry.getData());

      // If extracted file is itself a nested ZIP, unpack recursively
      if (entryName.toLowerCase().endsWith('.zip')) {
        const nestedTargetDir = path.join(
          parentDir,
          path.basename(entryName, path.extname(entryName))
        );
        if (!fs.existsSync(nestedTargetDir)) {
          fs.mkdirSync(nestedTargetDir, { recursive: true });
        }
        extractZipRecursively(fullDestPath, nestedTargetDir, currentDepth + 1, maxDepth);
      }
    }
  }
};

/**
 * Recursively walk directory and collect all files
 */
const walkDir = (dir, fileList = []) => {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
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
  }
  return fileList;
};

/**
 * Calculate SHA-256 hash of a file
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
 * Background migration job execution pipeline
 */
const runJobProcess = async (jobId) => {
  const job = await MigrationJob.findOne({ jobId });
  if (!job) return;

  const detectedFile = await DetectedRepositoryFile.findById(job.detectedFileId);
  if (!detectedFile) {
    job.status = 'FAILED';
    await logJobEvent(job, 'ERROR', 'Associated DetectedRepositoryFile was not found in database.');
    return;
  }

  const jobWorkDir = path.join(TEMP_BASE_DIR, jobId);
  if (!fs.existsSync(jobWorkDir)) {
    fs.mkdirSync(jobWorkDir, { recursive: true });
  }

  try {
    job.startedAt = new Date();
    job.status = 'DOWNLOADING';
    job.currentStage = 'Validating file and initiating download from GitHub';
    job.progressPercent = 5;
    detectedFile.importStatus = 'PROCESSING';
    detectedFile.lastImportAttempt = new Date();
    await detectedFile.save();
    await logJobEvent(job, 'INFO', `Starting migration for ${detectedFile.repoPath} (${detectedFile.fileName})`);

    // Check cancellation
    if (activeJobCancellations.has(jobId)) throw new Error('MIGRATION_CANCELLED');

    // Step 2: Download file from GitHub
    const downloadedFilePath = path.join(jobWorkDir, detectedFile.fileName);
    job.currentStage = `Downloading from GitHub (${(detectedFile.fileSize / (1024 * 1024)).toFixed(1)} MB)...`;
    job.progressPercent = 10;
    await job.save();

    await downloadFileFromGitHub(detectedFile, downloadedFilePath, (downloaded, total) => {
      const pct = Math.min(30, 10 + Math.round((downloaded / total) * 20));
      if (pct !== job.progressPercent) {
        job.progressPercent = pct;
        job.save().catch(() => {});
      }
    });

    if (activeJobCancellations.has(jobId)) throw new Error('MIGRATION_CANCELLED');

    await logJobEvent(job, 'SUCCESS', `File downloaded successfully to ${downloadedFilePath}`);
    job.progressPercent = 35;
    await job.save();

    const isZip = detectedFile.fileTypeCategory === 'ZIP';
    const extractedDir = path.join(jobWorkDir, 'extracted');
    if (!fs.existsSync(extractedDir)) {
      fs.mkdirSync(extractedDir, { recursive: true });
    }

    // Step 3: Extraction (if ZIP)
    if (isZip) {
      job.status = 'EXTRACTING';
      job.currentStage = 'Extracting archive and inspecting internal nested archives...';
      job.progressPercent = 40;
      await logJobEvent(job, 'INFO', 'Unpacking archive with Zip Slip and nesting protection...');

      extractZipRecursively(downloadedFilePath, extractedDir);

      if (activeJobCancellations.has(jobId)) throw new Error('MIGRATION_CANCELLED');

      await logJobEvent(job, 'SUCCESS', 'Archive unpacked successfully.');
    } else {
      // Single document: copy to extractedDir
      const singleDest = path.join(extractedDir, detectedFile.fileName);
      fs.copyFileSync(downloadedFilePath, singleDest);
    }

    // Step 4: Scan extracted contents
    job.status = 'SCANNING';
    job.currentStage = 'Scanning extracted files and calculating SHA-256 checksums...';
    job.progressPercent = 50;
    await job.save();

    const allDiscoveredFiles = walkDir(extractedDir);
    job.stats.discoveredCount = allDiscoveredFiles.length;
    job.stats.extractedCount = allDiscoveredFiles.length;

    await logJobEvent(
      job,
      'INFO',
      `Found ${allDiscoveredFiles.length} extracted files. Classifying and deduplicating...`
    );

    // Filter into supported documents vs unsupported formats
    const supportedFiles = [];
    let unsupportedCount = 0;

    for (const fileInfo of allDiscoveredFiles) {
      const ext = fileInfo.ext;
      // Skip unpacked zip archives themselves
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

    // Step 5: Matching & Deduplication
    job.status = 'MATCHING';
    job.currentStage = 'Matching documents with DOConCD catalogue & deduplicating...';
    await logJobEvent(job, 'INFO', `Processing ${supportedFiles.length} supported documents.`);

    // Load catalogue metadata and folder lookup if available
    const matchedCataloguePath = path.join(__dirname, '../../data/catalogue_matched.json');
    const folderLookupPath = path.join(__dirname, '../../data/folder_lookup.json');

    const catalogueList = fs.existsSync(matchedCataloguePath)
      ? JSON.parse(fs.readFileSync(matchedCataloguePath, 'utf8'))
      : [];
    const folderLookup = fs.existsSync(folderLookupPath)
      ? JSON.parse(fs.readFileSync(folderLookupPath, 'utf8'))
      : {};

    // Get default root folder
    let rootFolder = await Folder.findOne({ parentFolderId: null });
    if (!rootFolder) {
      rootFolder = await Folder.findOne();
    }

    // Step 6: Ingestion / Upload Loop
    job.status = 'UPLOADING';
    job.currentStage = 'Uploading documents to storage and updating library...';
    job.progressPercent = 70;
    await job.save();

    const importedDocIds = [];
    let matchedCount = 0;
    let uploadedCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;

    for (let idx = 0; idx < supportedFiles.length; idx++) {
      if (activeJobCancellations.has(jobId)) throw new Error('MIGRATION_CANCELLED');

      const fileInfo = supportedFiles[idx];
      const baseNameWithoutExt = path.basename(fileInfo.fileName, path.extname(fileInfo.fileName));

      try {
        const fileHash = await calculateSha256(fileInfo.fullPath);

        // Check if already deduplicated in MigrationAsset or Document
        let existingAsset = await MigrationAsset.findOne({ sha256: fileHash });
        let existingDoc = await Document.findOne({
          $or: [
            { originalFileName: fileInfo.fileName },
            { fileName: baseNameWithoutExt },
          ],
        });

        // Match against catalogue
        const catalogueItem = catalogueList.find(
          (c) =>
            c.fileName?.toLowerCase() === baseNameWithoutExt.toLowerCase() ||
            c.originalFileName?.toLowerCase() === fileInfo.fileName.toLowerCase() ||
            c.title?.toLowerCase() === baseNameWithoutExt.toLowerCase()
        );

        if (catalogueItem) {
          matchedCount++;
        }

        // Determine destination folder
        let targetFolderId = null;
        if (catalogueItem && catalogueItem.categoryPath) {
          const folderName = CATEGORY_TO_FOLDER_NAME[catalogueItem.categoryPath] || catalogueItem.category;
          targetFolderId = folderLookup[folderName] || folderLookup[catalogueItem.categoryPath];
        }

        if (!targetFolderId) {
          // Fallback to archive name folder
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
          // Reuse existing document asset
          duplicateCount++;
          uploadResult = {
            asset_id: existingDoc.cloudinaryAssetId,
            public_id: existingDoc.cloudinaryPublicId,
            secure_url: existingDoc.secureUrl,
            storage: existingDoc.storageProvider,
            format: existingDoc.fileExtension,
            bytes: existingDoc.fileSize,
          };
          // Save in MigrationAsset for future imports
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
          // Upload to storage
          const fileBuf = fs.readFileSync(fileInfo.fullPath);
          uploadResult = await uploadToCloudinary(
            fileBuf,
            fileInfo.fileName,
            `dms/${detectedFile.fileName.replace(/\.zip$/i, '')}`
          );
          uploadedCount++;

          // Record in MigrationAsset
          await MigrationAsset.create({
            sha256: fileHash,
            fileName: fileInfo.fileName,
            fileSize: fileInfo.size,
            storageProvider: uploadResult.storage || 'CLOUDINARY',
            secureUrl: uploadResult.secure_url || '',
            cloudinaryPublicId: uploadResult.public_id || '',
          });
        }

        // Determine MIME Type
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

        // Upsert Document in MongoDB
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

        // Update progress
        const currentProgress = 70 + Math.round(((idx + 1) / supportedFiles.length) * 25);
        if (currentProgress !== job.progressPercent) {
          job.progressPercent = currentProgress;
          job.stats.uploadedCount = uploadedCount;
          job.stats.duplicateCount = duplicateCount;
          job.stats.matchedCount = matchedCount;
          job.stats.failedCount = failedCount;
          job.save().catch(() => {});
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

    // Step 7: Completion & Report
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

    // Update DetectedRepositoryFile
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

    // Refresh GitHubSyncState aggregate counts
    await getGitHubSyncStatus();

    // Clean up temporary workspace
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

    // Refresh GitHubSyncState counts
    await getGitHubSyncStatus();

    try {
      if (fs.existsSync(jobWorkDir)) {
        fs.rmSync(jobWorkDir, { recursive: true, force: true });
      }
    } catch {}
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

  // Run in background without blocking response
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

  // Process sequentially in background
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
 * Retry a failed migration job
 */
const retryMigrationJob = async (jobId, adminUserId) => {
  const oldJob = await MigrationJob.findOne({ jobId });
  if (!oldJob) {
    throw new Error('Migration job not found.');
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
 * Server boot hook to recover any interrupted jobs
 */
const recoverInterruptedJobs = async () => {
  try {
    const interruptedJobs = await MigrationJob.find({
      status: { $in: ['DOWNLOADING', 'EXTRACTING', 'SCANNING', 'MATCHING', 'UPLOADING'] },
    });

    for (const job of interruptedJobs) {
      job.status = 'FAILED';
      job.currentStage = 'Migration interrupted by server restart.';
      job.errorLog.push({
        timestamp: new Date(),
        message: 'Job was interrupted due to server process shutdown or restart.',
      });
      job.completedAt = new Date();
      await job.save();

      if (job.detectedFileId) {
        await DetectedRepositoryFile.findByIdAndUpdate(job.detectedFileId, {
          importStatus: 'FAILED',
          lastError: 'Interrupted by server restart',
        });
      }
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
  retryMigrationJob,
  getMigrationJob,
  getMigrationJobs,
  exportJobReport,
  recoverInterruptedJobs,
};
