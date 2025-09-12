const express = require('express');
const router = express.Router();
const { createProductDeal, getProductDealsPagination, updateProductDeal, deleteProductDeal } = require('../controllers/productDealController');
const { query } = require('express-validator');

router.post('/create-product-deal', createProductDeal);
router.put('/product-deals/:id', updateProductDeal);
router.delete('/product-deals/:id', deleteProductDeal);

router.get(
  '/product-deals/pagination',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
    query('status').optional().isIn(['all', 'active', 'inactive']),
    query('sort').optional().isIn(['id', 'dealId', 'productId']),
    query('order').optional().isIn(['asc', 'desc']),
  ],
  getProductDealsPagination
);

module.exports = router;