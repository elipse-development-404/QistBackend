const { validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const getVisitUs = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    status = 'all',
    sort = 'id',
    order = 'asc',
  } = req.query;

  // Validate inputs
  const pageNum = Number(page);
  const limitNum = Number(limit);
  if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
    return res.status(400).json({ error: 'Invalid page or limit parameters' });
  }
  const skip = (pageNum - 1) * limitNum;
  const take = limitNum;

  try {
    // Filters
    const where = {};
    if (search || status !== 'all') {
      where.AND = [];
    }

    if (search) {
      const orConditions = [
        { title: { contains: search } }, // Add mode: 'insensitive' for PostgreSQL/MySQL
        { maps: { some: { address: { contains: search } } } },
      ];

      if (!isNaN(search)) {
        orConditions.push({ id: Number(search) });
      }

      where.AND.push({ OR: orConditions });
    }

    if (status === 'active') {
      where.AND.push({ isActive: true });
    } else if (status === 'inactive') {
      where.AND.push({ isActive: false });
    }

    // Sorting
    const validSortFields = {
      id: 'id',
      title: 'title',
      isActive: 'isActive',
    };
    const sortField = validSortFields[sort] || 'id';
    const sortOrder = order.toLowerCase() === 'desc' ? 'desc' : 'asc';

    // Fetch items
    const items = await prisma.visitUs.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      skip,
      take,
      include: { maps: true },
    });

    // Count total
    const totalItems = await prisma.visitUs.count({ where });

    res.status(200).json({
      data: items,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limitNum),
        currentPage: pageNum,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error('Error fetching visit us items:', error);
    res.status(500).json({ error: 'Failed to fetch visit us items', details: error.message });
  }
};

const createVisitUs = async (req, res) => {
  const { title, maps, isActive = true } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  if (!maps || !Array.isArray(maps) || maps.length === 0) {
    return res.status(400).json({ error: 'At least one map embed code is required' });
  }

  try {
    const item = await prisma.visitUs.create({
      data: {
        title,
        isActive: Boolean(isActive),
        maps: {
          create: maps.map((map) => ({
            map_embed: map.map_embed,
            address: map.address,
          })),
        },
      },
      include: { maps: true },
    });

    res.status(201).json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create visit us item' });
  }
};

const updateVisitUs = async (req, res) => {
  const { id } = req.params;
  const { title, maps } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  if (!maps || !Array.isArray(maps) || maps.length === 0) {
    return res.status(400).json({ error: 'At least one map embed code is required' });
  }

  try {
    const item = await prisma.visitUs.findUnique({
      where: { id: Number(id) },
      include: { maps: true },
    });

    if (!item) {
      return res.status(404).json({ error: 'Visit us item not found' });
    }

    await prisma.visitUsMap.deleteMany({
      where: { visitUsId: Number(id) },
    });

    const updated = await prisma.visitUs.update({
      where: { id: Number(id) },
      data: {
        title,
        maps: {
          create: maps.map((map) => ({
            map_embed: map.map_embed,
            address: map.address,
          })),
        },
      },
      include: { maps: true },
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update visit us item' });
  }
};

const deleteVisitUs = async (req, res) => {
  const { id } = req.params;
  try {
    const item = await prisma.visitUs.findUnique({
      where: { id: Number(id) },
    });

    if (!item) {
      return res.status(404).json({ error: 'Visit us item not found' });
    }

    await prisma.visitUs.delete({
      where: { id: Number(id) },
    });
    res.status(200).json({ message: 'Visit us item deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Visit us item not found' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to delete visit us item' });
  }
};

const toggleVisitUsActive = async (req, res) => {
  const { id } = req.params;
  try {
    const item = await prisma.visitUs.findUnique({
      where: { id: Number(id) },
    });

    if (!item) {
      return res.status(404).json({ error: 'Visit us item not found' });
    }

    const updated = await prisma.visitUs.update({
      where: { id: Number(id) },
      data: { isActive: !item.isActive },
      include: { maps: true },
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to toggle visit us item status' });
  }
};

const getActiveVisitUs = async (req, res) => {
  try {
    const items = await prisma.visitUs.findMany({
      where: { isActive: true },
      include: { maps: true },
    });

    res.status(200).json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch active visit us items' });
  }
};

const getVisitUsById = async (req, res) => {
  const { id } = req.params;
  try {
    const item = await prisma.visitUs.findUnique({
      where: { id: Number(id) },
      include: { maps: true },
    });
    if (!item) {
      return res.status(404).json({ error: 'Visit us item not found' });
    }
    res.status(200).json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch visit us item' });
  }
};

module.exports = {
  getVisitUs,
  createVisitUs,
  updateVisitUs,
  deleteVisitUs,
  toggleVisitUsActive,
  getActiveVisitUs,
  getVisitUsById
};