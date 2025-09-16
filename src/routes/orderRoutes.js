const express = require('express');
const { createOrders } = require('../controllers/orderController');
const router = express.Router();

router.post('/order', createOrders);

module.exports = router;