const express = require('express');
const { upsertDeliveryPolicy, getDeliveryPolicy, deleteDeliveryPolicy, getActiveDeliveryPolicy } = require('../controllers/deliveryPolicyController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/delivery-policy', authenticateToken, upsertDeliveryPolicy);
router.get('/delivery-policy', authenticateToken, getDeliveryPolicy);
router.delete('/delivery-policy', authenticateToken, deleteDeliveryPolicy);
router.get('/delivery-policy/active', getActiveDeliveryPolicy);

module.exports = router;