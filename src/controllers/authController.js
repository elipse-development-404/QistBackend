const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const signup = async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  try {
    // ✅ check if admin exists
    const existingAdmin = await prisma.admins.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      return res.status(400).json({ error: "Admin already exists" });
    }

    // ✅ hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ create new admin
    await prisma.admins.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
        createdAt: new Date(),
      },
    });

    res.status(201).json({ message: "Admin created successfully" });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    // ✅ find admin by email
    const admin = await prisma.admins.findUnique({
      where: { email },
    });

    if (!admin) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // ✅ check password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // ✅ generate JWT
    const token = jwt.sign(
      { adminId: admin.id, email: admin.email },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ token, admin: { fullName: admin.fullName, email: admin.email } });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getDashboard = (req, res) => {
  res.json({ message: "Welcome to the admin dashboard", admin: req.admin });
};

module.exports = { signup, login, getDashboard };
