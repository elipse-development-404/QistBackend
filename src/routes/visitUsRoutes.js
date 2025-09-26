const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  getVisitUs,
  createVisitUs,
  updateVisitUs,
  deleteVisitUs,
  toggleVisitUsActive,
  getActiveVisitUs,
  getVisitUsById
} = require('../controllers/visitUsController');

router.get(
  '/visit-us',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
    query('status').optional().isIn(['all', 'active', 'inactive']),
    query('sort').optional().isIn(['id', 'title', 'isActive']),
    query('order').optional().isIn(['asc', 'desc']),
  ],
  getVisitUs
);

router.post(
  '/visit-us',
  authenticateToken,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('maps').isArray({ min: 1 }).withMessage('At least one map embed code is required'),
    body('maps.*.map_embed').notEmpty().withMessage('Map embed code is required'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  ],
  createVisitUs
);

router.put(
  '/visit-us/:id',
  authenticateToken,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('maps').isArray({ min: 1 }).withMessage('At least one map embed code is required'),
    body('maps.*.map_embed').notEmpty().withMessage('Map embed code is required'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  ],
  updateVisitUs
);

router.patch('/visit-us/:id/toggle', authenticateToken, toggleVisitUsActive);

router.delete('/visit-us/:id', authenticateToken, deleteVisitUs);

router.get('/active-visit-us', getActiveVisitUs);
router.get('/visit-us/:id', getVisitUsById);

module.exports = router;