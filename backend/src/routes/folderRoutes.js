const express = require('express');
const router = express.Router();
const {
  getFolders,
  getFolderById,
  createFolder,
  updateFolder,
  deleteFolder,
} = require('../controllers/folderController');
const { protect, requireApproved } = require('../middleware/auth');
const { checkFolderPermission } = require('../middleware/permission');

router.use(protect, requireApproved);

router.get('/', getFolders);
router.get('/:id', getFolderById);
router.post('/', checkFolderPermission('manage'), createFolder);
router.put('/:id', checkFolderPermission('manage'), updateFolder);
router.delete('/:id', checkFolderPermission('manage'), deleteFolder);

module.exports = router;
