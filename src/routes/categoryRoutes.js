const express = require('express');
const router = express.Router();
const upload = require('../middlewares/uploadMiddleware');
const { body, query } = require('express-validator');
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  getCategories,
  getOnlyTrueCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryActive,
  getAllPlainCategory,
  getLimitOnlyTrueCategories,
} = require('../controllers/categoryController');

router.get(
  '/all-categories',
  
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
    query('status').optional().isIn(['all', 'active', 'inactive']),
    query('sort').optional().isIn(['id', 'name', 'isActive']),
    query('order').optional().isIn(['asc', 'desc']),
  ],
  getCategories   
);

router.get('/categories', getOnlyTrueCategories);
router.get('/limit/categories', getLimitOnlyTrueCategories);
router.get('/plain-categories', getAllPlainCategory);

router.post(
  '/categories',
  authenticateToken,
  upload.array('files'),
  [
    body('name').isString().notEmpty().withMessage('Name is required'),
    body('description').isString().optional(),
    body('isActive').isBoolean().optional().withMessage('isActive must be a boolean'),
  ],
  createCategory
);

router.put(
  '/categories/:id',
  authenticateToken,
  [
    body('name').isString().notEmpty().withMessage('Name is required'),
    body('description').isString().optional(),
    body('isActive').isBoolean().optional().withMessage('isActive must be a boolean'),
  ],
  updateCategory
);

router.delete('/categories/:id', authenticateToken, deleteCategory);

router.patch('/categories/:id/toggle', authenticateToken, toggleCategoryActive);

module.exports = router;