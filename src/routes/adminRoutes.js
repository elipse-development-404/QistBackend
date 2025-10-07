const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { getAdminProfile, updateAdminProfile, deleteProfilePicture } = require('../controllers/adminController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
router.get('/admin/profile', authenticateToken, getAdminProfile);

router.put(
  '/admin/profile',
  authenticateToken,
  upload.single('image'),
  [
    check('formattedData').custom((value) => {
      try {
        const data = JSON.parse(value);
        if (data.fullName && typeof data.fullName !== 'string') {
          throw new Error('Full name must be a string');
        }
        if (data.password && typeof data.password !== 'string') {
          throw new Error('Password must be a string');
        }
        return true;
      } catch (err) {
        throw new Error('Invalid formattedData');
      }
    }),
  ],
  updateAdminProfile
);

router.delete('/admin/profile/picture', authenticateToken, deleteProfilePicture);

module.exports = router;