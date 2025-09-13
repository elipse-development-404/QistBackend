const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { authenticateToken } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const {
  getTopCategories,
  createTopCategory,
  updateTopCategory,
  deleteTopCategory,
  toggleTopCategoryActive,
  getActiveTopCategories,
} = require('../controllers/topCategoryController');

router.get(
  '/top-categories',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
    query('status').optional().isIn(['all', 'active', 'inactive']),
    query('sort').optional().isIn(['id', 'isActive']),
    query('order').optional().isIn(['asc', 'desc']),
  ],
  getTopCategories
);

router.post(
  '/top-categories',
  authenticateToken,
  upload.single('image'),
  [
    body('formattedData').custom((value) => {
      try {
        const data = JSON.parse(value);
        if (!data.category_id) throw new Error('Category ID is required');
        return true;
      } catch {
        throw new Error('Invalid formattedData');
      }
    }),
  ],
  createTopCategory
);

router.put(
  '/top-categories/:id',
  authenticateToken,
  upload.single('image'),
  [
    body('formattedData').custom((value) => {
      try {
        const data = JSON.parse(value);
        if (!data.category_id) throw new Error('Category ID is required');
        return true;
      } catch {
        throw new Error('Invalid formattedData');
      }
    }),
  ],
  updateTopCategory
);

router.patch('/top-categories/:id/toggle', authenticateToken, toggleTopCategoryActive);

router.delete('/top-categories/:id', authenticateToken, deleteTopCategory);

router.get('/active-top-categories', getActiveTopCategories);

module.exports = router;