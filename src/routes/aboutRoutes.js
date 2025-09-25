const express = require('express');
const { upsertAbout, getAbout, deleteAbout, getActiveAbout } = require('../controllers/aboutController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/abouts', authenticateToken, upsertAbout);
router.get('/abouts', authenticateToken, getAbout);
router.delete('/abouts', authenticateToken, deleteAbout);
router.get('/abouts/active', getActiveAbout);

module.exports = router;