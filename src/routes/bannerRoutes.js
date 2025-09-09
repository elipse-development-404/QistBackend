// routes/bannerRoutes.js
const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { authenticateToken } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const {
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerActive,
  getActiveBanners,
} = require('../controllers/bannerController');

router.get(
  '/banners',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
    query('status').optional().isIn(['all', 'active', 'inactive']),
    query('sort').optional().isIn(['id', 'product_url', 'isActive']),
    query('order').optional().isIn(['asc', 'desc']),
  ],
  getBanners
);

router.post(
  '/banners',
  authenticateToken,
  upload.single('image'),
  [
    body('formattedData').custom((value) => {
      try {
        const data = JSON.parse(value);
        if (!data.product_url) throw new Error('Product URL is required');
        return true;
      } catch {
        throw new Error('Invalid formattedData');
      }
    }),
  ],
  createBanner
);

router.put(
  '/banners/:id',
  authenticateToken,
  upload.single('image'),
  [
    body('formattedData').custom((value) => {
      try {
        const data = JSON.parse(value);
        if (!data.product_url) throw new Error('Product URL is required');
        return true;
      } catch {
        throw new Error('Invalid formattedData');
      }
    }),
  ],
  updateBanner
);

router.patch('/banners/:id/toggle', authenticateToken, toggleBannerActive);

router.delete('/banners/:id', authenticateToken, deleteBanner);

router.get('/active-banners', getActiveBanners);

module.exports = router;