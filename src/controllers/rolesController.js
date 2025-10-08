const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { cloudinary } = require('../Config/cloudinary');
const { validationResult } = require('express-validator');

const prisma = new PrismaClient();

const checkSuperAdmin = (req, res, next) => {
  if (!req.user.isSuper) {
    return res.status(403).json({ error: 'Access denied. Super admin privileges required.' });
  }
  next();
};

const getTotalAdminsCount = async (req, res) => {
  try {
    const totalAdmins = await prisma.admins.count({ where: { isSuper: false } });
    res.status(200).json({ totalAdmins });
  } catch (error) {
    console.error('Get total admins count error:', error);
    res.status(500).json({ error: 'Failed to fetch total admins count' });
  }
};

const getActiveAdminsCount = async (req, res) => {
  try {
    const activeAdmins = await prisma.admins.count({
      where: { isSuper: false, isAdmin: true, isActive: true },
    });
    res.status(200).json({ activeAdmins });
  } catch (error) {
    console.error('Get active admins count error:', error);
    res.status(500).json({ error: 'Failed to fetch active admins count' });
  }
};

const getInactiveAdminsCount = async (req, res) => {
  try {
    const inactiveAdmins = await prisma.admins.count({
      where: { isSuper: false, isAdmin: true, isActive: false },
    });
    res.status(200).json({ inactiveAdmins });
  } catch (error) {
    console.error('Get inactive admins count error:', error);
    res.status(500).json({ error: 'Failed to fetch inactive admins count' });
  }
};

const getAdmins = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  try {
    const admins = await prisma.admins.findMany({
      where: { isSuper: false },
      select: {
        id: true,
        fullName: true,
        email: true,
        isAdmin: true,
        isActive: true,
        isAccess: true,
        profilePicture: true,
        createdAt: true,
        updatedAt: true,
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });

    const totalAdmins = await prisma.admins.count({ where: { isSuper: false } });

    res.status(200).json({
      admins,
      pagination: {
        totalItems: totalAdmins,
        totalPages: Math.ceil(totalAdmins / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
};

const createAdmin = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let formattedData = {};
  if (req.body.formattedData) {
    try {
      formattedData = JSON.parse(req.body.formattedData);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid formattedData' });
    }
  }

  const { fullName, email, password, isAccess } = formattedData;
  const image = req.file;

  if (!fullName || !email || !password || !isAccess) {
    return res.status(400).json({ error: 'Full name, email, password, and access level are required' });
  }

  if (!['LOW', 'MEDIUM', 'HIGH'].includes(isAccess)) {
    return res.status(400).json({ error: 'Invalid access level' });
  }

  try {
    const existingAdmin = await prisma.admins.findUnique({ where: { email } });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let profilePicture = null;
    let cloudinaryId = null;

    if (image) {
      profilePicture = image.path;
      cloudinaryId = image.filename;
    }

    const newAdmin = await prisma.admins.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
        isSuper: false,
        isAdmin: true,
        isActive: true,
        isAccess,
        profilePicture,
        cloudinaryId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        isAdmin: true,
        isActive: true,
        isAccess: true,
        profilePicture: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json({ message: 'Admin created successfully', admin: newAdmin });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Failed to create admin' });
  }
};

const updateAdmin = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let formattedData = {};
  if (req.body.formattedData) {
    try {
      formattedData = JSON.parse(req.body.formattedData);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid formattedData' });
    }
  }

  const { id } = req.params;
  const { fullName, email, password, isAccess, isAdmin, isActive } = formattedData;
  const image = req.file;

  try {
    const admin = await prisma.admins.findUnique({ where: { id: Number(id) } });
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    if (admin.isSuper) {
      return res.status(403).json({ error: 'Cannot modify super admin' });
    }

    let profilePicture = admin.profilePicture;
    let cloudinaryId = admin.cloudinaryId;

    if (image) {
      if (admin.cloudinaryId) {
        await cloudinary.uploader.destroy(admin.cloudinaryId);
      }
      profilePicture = image.path;
      cloudinaryId = image.filename;
    }

    let hashedPassword = admin.password;
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const updatedAdmin = await prisma.admins.update({
      where: { id: Number(id) },
      data: {
        fullName: fullName || admin.fullName,
        email: email || admin.email,
        password: hashedPassword,
        isAccess: isAccess || admin.isAccess,
        isAdmin: isAdmin !== undefined ? isAdmin : admin.isAdmin,
        isActive: isActive !== undefined ? isActive : admin.isActive,
        profilePicture,
        cloudinaryId,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        isAdmin: true,
        isActive: true,
        isAccess: true,
        profilePicture: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({ message: 'Admin updated successfully', admin: updatedAdmin });
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({ error: 'Failed to update admin' });
  }
};

const toggleAdminStatus = async (req, res) => {
  const { id } = req.params;

  try {
    const admin = await prisma.admins.findUnique({ where: { id: Number(id) } });
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    if (admin.isSuper) {
      return res.status(403).json({ error: 'Cannot modify super admin' });
    }

    const updatedAdmin = await prisma.admins.update({
      where: { id: Number(id) },
      data: {
        isActive: !admin.isActive,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        isAdmin: true,
        isActive: true,
        isAccess: true,
        profilePicture: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      message: `Admin ${updatedAdmin.isActive ? 'activated' : 'deactivated'} successfully`,
      admin: updatedAdmin,
    });
  } catch (error) {
    console.error('Toggle admin status error:', error);
    res.status(500).json({ error: 'Failed to toggle admin status' });
  }
};

const deleteAdmin = async (req, res) => {
  const { id } = req.params;

  try {
    const admin = await prisma.admins.findUnique({ where: { id: Number(id) } });
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    if (admin.isSuper) {
      return res.status(403).json({ error: 'Cannot delete super admin' });
    }

    if (admin.cloudinaryId) {
      await cloudinary.uploader.destroy(admin.cloudinaryId);
    }

    await prisma.admins.delete({ where: { id: Number(id) } });
    res.status(200).json({ message: 'Admin deleted successfully' });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({ error: 'Failed to delete admin' });
  }
};

module.exports = {
  checkSuperAdmin,
  getTotalAdminsCount,
  getActiveAdminsCount,
  getInactiveAdminsCount,
  getAdmins,
  createAdmin,
  updateAdmin,
  toggleAdminStatus,
  deleteAdmin,
};