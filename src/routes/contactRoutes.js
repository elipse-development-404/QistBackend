const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { sendContactEmail } = require('../controllers/contactController');

router.post(
  '/contact',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('message').trim().notEmpty().withMessage('Message is required'),
  ],
  sendContactEmail
);

module.exports = router;