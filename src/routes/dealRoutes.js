const express = require('express');
const router = express.Router();
const { createDeal, getAllDeals, updateDeal, toggleDeal, deleteDeal, getDealsPagination } = require('../controllers/dealController');
const { query } = require('express-validator');

router.post('/create-deal', createDeal);
router.get('/deals', getAllDeals);
router.put('/deals/:id', updateDeal);
router.patch('/deals/:id/toggle', toggleDeal);
router.delete('/deals/:id', deleteDeal);

router.get(
  '/deals/pagination',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
    query('status').optional().isIn(['all', 'active', 'inactive']),
    query('sort').optional().isIn(['id', 'name', 'startDate', 'endDate', 'isActive']),
    query('order').optional().isIn(['asc', 'desc']),
  ],
  getDealsPagination
);

module.exports = router;