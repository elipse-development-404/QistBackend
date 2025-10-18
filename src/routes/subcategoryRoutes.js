const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  getSubcategories,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  toggleSubcategoryActive,
  getSubcategoriesByCategory,
  getOnlyTrueSubCategories,
} = require('../controllers/subcategoryController');

router.get('/plain-subcategories/:id', getSubcategoriesByCategory);

router.get('/subcategories/active', getOnlyTrueSubCategories);

router.get(
  '/subcategories',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
    query('status').optional().isIn(['all', 'active', 'inactive']),
    query('sort').optional().isIn(['s.id', 's.name', 'c.name', 's.isActive']),
    query('order').optional().isIn(['asc', 'desc']),
  ],
  getSubcategories
);

router.post(
  '/subcategories',
  authenticateToken,
  [
    body('name').isString().notEmpty().withMessage('Name is required'),
    body('category_id').isInt().withMessage('Valid category ID is required'),
    body('description').isString().optional().isLength({ max: 255 }).withMessage('Description must not exceed 255 characters'),
    body('isActive').isBoolean().optional().withMessage('isActive must be a boolean'),
    body('meta_title').isString().optional().isLength({ max: 60 }).withMessage('Meta title must not exceed 60 characters'),
    body('meta_description').isString().optional().isLength({ max: 160 }).withMessage('Meta description must not exceed 160 characters'),
    body('meta_keywords').isString().optional(),
    body('slugName').isString().optional(),
  ],
  createSubcategory
);

router.put(
  '/subcategories/:id',
  authenticateToken,
  [
    body('name').isString().notEmpty().withMessage('Name is required'),
    body('category_id').isInt().withMessage('Valid category ID is required'),
    body('description').isString().optional().isLength({ max: 255 }).withMessage('Description must not exceed 255 characters'),
    body('meta_title').isString().optional().isLength({ max: 60 }).withMessage('Meta title must not exceed 60 characters'),
    body('meta_description').isString().optional().isLength({ max: 160 }).withMessage('Meta description must not exceed 160 characters'),
    body('meta_keywords').isString().optional(),
    body('slugName').isString().optional(),
  ],
  updateSubcategory
);

router.patch('/subcategories/:id/toggle', authenticateToken, toggleSubcategoryActive);

router.delete('/subcategories/:id', authenticateToken, deleteSubcategory);

module.exports = router;