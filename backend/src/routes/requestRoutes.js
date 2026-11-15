const express = require('express');
const router = express.Router();
const { submitAccessRequest, getMyRequest } = require('../controllers/requestController');
const { protect } = require('../middleware/auth');

router.post('/', protect, submitAccessRequest);
router.get('/my', protect, getMyRequest);

module.exports = router;
