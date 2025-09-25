const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Create or Update About (single entry enforcement)
const upsertAbout = async (req, res) => {
  try {
    const { content, isActive } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    const existingAbout = await prisma.about.findFirst();
    let about;
    if (existingAbout) {
      about = await prisma.about.update({
        where: { id: existingAbout.id },
        data: {
          content,
          isActive: isActive !== undefined ? isActive : true,
          updatedAt: new Date(),
        },
      });
      res.status(200).json({ message: 'About updated successfully', about });
    } else {
      about = await prisma.about.create({
        data: {
          content,
          isActive: isActive !== undefined ? isActive : true,
        },
      });
      res.status(201).json({ message: 'About created successfully', about });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to save About', details: error.message });
  }
};

// Get About (for admin)
const getAbout = async (req, res) => {
  try {
    const about = await prisma.about.findFirst();
    if (!about) {
      return res.status(404).json({ error: 'No About found' });
    }
    res.status(200).json(about);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch About', details: error.message });
  }
};

// Delete About
const deleteAbout = async (req, res) => {
  try {
    const existingAbout = await prisma.about.findFirst();
    if (!existingAbout) {
      return res.status(404).json({ error: 'No About found to delete' });
    }
    await prisma.about.delete({ where: { id: existingAbout.id } });
    res.status(200).json({ message: 'About deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete About', details: error.message });
  }
};

// Get active About (for public display)
const getActiveAbout = async (req, res) => {
  try {
    const about = await prisma.about.findFirst({
      where: { isActive: true },
    });
    if (!about) {
      return res.status(404).json({ error: 'No active About found' });
    }
    res.status(200).json(about);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active About', details: error.message });
  }
};

module.exports = { upsertAbout, getAbout, deleteAbout, getActiveAbout };