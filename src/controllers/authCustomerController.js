const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const WATI_ACCESS_TOKEN = process.env.WATI_ACCESS_TOKEN;
const WATI_TEMPLATE_NAME = process.env.WATI_TEMPLATE_NAME;
const WATI_BROADCAST_NAME = process.env.WATI_BROADCAST_NAME;
const WATI_BASE_URL = process.env.WATI_BASE_URL;

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendVerificationWhatsApp = async (phone, code) => {
  let waPhone = phone;
  if (waPhone.startsWith('0')) {
    waPhone = '92' + waPhone.slice(1);
  } else if (waPhone.startsWith('+92')) {
    waPhone = waPhone.slice(1);
  } else if (!waPhone.startsWith('92')) {
    throw new Error('Invalid phone format for WhatsApp');
  }

  const url = `${WATI_BASE_URL}/api/v1/sendTemplateMessage?whatsappNumber=${waPhone}`;
  const body = {
    template_name: WATI_TEMPLATE_NAME,
    broadcast_name: WATI_BROADCAST_NAME,
    parameters: [{ name: '1', value: code }]
  };

  await axios.post(url, body, {
    headers: {
      'Authorization': `Bearer ${WATI_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
};

const signup = async (req, res) => {
  const { firstName, lastName, email, cnic, phone, password, confirmPassword } = req.body;

  if (!firstName || !lastName || !cnic || !phone || !password || !confirmPassword) {
    return res.status(400).json({ error: "Required fields are missing" });
  }

  if (email && !isValidEmail(email)) {
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
    const whereClause = { OR: [{ phone }, { cnic }] };
    if (email) whereClause.OR.push({ email });

    const existingCustomer = await prisma.customers.findFirst({ where: whereClause });

    if (existingCustomer) {
      if (existingCustomer.password) {
        if (email && existingCustomer.email === email) {
          return res.status(400).json({ error: "Email is already in use" });
        }
        if (existingCustomer.phone === phone) {
          return res.status(400).json({ error: "Phone number is already in use" });
        }
        if (existingCustomer.cnic === cnic) {
          return res.status(400).json({ error: "CNIC is already in use" });
        }
      } else {
        // Guest-verified customer: Update with details
        const hashedPassword = await bcrypt.hash(password, 10);
        const updatedCustomer = await prisma.customers.update({
          where: { id: existingCustomer.id },
          data: {
            firstName,
            lastName,
            email: email || null,
            cnic,
            password: hashedPassword,
          },
        });
        return res.status(200).json({ customer: updatedCustomer, message: "Account updated successfully." });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const customer = await prisma.customers.create({
      data: {
        firstName,
        lastName,
        email: email || null,
        cnic,
        phone,
        password: hashedPassword,
        createdAt: new Date(),
      },
    });

    const existingOrdersWhere = { customerId: null, OR: [{ phone }, { cnic }] };
    if (email) existingOrdersWhere.OR.push({ email });

    const existingOrders = await prisma.createOrder.findMany({ where: existingOrdersWhere });

    if (existingOrders.length > 0) {
      await prisma.createOrder.updateMany({
        where: { id: { in: existingOrders.map((o) => o.id) } },
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

    await sendVerificationWhatsApp(phone, code);

    res.status(201).json({
      customer,
      message: "Signup successful. Verification code sent to WhatsApp.",
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const verify = async (req, res) => {
  const { identifier, code, isForReset = false } = req.body;

  if (!identifier || !code) {
    return res.status(400).json({ error: 'Identifier and code are required' });
  }

  try {
    const customer = await prisma.customers.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });
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

    res.json({ message: isForReset ? 'Code verified. Proceed to reset password.' : 'Phone verified successfully.' });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const resend = async (req, res) => {
  const { identifier, isForReset = false } = req.body;

  if (!identifier) {
    return res.status(400).json({ error: 'Identifier is required' });
  }

  try {
    const customer = await prisma.customers.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });
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

    await sendVerificationWhatsApp(customer.phone, code);

    res.json({ message: 'Verification code resent successfully.' });
  } catch (error) {
    console.error('Resend error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const login = async (req, res) => {
  const { identifier, password, rememberMe = false } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: "Identifier and password are required" });
  }

  try {
    const customer = await prisma.customers.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });
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
      return res.status(403).json({ error: "Phone not verified", requiresVerification: true });
    }

    const existingOrdersWhere = { customerId: null, OR: [{ phone: customer.phone }, { cnic: customer.cnic }] };
    if (customer.email) existingOrdersWhere.OR.push({ email: customer.email });

    const existingOrders = await prisma.createOrder.findMany({ where: existingOrdersWhere });

    if (existingOrders.length > 0) {
      await prisma.createOrder.updateMany({
        where: { id: { in: existingOrders.map((o) => o.id) } },
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
        alternativePhone: customer.alternativePhone,
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
        alternativePhone: customer.alternativePhone,
        cnic: customer.cnic,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const forgot = async (req, res) => {
  const { identifier } = req.body;

  if (!identifier) {
    return res.status(400).json({ error: 'Identifier is required' });
  }

  try {
    const customer = await prisma.customers.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

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

    await sendVerificationWhatsApp(customer.phone, code);

    res.json({ message: 'Reset code sent to WhatsApp.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const reset = async (req, res) => {
  const { identifier, code, newPassword, confirmNewPassword } = req.body;

  if (!identifier || !code || !newPassword || !confirmNewPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const customer = await prisma.customers.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });
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