// controllers/bannerController.js
const { validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { cloudinary } = require('../Config/cloudinary');

const prisma = new PrismaClient();

const getBanners = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    status = 'all',
    sort = 'id',
    order = 'desc',
  } = req.query;
  const skip = (page - 1) * limit;
  const take = Number(limit);

  try {
    const where = { AND: [] };

    if (search) {
      where.AND.push({
        OR: [
          { product_url: { contains: search, mode: 'insensitive' } },
          { id: isNaN(search) ? undefined : Number(search) },
        ],
      });
    }

    if (status === 'active') {
      where.AND.push({ isActive: true });
    } else if (status === 'inactive') {
      where.AND.push({ isActive: false });
    }

    const validSortFields = {
      id: 'id',
      product_url: 'product_url',
      isActive: 'isActive',
    };
    const sortField = validSortFields[sort] || 'id';

    const banners = await prisma.banner.findMany({
      where,
      orderBy: { [sortField]: order.toLowerCase() === 'desc' ? 'desc' : 'asc' },
      skip,
      take,
    });

    const totalItems = await prisma.banner.count({ where });

    res.status(200).json({
      data: banners,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
};

const createBanner = async (req, res) => {
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

  const { product_url, isActive = true } = formattedData;
  const image = req.file;

  if (!image) {
    return res.status(400).json({ error: 'Image is required for new banners' });
  }

  try {
    const banner = await prisma.banner.create({
      data: {
        image_url: image.path,
        cloudinary_id: image.filename,
        product_url,
        isActive: Boolean(isActive),
      },
    });

    res.status(201).json(banner);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create banner' });
  }
};

const updateBanner = async (req, res) => {
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

  const { id } = req.params;
  const { product_url } = formattedData;
  const image = req.file;

  try {
    const banner = await prisma.banner.findUnique({
      where: { id: Number(id) },
    });

    if (!banner) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    let image_url = banner.image_url;
    let cloudinary_id = banner.cloudinary_id;

    if (image) {
      // Delete old image from Cloudinary if exists
      if (banner.cloudinary_id) {
        await cloudinary.uploader.destroy(banner.cloudinary_id);
      }
      image_url = image.path;
      cloudinary_id = image.filename;
    }

    const updated = await prisma.banner.update({
      where: { id: Number(id) },
      data: {
        image_url,
        cloudinary_id,
        product_url,
      },
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update banner' });
  }
};

const deleteBanner = async (req, res) => {
  const { id } = req.params;
  try {
    const banner = await prisma.banner.findUnique({
      where: { id: Number(id) },
    });

    if (!banner) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    // Delete image from Cloudinary if exists
    if (banner.cloudinary_id) {
      await cloudinary.uploader.destroy(banner.cloudinary_id);
    }

    await prisma.banner.delete({
      where: { id: Number(id) },
    });
    res.status(200).json({ message: 'Banner deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Banner not found' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to delete banner' });
  }
};

const toggleBannerActive = async (req, res) => {
  const { id } = req.params;
  try {
    const banner = await prisma.banner.findUnique({
      where: { id: Number(id) },
    });

    if (!banner) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    const updated = await prisma.banner.update({
      where: { id: Number(id) },
      data: { isActive: !banner.isActive },
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to toggle banner status' });
  }
};

const getActiveBanners = async (req, res) => {
  try {
    const banners = await prisma.banner.findMany({
      where: { isActive: true },
    });

    res.status(200).json(banners);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch active banners' });
  }
};

module.exports = {
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerActive,
  getActiveBanners,
};