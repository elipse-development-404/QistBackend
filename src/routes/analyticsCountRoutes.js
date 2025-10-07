const express = require('express');
const router = express.Router();
const {
  getActiveCustomersCount,
  getPendingOrdersCount,
  getConfirmedOrdersCount,
  getShippedOrdersCount,
  getDeliveredOrdersCount,
  getTotalDealRevenue,
  getTotalAdvanceRevenue,
  getOrderTrends,
  getTotalSales,
} = require('../controllers/analyticsCountController');

router.get('/active-customers-count', getActiveCustomersCount);
router.get('/total-sales-count', getTotalSales);
router.get('/pending-orders-count', getPendingOrdersCount);
router.get('/confirmed-orders-count', getConfirmedOrdersCount);
router.get('/shipped-orders-count', getShippedOrdersCount);
router.get('/delivered-orders-count', getDeliveredOrdersCount);
router.get('/total-deal-revenue', getTotalDealRevenue);
router.get('/total-advance-revenue', getTotalAdvanceRevenue);
router.get('/order-trends', getOrderTrends);

module.exports = router;