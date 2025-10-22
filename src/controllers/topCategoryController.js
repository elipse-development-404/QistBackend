const { validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { cloudinary } = require('../Config/cloudinary');

const prisma = new PrismaClient();

const getTopCategories = async (req, res) => {
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
          { categories: { name: { contains: search } } },
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
      isActive: 'isActive',
    };
    const sortField = validSortFields[sort] || 'id';

    const topCategories = await prisma.topCategory.findMany({
      where,
      orderBy: { [sortField]: order.toLowerCase() === 'desc' ? 'desc' : 'asc' },
      skip,
      take,
      include: {
        categories: {
          select: { id: true, name: true, slugName: true },
        },
      },
    });

    const totalItems = await prisma.topCategory.count({ where });

    const response = topCategories.map(tc => ({
      ...tc,
      category_name: tc.categories?.name || null,
      category_slugName: tc.categories?.slugName || null,
      categories: undefined,
    }));

    res.status(200).json({
      data: response,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch top categories' });
  }
};

const createTopCategory = async (req, res) => {
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

  const { category_id, isActive = true } = formattedData;
  const image = req.file;

  if (!image) {
    return res.status(400).json({ error: 'Image is required for new top categories' });
  }

  if (!category_id) {
    return res.status(400).json({ error: 'Category ID is required' });
  }

  try {
    const topCategory = await prisma.topCategory.create({
      data: {
        category_id: Number(category_id),
        image_url: image.path,
        cloudinary_id: image.filename,
        isActive: Boolean(isActive),
      },
      include: {
        categories: {
          select: { id: true, name: true, slugName: true },
        },
      },
    });

    const response = {
      ...topCategory,
      category_name: topCategory.categories?.name || null,
      category_slugName: topCategory.categories?.slugName || null,
      categories: undefined,
    };

    res.status(201).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create top category' });
  }
};

const updateTopCategory = async (req, res) => {
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
  const { category_id } = formattedData;
  const image = req.file;

  if (!category_id) {
    return res.status(400).json({ error: 'Category ID is required' });
  }

  try {
    const topCategory = await prisma.topCategory.findUnique({
      where: { id: Number(id) },
    });

    if (!topCategory) {
      return res.status(404).json({ error: 'Top category not found' });
    }

    let image_url = topCategory.image_url;
    let cloudinary_id = topCategory.cloudinary_id;

    if (image) {
      if (topCategory.cloudinary_id) {
        await cloudinary.uploader.destroy(topCategory.cloudinary_id);
      }
      image_url = image.path;
      cloudinary_id = image.filename;
    }

    const updated = await prisma.topCategory.update({
      where: { id: Number(id) },
      data: {
        category_id: Number(category_id),
        image_url,
        cloudinary_id,
      },
      include: {
        categories: {
          select: { id: true, name: true, slugName: true },
        },
      },
    });

    const response = {
      ...updated,
      category_name: updated.categories?.name || null,
      category_slugName: updated.categories?.slugName || null,
      categories: undefined,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update top category' });
  }
};

const deleteTopCategory = async (req, res) => {
  const { id } = req.params;
  try {
    const topCategory = await prisma.topCategory.findUnique({
      where: { id: Number(id) },
    });

    if (!topCategory) {
      return res.status(404).json({ error: 'Top category not found' });
    }

    if (topCategory.cloudinary_id) {
      await cloudinary.uploader.destroy(topCategory.cloudinary_id);
    }

    await prisma.topCategory.delete({
      where: { id: Number(id) },
    });
    res.status(200).json({ message: 'Top category deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Top category not found' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to delete top category' });
  }
};

const toggleTopCategoryActive = async (req, res) => {
  const { id } = req.params;
  try {
    const topCategory = await prisma.topCategory.findUnique({
      where: { id: Number(id) },
    });

    if (!topCategory) {
      return res.status(404).json({ error: 'Top category not found' });
    }

    const updated = await prisma.topCategory.update({
      where: { id: Number(id) },
      data: { isActive: !topCategory.isActive },
      include: {
        categories: {
          select: { id: true, name: true, slugName: true },
        },
      },
    });

    const response = {
      ...updated,
      category_name: updated.categories?.name || null,
      category_slugName: updated.categories?.slugName || null,
      categories: undefined,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to toggle top category status' });
  }
};

const getActiveTopCategories = async (req, res) => {
  try {
    const topCategories = await prisma.topCategory.findMany({
      where: { isActive: true },
      include: {
        categories: {
          select: {
            id: true,
            name: true,
            slugName: true,
            Product: {
              where: {
                status: true,
              },
              take: 10,
              orderBy: { id: 'desc' }, // Sort products by id in descending order to show the latest products first
              include: {
                ProductImage: {
                  take: 1,
                  orderBy: { id: 'asc' },
                },
                ProductInstallments: {
                  where: { isActive: true },
                  orderBy: { id: 'desc' },
                  take: 1,
                },
                subcategories: {
                  select: { id: true, name: true, slugName: true },
                },
              },
            },
          },
        },
      },
    });

    const response = topCategories.map(tc => ({
      ...tc,
      category_name: tc.categories?.name || null,
      slugName: tc.categories?.slugName || null,
      products: tc.categories?.Product.map(p => ({
        id: p.id,
        name: p.name,
        slugName: p.slugName,
        category_name: tc.categories?.name || null,
        categories_SlugName: tc.categories?.slugName || null,
        subcategory_name: p.subcategories?.name || null,
        subcategory_SlugName: p.subcategories?.slugName || null,
        advance: p.ProductInstallments[0]?.advance || 0, // Fixed typo from '进' to 'advance'
        image_url: p.ProductImage[0]?.url || null,
        isDeal: p.isDeal,
      })) || [],
      categories: undefined,
    }));

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch active top categories' });
  }
};

module.exports = {
  getTopCategories,
  createTopCategory,
  updateTopCategory,
  deleteTopCategory,
  toggleTopCategoryActive,
  getActiveTopCategories,
};