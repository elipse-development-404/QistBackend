const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticateToken } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const {
  getOrganizationSettings,
  createOrganizationSettings,
  updateOrganizationSettings,
  deleteOrganizationSettings,
  toggleOrganizationSettingsActive,
  getActiveOrganizationSettings,
  getOrganizationSettingsById,
} = require('../controllers/organizationSettingsController');

router.get('/organization-settings', authenticateToken, getOrganizationSettings);

router.post(
  '/organization-settings',
  authenticateToken,
  upload.single('logo'),
  [
    body('formattedData').custom((value) => {
      try {
        const data = JSON.parse(value);
        if (!data.name) throw new Error('Organization name is required');
        if (data.socialLinks && !Array.isArray(data.socialLinks)) throw new Error('Social links must be an array');
        return true;
      } catch {
        throw new Error('Invalid formattedData');
      }
    }),
  ],
  createOrganizationSettings
);

router.put(
  '/organization-settings/:id',
  authenticateToken,
  upload.single('logo'),
  [
    body('formattedData').custom((value) => {
      try {
        const data = JSON.parse(value);
        if (!data.name) throw new Error('Organization name is required');
        if (data.socialLinks && !Array.isArray(data.socialLinks)) throw new Error('Social links must be an array');
        return true;
      } catch {
        throw new Error('Invalid formattedData');
      }
    }),
  ],
  updateOrganizationSettings
);

router.patch('/organization-settings/:id/toggle', authenticateToken, toggleOrganizationSettingsActive);

router.delete('/organization-settings/:id', authenticateToken, deleteOrganizationSettings);

router.get('/active-organization-settings', getActiveOrganizationSettings);

router.get('/organization-settings/:id', authenticateToken, getOrganizationSettingsById);

module.exports = router;