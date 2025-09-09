const { createProduct, getAllProducts, getProductByName, toggleProductField, updateProduct, getProductPagination, getProductByCategorySlug, getProductByCategoryAndSubSlug, getLatestProducts } = require('../controllers/productController');
const upload = require('../middlewares/uploadMiddleware');
const express = require('express');
const router = express.Router();

router.post('/create-product', upload.array('files'), createProduct);
router.get('/product', getAllProducts);
router.get('/product/pagination', getProductPagination);
router.get('/product/category/:categorySlug', getProductByCategorySlug);
router.get('/product/category/:categorySlug/:subcategorySlug', getProductByCategoryAndSubSlug);
router.put('/product/:id', updateProduct);
router.get('/product/name/:name', getProductByName);
router.patch('/products/:id/toggle', toggleProductField);
router.get('/product/latest', getLatestProducts);

module.exports = router;