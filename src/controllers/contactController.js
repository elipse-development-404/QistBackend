const { validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');

const prisma = new PrismaClient();

const sendContactEmail = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, subject, message } = req.body;

  try {
    // Fetch the organization's email from OrganizationSettings
    const settings = await prisma.organizationSettings.findFirst({
      where: { isActive: true },
      select: { email: true },
    });

    if (!settings || !settings.email) {
      return res.status(404).json({ error: 'Organization email not found' });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false, // Use TLS
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Contact Form Submission</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 20px auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          h1, h5 { color: #333; }
          p { color: #555; }
          .message-notice { text-align: center; padding: 20px; background: #e0f7fa; border-radius: 8px; }
          .message-details { margin: 20px 0; }
          .message-details p { margin-bottom: 10px; font-size: 16px; }
          .message-details strong { color: #000; }
          @media (max-width: 600px) { .container { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="message-notice text-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="#007bff" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z"/>
            </svg>
            <p>New Contact Form Submission</p>
          </div>
          <div class="message-details">
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong> ${message}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: settings.email,
      subject: `Contact Form: ${subject}`,
      html: htmlContent,
    });

    res.status(200).json({ message: 'Contact message sent successfully' });
  } catch (error) {
    console.error('Error sending contact email:', error);
    res.status(500).json({ error: 'Failed to send contact message' });
  }
};

module.exports = { sendContactEmail };