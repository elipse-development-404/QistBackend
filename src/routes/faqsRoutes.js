const express = require('express');
const { createFaq, getAllFaqs, updateFaq, deleteFaq, getFaqsForProduct } = require('../controllers/faqController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/faqs', authenticateToken, createFaq);
router.get('/faqs', authenticateToken, getAllFaqs);
router.put('/faqs/:id', authenticateToken, updateFaq);
router.delete('/faqs/:id', authenticateToken, deleteFaq);

router.get('/faqs/product/:productId', getFaqsForProduct);

module.exports = router;