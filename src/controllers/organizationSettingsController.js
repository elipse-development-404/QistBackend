const { validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { cloudinary } = require('../Config/cloudinary');

const prisma = new PrismaClient();

const getOrganizationSettings = async (req, res) => {
  try {
    const item = await prisma.organizationSettings.findFirst({
      include: { socialLinks: true },
    });

    res.status(200).json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch organization settings' });
  }
};

const createOrganizationSettings = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Check if settings already exist
  const existingSettings = await prisma.organizationSettings.findFirst();
  if (existingSettings) {
    return res.status(400).json({ error: 'Organization settings already exist. Only one instance is allowed.' });
  }

  let formattedData = {};
  if (req.body.formattedData) {
    try {
      formattedData = JSON.parse(req.body.formattedData);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid formattedData' });
    }
  }

  const { name, email, phone, address, map_iframe, socialLinks = [], isActive = true } = formattedData;
  const logo = req.file;

  try {
    let logo_url = null;
    let cloudinary_id = null;

    if (logo) {
      logo_url = logo.path;
      cloudinary_id = logo.filename;
    }

    const item = await prisma.organizationSettings.create({
      data: {
        name,
        logo_url,
        cloudinary_id,
        email,
        phone,
        address,
        map_iframe,
        isActive: Boolean(isActive),
        socialLinks: {
          create: socialLinks.map((link) => ({
            url: link.url,
            svg: link.svg,
          })),
        },
      },
      include: { socialLinks: true },
    });

    res.status(201).json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create organization settings' });
  }
};

const updateOrganizationSettings = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;

  let formattedData = {};
  if (req.body.formattedData) {
    try {
      formattedData = JSON.parse(req.body.formattedData);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid formattedData' });
    }
  }

  const { name, email, phone, address, map_iframe, socialLinks = [] } = formattedData;
  const logo = req.file;

  try {
    const item = await prisma.organizationSettings.findUnique({
      where: { id: Number(id) },
      include: { socialLinks: true },
    });

    if (!item) {
      return res.status(404).json({ error: 'Organization settings not found' });
    }

    let logo_url = item.logo_url;
    let cloudinary_id = item.cloudinary_id;

    if (logo) {
      if (item.cloudinary_id) {
        await cloudinary.uploader.destroy(item.cloudinary_id);
      }
      logo_url = logo.path;
      cloudinary_id = logo.filename;
    }

    await prisma.organizationSocialLink.deleteMany({
      where: { settingsId: Number(id) },
    });

    const updated = await prisma.organizationSettings.update({
      where: { id: Number(id) },
      data: {
        name,
        logo_url,
        cloudinary_id,
        email,
        phone,
        address,
        map_iframe,
        socialLinks: {
          create: socialLinks.map((link) => ({
            url: link.url,
            svg: link.svg,
          })),
        },
      },
      include: { socialLinks: true },
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update organization settings' });
  }
};

const deleteOrganizationSettings = async (req, res) => {
  const { id } = req.params;
  try {
    const item = await prisma.organizationSettings.findUnique({
      where: { id: Number(id) },
    });

    if (!item) {
      return res.status(404).json({ error: 'Organization settings not found' });
    }

    if (item.cloudinary_id) {
      await cloudinary.uploader.destroy(item.cloudinary_id);
    }

    await prisma.organizationSettings.delete({
      where: { id: Number(id) },
    });
    res.status(200).json({ message: 'Organization settings deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Organization settings not found' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to delete organization settings' });
  }
};

const toggleOrganizationSettingsActive = async (req, res) => {
  const { id } = req.params;
  try {
    const item = await prisma.organizationSettings.findUnique({
      where: { id: Number(id) },
    });

    if (!item) {
      return res.status(404).json({ error: 'Organization settings not found' });
    }

    const updated = await prisma.organizationSettings.update({
      where: { id: Number(id) },
      data: { isActive: !item.isActive },
      include: { socialLinks: true },
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to toggle organization settings status' });
  }
};

const getActiveOrganizationSettings = async (req, res) => {
  try {
    const item = await prisma.organizationSettings.findFirst({
      where: { isActive: true },
      include: {
        socialLinks: true,
        pages: {
          where: { isActive: true },
          select: {
            category: true,
            slug: true,
            title: true,
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'No active organization settings found' });
    }

    res.status(200).json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch active organization settings' });
  }
};

const getOrganizationSettingsById = async (req, res) => {
  const { id } = req.params;
  try {
    const item = await prisma.organizationSettings.findUnique({
      where: { id: Number(id) },
      include: { socialLinks: true },
    });
    if (!item) {
      return res.status(404).json({ error: 'Organization settings not found' });
    }
    res.status(200).json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch organization settings' });
  }
};

module.exports = {
  getOrganizationSettings,
  createOrganizationSettings,
  updateOrganizationSettings,
  deleteOrganizationSettings,
  toggleOrganizationSettingsActive,
  getActiveOrganizationSettings,
  getOrganizationSettingsById,
};