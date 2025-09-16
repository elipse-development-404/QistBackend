const express = require('express');
const router = express.Router();
const { signup, verify, resend, login, forgot, reset } = require('../controllers/authCustomerController');
const { getAddresses, addAddress, updateAddress, deleteAddress } = require('../controllers/addressController');
const { updateProfile, changePassword, getOrders } = require('../controllers/customerController');
const { authenticateCustomerToken } = require('../middlewares/authCustomerMiddleware');

router.post('/customer/signup', signup);
router.post('/customer/verify', verify);
router.post('/customer/resend', resend);
router.post('/customer/login', login);
router.post('/customer/forgot', forgot);
router.post('/customer/reset', reset);

router.get('/customer/addresses', authenticateCustomerToken, getAddresses);
router.post('/customer/addresses', authenticateCustomerToken, addAddress);
router.patch('/customer/addresses/:id', authenticateCustomerToken, updateAddress);
router.delete('/customer/addresses/:id', authenticateCustomerToken, deleteAddress);

router.patch('/customer/profile', authenticateCustomerToken, updateProfile);
router.post('/customer/change-password', authenticateCustomerToken, changePassword);

router.get('/customer/orders', authenticateCustomerToken, getOrders);


module.exports = router;