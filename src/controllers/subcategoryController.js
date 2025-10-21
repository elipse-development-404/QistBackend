const { validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const getSubcategories = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    status = "all",
    sort = "name",
    order = "asc",
  } = req.query;
  const skip = (page - 1) * limit;
  const take = Number(limit);

  try {
    const where = {
      AND: [],
    };

    if (search) {
      where.AND.push({
        OR: [
          { name: { contains: search } },
          { slugName: { contains: search } },
          { categories: { name: { contains: search } } },
          { id: isNaN(search) ? undefined : Number(search) },
        ],
      });
    }

    if (status === "active") {
      where.AND.push({ isActive: true });
    } else if (status === "inactive") {
      where.AND.push({ isActive: false });
    }

    const validSortFields = {
      id: "id",
      name: "name",
      "c.name": "categories.name",
      isActive: "isActive",
    };
    const sortField = validSortFields[sort] || "name";

    const subcategories = await prisma.subcategories.findMany({
      where,
      include: {
        categories: { select: { name: true } },
      },
      orderBy: { [sortField]: order.toLowerCase() === "desc" ? "desc" : "asc" },
      skip,
      take,
    });

    const formatted = subcategories.map((sc) => ({
      ...sc,
      category_name: sc.categories?.name || null,
      categories: undefined,
    }));

    const totalItems = await prisma.subcategories.count({ where });

    res.status(200).json({
      data: formatted,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch subcategories" });
  }
};

const getSubcategoriesByCategory = async (req, res) => {
  const id = req.params.id;

  try {
    const subcategories = await prisma.subcategories.findMany({
      where: { category_id: parseInt(id) },
      select: {
        id: true,
        name: true,
      },
    });

    res.status(200).json(subcategories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch subcategories" });
  }
};

const createSubcategory = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, category_id, description, isActive = true, meta_title, meta_description, meta_keywords, slugName } = req.body;

  try {
    // Check if category exists
    const category = await prisma.categories.findFirst({
      where: { id: Number(category_id) },
    });
    if (!category) {
      return res.status(400).json({ error: "Invalid category ID" });
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const subcategory = await prisma.subcategories.create({
      data: {
        name,
        description: description || null,
        isActive,
        categories: { connect: { id: Number(category_id) } },
        slugName: slug || null,
        meta_title: meta_title || null,
        meta_description: meta_description || null,
        meta_keywords: meta_keywords || null,
      },
    });

    res.status(201).json(subcategory);
  } catch (error) {
    console.error('Error creating subcategory:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Subcategory name or slug already exists for this category' });
    }
    res.status(500).json({ error: "Failed to create subcategory" });
  }
};

const updateSubcategory = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { name, category_id, description, meta_title, meta_description, meta_keywords, slugName } = req.body;

  try {
    const subcategory = await prisma.subcategories.findUnique({
      where: { id: Number(id) },
    });

    if (!subcategory) {
      return res.status(404).json({ error: "Subcategory not found" });
    }

    // Check if category exists
    const category = await prisma.categories.findFirst({
      where: { id: Number(category_id) },
    });
    if (!category) {
      return res.status(400).json({ error: "Invalid category ID" });
    }

    const updated = await prisma.subcategories.update({
      where: { id: Number(id) },
      data: {
        name,
        description: description || null,
        categories: { connect: { id: Number(category_id) } },
        slugName: slugName || null,
        meta_title: meta_title === '' ? null : meta_title,
        meta_description: meta_description === '' ? null : meta_description,
        meta_keywords: meta_keywords === '' ? null : meta_keywords,
        isActive: subcategory.isActive,
        updated_at: new Date(),
      },
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating subcategory:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Subcategory name or slug already exists for this category' });
    }
    res.status(500).json({ error: "Failed to update subcategory" });
  }
};

const deleteSubcategory = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.subcategories.delete({
      where: { id: Number(id) },
    });
    res.status(200).json({ message: "Subcategory deleted successfully" });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Subcategory not found" });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to delete subcategory" });
  }
};

const toggleSubcategoryActive = async (req, res) => {
  const { id } = req.params;
  try {
    const subcategory = await prisma.subcategories.findUnique({
      where: { id: Number(id) },
    });

    if (!subcategory) {
      return res.status(404).json({ error: "Subcategory not found" });
    }

    const updated = await prisma.subcategories.update({
      where: { id: Number(id) },
      data: { isActive: !subcategory.isActive },
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to toggle subcategory status" });
  }
};

const getOnlyTrueSubCategories = async (req, res) => {
  try {
    const categories = await prisma.subcategories.findMany({
      where: { isActive: true },
    });
    res.status(200).json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch subcategories" });
  }
};

const getSubcategoryBySlug = async (req, res) => {
  const { slugName } = req.params;
  const { categorySlug } = req.query;

  try {
    const where = { slugName };
    if (categorySlug) {
      where.categories = { slugName: categorySlug };
    }

    const subcategory = await prisma.subcategories.findFirst({
      where,
      select: {
        id: true,
        name: true,
        meta_title: true,
        meta_description: true,
        meta_keywords: true,
        categories: {
          select: {
            name: true,
            slugName: true,
          },
        },
      },
    });

    if (!subcategory) {
      return res.status(404).json({ error: 'Subcategory not found' });
    }

    res.status(200).json({
      id: subcategory.id,
      name: subcategory.name,
      meta_title: subcategory.meta_title,
      meta_description: subcategory.meta_description,
      meta_keywords: subcategory.meta_keywords,
      category_name: subcategory.categories?.name || null,
    });
  } catch (error) {
    console.error('Error fetching subcategory by slug:', error);
    res.status(500).json({ error: 'Failed to fetch subcategory' });
  }
};

module.exports = {
  getSubcategories,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  toggleSubcategoryActive,
  getSubcategoriesByCategory,
  getOnlyTrueSubCategories,
  getSubcategoryBySlug,
};