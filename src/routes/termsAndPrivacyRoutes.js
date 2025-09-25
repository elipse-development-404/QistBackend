const express = require('express');
const { upsertTermsAndPrivacy, getTermsAndPrivacy, deleteTermsAndPrivacy, getActiveTermsAndPrivacy } = require('../controllers/termsAndPrivacyController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/terms-and-privacy', authenticateToken, upsertTermsAndPrivacy);
router.get('/terms-and-privacy', authenticateToken, getTermsAndPrivacy);
router.delete('/terms-and-privacy', authenticateToken, deleteTermsAndPrivacy);
router.get('/terms-and-privacy/active', getActiveTermsAndPrivacy);

module.exports = router;