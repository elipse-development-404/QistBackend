const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Create or Update Returns and Refunds Policy (single entry enforcement)
const upsertReturnsRefundsPolicy = async (req, res) => {
  try {
    const { content, isActive } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    const existingReturnsRefundsPolicy = await prisma.returnsRefundsPolicy.findFirst();
    let returnsRefundsPolicy;
    if (existingReturnsRefundsPolicy) {
      returnsRefundsPolicy = await prisma.returnsRefundsPolicy.update({
        where: { id: existingReturnsRefundsPolicy.id },
        data: {
          content,
          isActive: isActive !== undefined ? isActive : true,
          updatedAt: new Date(),
        },
      });
      res.status(200).json({ message: 'Returns and Refunds Policy updated successfully', returnsRefundsPolicy });
    } else {
      returnsRefundsPolicy = await prisma.returnsRefundsPolicy.create({
        data: {
          content,
          isActive: isActive !== undefined ? isActive : true,
        },
      });
      res.status(201).json({ message: 'Returns and Refunds Policy created successfully', returnsRefundsPolicy });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to save Returns and Refunds Policy', details: error.message });
  }
};

// Get Returns and Refunds Policy (for admin)
const getReturnsRefundsPolicy = async (req, res) => {
  try {
    const returnsRefundsPolicy = await prisma.returnsRefundsPolicy.findFirst();
    if (!returnsRefundsPolicy) {
      return res.status(404).json({ error: 'No Returns and Refunds Policy found' });
    }
    res.status(200).json(returnsRefundsPolicy);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Returns and Refunds Policy', details: error.message });
  }
};

// Delete Returns and Refunds Policy
const deleteReturnsRefundsPolicy = async (req, res) => {
  try {
    const existingReturnsRefundsPolicy = await prisma.returnsRefundsPolicy.findFirst();
    if (!existingReturnsRefundsPolicy) {
      return res.status(404).json({ error: 'No Returns and Refunds Policy found to delete' });
    }
    await prisma.returnsRefundsPolicy.delete({ where: { id: existingReturnsRefundsPolicy.id } });
    res.status(200).json({ message: 'Returns and Refunds Policy deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete Returns and Refunds Policy', details: error.message });
  }
};

// Get active Returns and Refunds Policy (for public display)
const getActiveReturnsRefundsPolicy = async (req, res) => {
  try {
    const returnsRefundsPolicy = await prisma.returnsRefundsPolicy.findFirst({
      where: { isActive: true },
    });
    if (!returnsRefundsPolicy) {
      return res.status(404).json({ error: 'No active Returns and Refunds Policy found' });
    }
    res.status(200).json(returnsRefundsPolicy);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active Returns and Refunds Policy', details: error.message });
  }
};

module.exports = { upsertReturnsRefundsPolicy, getReturnsRefundsPolicy, deleteReturnsRefundsPolicy, getActiveReturnsRefundsPolicy };