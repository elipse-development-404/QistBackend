const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const {
  checkSuperAdmin,
  getTotalAdminsCount,
  getActiveAdminsCount,
  getInactiveAdminsCount,
  getAdmins,
  createAdmin,
  updateAdmin,
  toggleAdminStatus,
  deleteAdmin,
} = require('../controllers/rolesController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.get('/admins/count/total', authenticateToken, checkSuperAdmin, getTotalAdminsCount);
router.get('/admins/count/active', authenticateToken, checkSuperAdmin, getActiveAdminsCount);
router.get('/admins/count/inactive', authenticateToken, checkSuperAdmin, getInactiveAdminsCount);
router.get('/admins', authenticateToken, checkSuperAdmin, getAdmins);

router.post(
  '/admins',
  authenticateToken,
  checkSuperAdmin,
  upload.single('image'),
  [
    check('formattedData').custom((value) => {
      try {
        const data = JSON.parse(value);
        if (data.fullName && typeof data.fullName !== 'string') {
          throw new Error('Full name must be a string');
        }
        if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
          throw new Error('Invalid email format');
        }
        if (data.password && data.password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        if (data.isAccess && !['LOW', 'MEDIUM', 'HIGH'].includes(data.isAccess)) {
          throw new Error('Invalid access level');
        }
        return true;
      } catch (err) {
        throw new Error('Invalid formattedData');
      }
    }),
  ],
  createAdmin
);

router.put(
  '/admins/:id',
  authenticateToken,
  checkSuperAdmin,
  upload.single('image'),
  [
    check('formattedData').custom((value) => {
      try {
        const data = JSON.parse(value);
        if (data.fullName && typeof data.fullName !== 'string') {
          throw new Error('Full name must be a string');
        }
        if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
          throw new Error('Invalid email format');
        }
        if (data.password && data.password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        if (data.isAccess && !['LOW', 'MEDIUM', 'HIGH'].includes(data.isAccess)) {
          throw new Error('Invalid access level');
        }
        return true;
      } catch (err) {
        throw new Error('Invalid formattedData');
      }
    }),
  ],
  updateAdmin
);

router.put('/admins/:id/toggle-active', authenticateToken, checkSuperAdmin, toggleAdminStatus);
router.delete('/admins/:id', authenticateToken, checkSuperAdmin, deleteAdmin);

module.exports = router;