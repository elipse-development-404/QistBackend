const express = require('express');
const { upsertVerificationProcess, getVerificationProcess, deleteVerificationProcess, getActiveVerificationProcess } = require('../controllers/verificationProcessController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/verification-process', authenticateToken, upsertVerificationProcess);
router.get('/verification-process', authenticateToken, getVerificationProcess);
router.delete('/verification-process', authenticateToken, deleteVerificationProcess);
router.get('/verification-process/active', getActiveVerificationProcess);

module.exports = router;