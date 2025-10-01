const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  getCustomers,
  updateCustomer,
  deleteCustomer,
  toggleCustomerActive,
} = require('../controllers/customerAdminController');

router.get(
  '/all-customers',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
    query('status').optional().isIn(['all', 'active', 'inactive']),
    query('sort').optional().isIn(['id', 'firstName', 'isActive']),
    query('order').optional().isIn(['asc', 'desc']),
  ],
  getCustomers
);

router.put(
  '/customers/:id',
  authenticateToken,
  [
    body('firstName').isString().optional(),
    body('lastName').isString().optional(),
    body('email').isEmail().optional(),
    body('phone').isString().optional(),
    body('cnic').isString().optional(),
    body('isActive').isBoolean().optional(),
  ],
  updateCustomer
);

router.delete('/customers/:id', authenticateToken, deleteCustomer);

router.patch('/customers/:id/toggle', authenticateToken, toggleCustomerActive);

module.exports = router;