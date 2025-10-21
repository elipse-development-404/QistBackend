const { validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const getCategories = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    status = "all",
    sort = "name",
    order = "asc",
  } = req.query;
  const offset = (page - 1) * limit;

  try {
    // Filters
    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slugName: { contains: search } },
        { description: { contains: search } },
        { id: isNaN(search) ? undefined : Number(search) },
      ].filter(Boolean);
    }
    if (status === "active") where.isActive = true;
    if (status === "inactive") where.isActive = false;

    // Sorting
    const validSortFields = ["id", "name", "isActive"];
    const sortField = validSortFields.includes(sort) ? sort : "name";
    const sortOrder = order.toLowerCase() === "desc" ? "desc" : "asc";

    // Fetch categories
    const categories = await prisma.categories.findMany({
      where,
      skip: Number(offset),
      take: Number(limit),
      orderBy: { [sortField]: sortOrder },
      include: {
        subcategories: {
          select: { id: true, name: true },
        },
      },
    });

    // Count total
    const totalItems = await prisma.categories.count({ where });

    res.status(200).json({
      data: categories,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
};
const getAllPlainCategory = async (req, res) => {
  
  try {
    // Filters
    

    const categories = await prisma.categories.findMany({
      select:{
        id:true,
        name:true,

      }
    });

    // Count total

    res.status(200).json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
};

const getOnlyTrueCategories = async (req, res) => {
  try {
    const categories = await prisma.categories.findMany({
      where: { isActive: true },
      include: {
        subcategories: {
          where: { isActive: true },
          select: { id: true, name: true, slugName: true },
        },
      },
    });
    res.status(200).json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
};

const getLimitOnlyTrueCategories = async (req, res) => {
  try {
    const categories = await prisma.categories.findMany({
      where: { isActive: true },
      take: 10, // Limits the result to 10 categories
      include: {
        subcategories: {
          where: { isActive: true },
          select: { id: true, name: true, slugName: true },
        },
      },
    });
    res.status(200).json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
};

const getTrueCategories = async (req, res) => {
  try {
    const categories = await prisma.categories.findMany({
      take: 18,
      where: { isActive: true },
    });
    res.status(200).json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
};

const createCategory = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description, isActive = true, icon } = req.body;
  try {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const newCategory = await prisma.categories.create({
      data: {
        name,
        description,
        isActive,
        icon,
        slugName: slug || null,
        meta_title: name || null,
        meta_description: description || null,
        meta_keywords: null,
      },
    });
    res.status(201).json(newCategory);
  } catch (error) {
    console.error('Error creating category:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Category name or slug already exists' });
    }
    res.status(500).json({ error: 'Failed to create category' });
  }
};

const updateCategory = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description, icon, meta_title, meta_description, meta_keywords, slugName } = req.body;
  const { id } = req.params;

  try {
    const category = await prisma.categories.findUnique({ where: { id: Number(id) } });
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }


    const updated = await prisma.categories.update({
      where: { id: Number(id) },
      data: {
        name,
        description,
        icon,
        slugName: slugName || null,
        meta_title: meta_title === '' ? null : meta_title,
        meta_description: meta_description === '' ? null : meta_description,
        meta_keywords: meta_keywords === '' ? null : meta_keywords,
        isActive: category.isActive,
        updated_at: new Date(),
      },
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating category:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Category name or slug already exists' });
    }
    res.status(500).json({ error: 'Failed to update category' });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.categories.delete({ where: { id: Number(id) } });
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Category not found" });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to delete category" });
  }
};

const toggleCategoryActive = async (req, res) => {
  const { id } = req.params;
  try {
    const category = await prisma.categories.findUnique({ where: { id: Number(id) } });
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    const updated = await prisma.categories.update({
      where: { id: Number(id) },
      data: { isActive: !category.isActive },
    });
    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to toggle category status" });
  }
};

const getCategoryBySlug = async (req, res) => {
  const { slugName } = req.params;
  try {
    const category = await prisma.categories.findUnique({
      where: { slugName },
      select: {
        id: true,
        name: true,
        meta_title: true,
        meta_description: true,
        meta_keywords: true,
        icon: true,
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.status(200).json(category);
  } catch (error) {
    console.error('Error fetching category by slug:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
};

module.exports = {
  getCategories,
  getOnlyTrueCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryActive,
  getAllPlainCategory,
  getLimitOnlyTrueCategories,
  getTrueCategories,
  getCategoryBySlug,
};
