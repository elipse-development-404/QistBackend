const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { cloudinary } = require('../Config/cloudinary');

const prisma = new PrismaClient();

const getAdminProfile = async (req, res) => {
  const adminId = req.user.adminId;

  try {
    const admin = await prisma.admins.findUnique({
      where: { id: Number(adminId) },
      select: {
        id: true,
        fullName: true,
        email: true,
        profilePicture: true,
        isSuper: true,
        isAdmin: true,
        isAccess: true,
      },
    });

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    res.status(200).json({ admin });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

const updateAdminProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let formattedData = {};
  if (req.body.formattedData) {
    try {
      formattedData = JSON.parse(req.body.formattedData);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid formattedData' });
    }
  }

  const { fullName, password } = formattedData;
  const image = req.file;
  const adminId = req.user.adminId;

  try {
    const admin = await prisma.admins.findUnique({
      where: { id: Number(adminId) },
    });

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
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
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const updatedAdmin = await prisma.admins.update({
      where: { id: Number(adminId) },
      data: {
        fullName: fullName || admin.fullName,
        password: hashedPassword,
        profilePicture,
        cloudinaryId,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        profilePicture: true,
        isSuper: true,
        isAdmin: true,
        isAccess: true,
      },
    });

    const token = jwt.sign(
      {
        adminId: updatedAdmin.id,
        fullName: updatedAdmin.fullName,
        email: updatedAdmin.email,
        profilePicture: updatedAdmin.profilePicture,
        isSuper: updatedAdmin.isSuper,
        isAdmin: updatedAdmin.isAdmin,
        isAccess: updatedAdmin.isAccess,
      },
      process.env.JWT_SECRET,
    );

    res.status(200).json({ message: 'Profile updated successfully', admin: updatedAdmin, token });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

const deleteProfilePicture = async (req, res) => {
  const adminId = req.user.adminId;

  try {
    const admin = await prisma.admins.findUnique({
      where: { id: Number(adminId) },
    });

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    if (!admin.profilePicture || !admin.cloudinaryId) {
      return res.status(400).json({ error: 'No profile picture to delete' });
    }

    await cloudinary.uploader.destroy(admin.cloudinaryId);

    const updatedAdmin = await prisma.admins.update({
      where: { id: Number(adminId) },
      data: {
        profilePicture: null,
        cloudinaryId: null,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        profilePicture: true,
        isSuper: true,
        isAdmin: true,
        isAccess: true,
      },
    });

    const token = jwt.sign(
      {
        adminId: updatedAdmin.id,
        fullName: updatedAdmin.fullName,
        email: updatedAdmin.email,
        profilePicture: updatedAdmin.profilePicture,
        isSuper: updatedAdmin.isSuper,
        isAdmin: updatedAdmin.isAdmin,
        isAccess: updatedAdmin.isAccess,
      },
      process.env.JWT_SECRET,
    );

    res.status(200).json({ message: 'Profile picture deleted successfully', admin: updatedAdmin, token });
  } catch (error) {
    console.error('Delete profile picture error:', error);
    res.status(500).json({ error: 'Failed to delete profile picture' });
  }
};

module.exports = {
  getAdminProfile,
  updateAdminProfile,
  deleteProfilePicture,
};