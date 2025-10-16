const { PrismaClient } = require("@prisma/client");
const { validationResult } = require("express-validator");

const prisma = new PrismaClient();

// Get all tags
const getTags = async (req, res) => {
  try {
    const { active } = req.query;
    const where = active === "true" ? { isActive: true } : {};
    const tags = await prisma.tag.findMany({
      where,
      orderBy: { id: "asc" },
    });
    res.status(200).json(tags);
  } catch (error) {
    console.error("Error fetching tags:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

const getAllTagsPagination = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status = "all" } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (search) {
      where.name = { contains: search };
    }
    if (status !== "all") {
      where.isActive = status === "active" ? true : false;
    }

    const [tags, totalItems] = await Promise.all([
      prisma.tag.findMany({
        where,
        skip: Number(skip),
        take: Number(limit),
        orderBy: { id: "asc" },
      }),
      prisma.tag.count({ where }),
    ]);

    res.status(200).json({
      data: tags,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching tags:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Create a new tag
const createTag = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Tag name is required" });
    }

    // Check for duplicate tag name
    const existingTag = await prisma.tag.findUnique({
      where: { name: name.trim() },
    });
    if (existingTag) {
      return res.status(400).json({ message: "Tag name already exists" });
    }

    const tag = await prisma.tag.create({
      data: {
        name: name.trim(),
        isActive: true,
      },
    });
    res.status(201).json(tag);
  } catch (error) {
    console.error("Error creating tag:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Update a tag
const updateTag = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const { name, isActive } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Tag name is required" });
    }

    // Check for duplicate tag name
    const existingTag = await prisma.tag.findFirst({
      where: {
        name: name.trim(),
        id: { not: parseInt(id) },
      },
    });
    if (existingTag) {
      return res.status(400).json({ message: "Tag name already exists" });
    }

    const tag = await prisma.tag.update({
      where: { id: parseInt(id) },
      data: {
        name: name.trim(),
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        updatedAt: new Date(),
      },
    });
    res.status(200).json(tag);
  } catch (error) {
    console.error("Error updating tag:", error);
    if (error.code === "P2025") {
      res.status(404).json({ message: "Tag not found" });
    } else {
      res.status(500).json({ message: "Internal server error", error: error.message });
    }
  }
};

// Toggle tag status
const toggleTagStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (isActive === undefined) {
      return res.status(400).json({ message: "isActive field is required" });
    }

    const tag = await prisma.tag.update({
      where: { id: parseInt(id) },
      data: {
        isActive: Boolean(isActive),
        updatedAt: new Date(),
      },
    });
    res.status(200).json(tag);
  } catch (error) {
    console.error("Error toggling tag status:", error);
    if (error.code === "P2025") {
      res.status(404).json({ message: "Tag not found" });
    } else {
      res.status(500).json({ message: "Internal server error", error: error.message });
    }
  }
};

// Delete a tag
const deleteTag = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if tag is associated with any products
    const productTags = await prisma.productTag.findMany({
      where: { tagId: parseInt(id) },
    });
    if (productTags.length > 0) {
      return res.status(400).json({ message: "Cannot delete tag associated with products" });
    }

    await prisma.tag.delete({
      where: { id: parseInt(id) },
    });
    res.status(200).json({ message: "Tag deleted successfully" });
  } catch (error) {
    console.error("Error deleting tag:", error);
    if (error.code === "P2025") {
      res.status(404).json({ message: "Tag not found" });
    } else {
      res.status(500).json({ message: "Internal server error", error: error.message });
    }
  }
};

module.exports = {
  getTags,
  createTag,
  updateTag,
  toggleTagStatus,
  deleteTag,
  getAllTagsPagination,
};