const express = require('express');
const { createQA, getAllQAs, updateQA, deleteQA, getActiveQAs } = require('../controllers/qaController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/qas', authenticateToken, createQA);
router.get('/qas', authenticateToken, getAllQAs);
router.put('/qas/:id', authenticateToken, updateQA);
router.delete('/qas/:id', authenticateToken, deleteQA);
router.get('/qas/active', getActiveQAs);

module.exports = router;