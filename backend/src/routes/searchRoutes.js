const express = require('express');
const router = express.Router();
const { globalSearch } = require('../controllers/searchController');
const { protect, requireApproved } = require('../middleware/auth');

router.use(protect, requireApproved);

router.get('/', globalSearch);

module.exports = router;
