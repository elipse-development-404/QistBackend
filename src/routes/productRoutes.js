const { createProduct, getAllProducts, getProductByName, toggleProductField, updateProduct, getProductPagination, getProductByCategorySlug, getProductByCategoryAndSubSlug, getLatestProducts, getAllProductsPagination, getProductById, getProductSearch, getProductBySubcategorySlugSimple } = require('../controllers/productController');
const upload = require('../middlewares/uploadMiddleware');
const express = require('express');
const router = express.Router();
const { query } = require('express-validator');

router.post('/create-product', upload.array('files'), createProduct);
router.get('/product', getAllProducts);
router.get('/product/pagination', getProductPagination);
router.get('/product/search', getProductSearch);
router.get('/product/latest', getLatestProducts);
router.get(
  '/product-all-pagination',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
    query('status').optional().isIn(['all', 'active', 'inactive']),
    query('sort').optional().isIn(['id', 'name', 'price', 'isActive']),
    query('order').optional().isIn(['asc', 'desc']),
  ],
  getAllProductsPagination
);

router.get('/product/subcategory/related/:subcategorySlug', getProductBySubcategorySlugSimple);
router.get('/product/category/:categorySlug', getProductByCategorySlug);
router.get('/product/category/:categorySlug/:subcategorySlug', getProductByCategoryAndSubSlug);
router.put('/product/:id', updateProduct);
router.get('/product/name/:name', getProductByName);
router.get('/product/:id', getProductById);
router.patch('/products/:id/toggle', toggleProductField);

module.exports = router;