const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendVerificationEmail = async (email, code) => {
  const mailOptions = {
    from: FROM_EMAIL,
    to: email,
    subject: 'Verification Code',
    text: `Your verification code is: ${code}. It expires in 10 minutes.`,
  };
  await transporter.sendMail(mailOptions);
};

const signup = async (req, res) => {
  const { firstName, lastName, email, cnic, phone, password, confirmPassword } = req.body;

  if (!firstName || !lastName || !email || !cnic || !phone || !password || !confirmPassword) {
    return res.status(400).json({ error: "All fields are required" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  if (!/^\d{13}$/.test(cnic)) {
    return res.status(400).json({ error: "Invalid CNIC format. Must be a 13-digit number" });
  }

  if (!/^\+?\d{11}$/.test(phone)) {
    return res.status(400).json({ error: "Invalid phone number format" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  try {
    const existingCustomer = await prisma.customers.findFirst({
      where: {
        OR: [{ email }, { phone }, { cnic }],
      },
    });

    if (existingCustomer) {
      if (existingCustomer.email === email) {
        return res.status(400).json({ error: "Email is already in use" });
      }
      if (existingCustomer.phone === phone) {
        return res.status(400).json({ error: "Phone number is already in use" });
      }
      if (existingCustomer.cnic === cnic) {
        return res.status(400).json({ error: "CNIC is already in use" });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const customer = await prisma.customers.create({
      data: {
        firstName,
        lastName,
        email,
        cnic,
        phone,
        password: hashedPassword,
        createdAt: new Date(),
      },
    });

    const existingOrders = await prisma.createOrder.findMany({
      where: {
        customerId: null,
        OR: [{ email }, { phone }, { cnic }],
      },
    });

    if (existingOrders.length > 0) {
      await prisma.createOrder.updateMany({
        where: {
          id: { in: existingOrders.map((o) => o.id) },
        },
        data: { customerId: customer.id },
      });
    }

    const code = generateCode();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.verificationCode.create({
      data: {
        customerId: customer.id,
        code,
        expiry,
        isForReset: false,
      },
    });

    await sendVerificationEmail(email, code);

    res.status(201).json({
      customer,
      message: "Signup successful. Verification code sent to email.",
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const verify = async (req, res) => {
  const { email, code, isForReset = false } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  try {
    const customer = await prisma.customers.findUnique({ where: { email } });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const verification = await prisma.verificationCode.findFirst({
      where: {
        customerId: customer.id,
        isForReset,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification || verification.code !== code || new Date() > verification.expiry) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    if (!isForReset) {
      await prisma.customers.update({
        where: { id: customer.id },
        data: { isVerified: true },
      });
      await prisma.verificationCode.delete({ where: { id: verification.id } });
    }

    res.json({ message: isForReset ? 'Code verified. Proceed to reset password.' : 'Email verified successfully.' });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const resend = async (req, res) => {
  const { email, isForReset = false } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const customer = await prisma.customers.findUnique({ where: { email } });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const latestVerification = await prisma.verificationCode.findFirst({
      where: {
        customerId: customer.id,
        isForReset,
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    if (latestVerification) {
      if (latestVerification.resendCount >= 5) {
        const lockTime = new Date(latestVerification.lastResend.getTime() + 24 * 60 * 60 * 1000);
        if (now < lockTime) {
          return res.status(429).json({ error: 'Resend limit exceeded. Try again after 24 hours.' });
        }
        // Reset count after 24 hours
        await prisma.verificationCode.update({
          where: { id: latestVerification.id },
          data: { resendCount: 0, lastResend: null },
        });
      }
    }

    const code = generateCode();
    const expiry = new Date(now.getTime() + 10 * 60 * 1000);

    await prisma.verificationCode.upsert({
      where: { id: latestVerification?.id || 0 },
      update: {
        code,
        expiry,
        resendCount: { increment: 1 },
        lastResend: now,
      },
      create: {
        customerId: customer.id,
        code,
        expiry,
        isForReset,
        resendCount: 1,
        lastResend: now,
      },
    });

    await sendVerificationEmail(email, code);

    res.json({ message: 'Verification code resent successfully.' });
  } catch (error) {
    console.error('Resend error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const login = async (req, res) => {
  const { email, password, rememberMe = false } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const customer = await prisma.customers.findUnique({ where: { email } });
    if (!customer) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, customer.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!customer.isActive) {
      return res.status(403).json({ error: "Account is disabled. Please contact the administrator." });
    }

    if (!customer.isVerified) {
      return res.status(403).json({ error: "Email not verified", requiresVerification: true });
    }

    const existingOrders = await prisma.createOrder.findMany({
      where: {
        customerId: null,
        OR: [
          { email: customer.email },
          { phone: customer.phone },
          { cnic: customer.cnic },
        ],
      },
    });

    if (existingOrders.length > 0) {
      await prisma.createOrder.updateMany({
        where: {
          id: { in: existingOrders.map((o) => o.id) },
        },
        data: { customerId: customer.id },
      });
    }

    const expiry = rememberMe ? "30d" : "7d";
    const token = jwt.sign(
      {
        customerId: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        cnic: customer.cnic,
      },
      JWT_SECRET,
      { expiresIn: expiry }
    );

    res.json({
      token,
      customer: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        cnic: customer.cnic,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const forgot = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const customer = await prisma.customers.findUnique({ where: { email } });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Check reset attempts in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const resetAttempts = await prisma.passwordResetAttempt.count({
      where: {
        customerId: customer.id,
        createdAt: { gte: oneDayAgo },
      },
    });

    if (resetAttempts >= 5) {
      return res.status(429).json({
        error: 'Password reset request limit reached. You can only request a password reset 5 times per day. Please try again tomorrow.',
      });
    }

    // Record the reset attempt
    await prisma.passwordResetAttempt.create({
      data: {
        customerId: customer.id,
      },
    });

    const code = generateCode();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.verificationCode.create({
      data: {
        customerId: customer.id,
        code,
        isForReset: true,
        expiry,
      },
    });

    await sendVerificationEmail(email, code);

    res.json({ message: 'Reset code sent to email.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const reset = async (req, res) => {
  const { email, code, newPassword, confirmNewPassword } = req.body;

  if (!email || !code || !newPassword || !confirmNewPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const customer = await prisma.customers.findUnique({ where: { email } });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const verification = await prisma.verificationCode.findFirst({
      where: {
        customerId: customer.id,
        isForReset: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification || verification.code !== code || new Date() > verification.expiry) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.customers.update({
      where: { id: customer.id },
      data: { password: hashedPassword },
    });

    await prisma.verificationCode.delete({ where: { id: verification.id } });

    res.json({ message: 'Password reset successfully.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { signup, verify, resend, login, forgot, reset };