const express = require('express');
const { createOrders, getOrders } = require('../controllers/orderController');
const router = express.Router();

router.post('/order', createOrders);
router.get('/order', getOrders);

module.exports = router;