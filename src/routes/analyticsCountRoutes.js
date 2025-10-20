const express = require('express');
const router = express.Router();
const {
  getDashboardMetrics,
  getOrderTrends,
  getAnalyticsByDimension,
  getFilterOptions
} = require('../controllers/analyticsCountController');

router.get('/dashboard-metrics', getDashboardMetrics);
router.get('/order-trends', getOrderTrends);
router.get('/analytics-by-dimension', getAnalyticsByDimension);
router.get('/filter-options', getFilterOptions);

module.exports = router;