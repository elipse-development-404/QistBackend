const express = require('express');
const { upsertPage, getPages, getPageBySlug, deletePage } = require('../controllers/pageController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/pages', authenticateToken, upsertPage);
router.get('/pages', authenticateToken, getPages);
router.get('/pages/:slug', getPageBySlug); // Public route
router.delete('/pages/:id', authenticateToken, deletePage);

module.exports = router;