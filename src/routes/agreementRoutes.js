const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const {
  getAgreement,
  updateAgreement,
  deleteImage,
} = require('../controllers/agreementController');

router.get('/agreement', getAgreement);

router.post(
  '/agreement',
  authenticateToken,
  upload.array('images', 10),
  updateAgreement
);

router.delete('/agreement-image/:id', authenticateToken, deleteImage);

module.exports = router;