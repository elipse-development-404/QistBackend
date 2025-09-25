const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Create or Update Delivery Policy (single entry enforcement)
const upsertDeliveryPolicy = async (req, res) => {
  try {
    const { content, isActive } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    const existingDeliveryPolicy = await prisma.deliveryPolicy.findFirst();
    let deliveryPolicy;
    if (existingDeliveryPolicy) {
      deliveryPolicy = await prisma.deliveryPolicy.update({
        where: { id: existingDeliveryPolicy.id },
        data: {
          content,
          isActive: isActive !== undefined ? isActive : true,
          updatedAt: new Date(),
        },
      });
      res.status(200).json({ message: 'Delivery Policy updated successfully', deliveryPolicy });
    } else {
      deliveryPolicy = await prisma.deliveryPolicy.create({
        data: {
          content,
          isActive: isActive !== undefined ? isActive : true,
        },
      });
      res.status(201).json({ message: 'Delivery Policy created successfully', deliveryPolicy });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to save Delivery Policy', details: error.message });
  }
};

// Get Delivery Policy (for admin)
const getDeliveryPolicy = async (req, res) => {
  try {
    const deliveryPolicy = await prisma.deliveryPolicy.findFirst();
    if (!deliveryPolicy) {
      return res.status(404).json({ error: 'No Delivery Policy found' });
    }
    res.status(200).json(deliveryPolicy);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Delivery Policy', details: error.message });
  }
};

// Delete Delivery Policy
const deleteDeliveryPolicy = async (req, res) => {
  try {
    const existingDeliveryPolicy = await prisma.deliveryPolicy.findFirst();
    if (!existingDeliveryPolicy) {
      return res.status(404).json({ error: 'No Delivery Policy found to delete' });
    }
    await prisma.deliveryPolicy.delete({ where: { id: existingDeliveryPolicy.id } });
    res.status(200).json({ message: 'Delivery Policy deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete Delivery Policy', details: error.message });
  }
};

// Get active Delivery Policy (for public display)
const getActiveDeliveryPolicy = async (req, res) => {
  try {
    const deliveryPolicy = await prisma.deliveryPolicy.findFirst({
      where: { isActive: true },
    });
    if (!deliveryPolicy) {
      return res.status(404).json({ error: 'No active Delivery Policy found' });
    }
    res.status(200).json(deliveryPolicy);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active Delivery Policy', details: error.message });
  }
};

module.exports = { upsertDeliveryPolicy, getDeliveryPolicy, deleteDeliveryPolicy, getActiveDeliveryPolicy };