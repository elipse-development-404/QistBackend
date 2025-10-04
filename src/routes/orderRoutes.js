const express = require('express');
const { body, query } = require('express-validator');
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  createOrders,
  trackOrder,
  getOrders,
  getPendingOrders,
  getDeliveredOrders,
  getOrderById,
  approveCancel,
  getCancelRequests,
  getCancelledOrders,
  updateOrderStatus,
  getRejectedOrders
} = require('../controllers/orderController');

const router = express.Router();

router.get(
  '/orders',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
    query('status').optional().isIn(['all', 'Pending', 'Confirmed', 'Shipped', 'Delivered']),
  ],
  getOrders
);

router.get(
  '/pending-orders',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
  ],
  getPendingOrders
);

router.get(
  '/delivered-orders',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
  ],
  getDeliveredOrders
);

router.get(
  '/cancelled-orders',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
  ],
  getCancelledOrders
);

router.get('/orders/:id', authenticateToken, getOrderById);

router.post('/order', createOrders);
router.post('/order/track-order', trackOrder);

router.get(
  '/cancel-requests',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
  ],
  getCancelRequests
);

router.post('/approve-cancel/:orderId', authenticateToken, approveCancel);

router.put(
  '/orders/:id/status',
  authenticateToken,
  [
    body('status').isIn(['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled', 'Rejected']),
    body('rejectionReason').optional().isString().trim(),
  ],
  updateOrderStatus
);

router.get(
  '/rejected-orders',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
  ],
  getRejectedOrders
);

module.exports = router;