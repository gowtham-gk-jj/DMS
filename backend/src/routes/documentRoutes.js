const express = require('express');
const router = express.Router();
const {
  getDocumentsInFolder,
  getDocumentById,
  previewDocument,
  streamDocument,
  downloadDocument,
  uploadDocuments,
  updateDocument,
  moveDocument,
  deleteDocument,
  getRecentDocuments,
} = require('../controllers/documentController');
const { protect, requireApproved } = require('../middleware/auth');
const { checkFolderPermission, checkDocumentPermission } = require('../middleware/permission');
const upload = require('../middleware/upload');

router.use(protect, requireApproved);

router.get('/recent', getRecentDocuments);
router.get('/folder/:folderId', checkFolderPermission('read'), getDocumentsInFolder);
router.post('/folder/:folderId/upload', checkFolderPermission('upload'), upload.array('files', 20), uploadDocuments);

router.get('/:id', getDocumentById);
router.get('/:id/preview', checkDocumentPermission('read'), previewDocument);
router.get('/:id/stream', checkDocumentPermission('read'), streamDocument);
router.get('/:id/download', checkDocumentPermission('download'), downloadDocument);
router.put('/:id', checkDocumentPermission('manage'), updateDocument);
router.post('/:id/move', checkDocumentPermission('manage'), moveDocument);
router.delete('/:id', checkDocumentPermission('manage'), deleteDocument);

module.exports = router;
