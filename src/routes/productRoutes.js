const { createProduct, getAllProducts, getProductById, getProductByName, toggleProductField, updateProduct, getProductPagination, getProductByCategorySlug, getProductByCategoryAndSubSlug } = require('../controllers/productController');
const upload = require('../middlewares/uploadMiddleware');
const express = require('express');
const router = express.Router();

router.post('/create-product', upload.array('files'), createProduct);
router.get('/product', getAllProducts);
router.get('/product/pagination', getProductPagination);
router.get('/product/:id', getProductById);
router.get('/product/category/:categorySlug', getProductByCategorySlug);
router.get('/product/category/:categorySlug/:subcategorySlug', getProductByCategoryAndSubSlug);
router.put('/product/:id', updateProduct);
router.get('/product/name/:name', getProductByName);
router.patch('/products/:id/toggle', toggleProductField);

module.exports = router;