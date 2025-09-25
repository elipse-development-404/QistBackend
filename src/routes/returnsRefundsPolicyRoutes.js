const express = require('express');
const { upsertReturnsRefundsPolicy, getReturnsRefundsPolicy, deleteReturnsRefundsPolicy, getActiveReturnsRefundsPolicy } = require('../controllers/returnsRefundsPolicyController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/returns-refunds-policy', authenticateToken, upsertReturnsRefundsPolicy);
router.get('/returns-refunds-policy', authenticateToken, getReturnsRefundsPolicy);
router.delete('/returns-refunds-policy', authenticateToken, deleteReturnsRefundsPolicy);
router.get('/returns-refunds-policy/active', getActiveReturnsRefundsPolicy);

module.exports = router;