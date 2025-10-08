const express = require('express');
const { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } = require('../controllers/notificationsController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const router = express.Router();

router.get('/notifications', authenticateToken, getNotifications);
router.put('/notifications/:id/read', authenticateToken, markNotificationAsRead);
router.put('/notifications/mark-all-read', authenticateToken, markAllNotificationsAsRead);

module.exports = router;