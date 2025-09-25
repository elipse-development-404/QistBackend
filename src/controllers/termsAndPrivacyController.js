const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Create or Update Terms and Privacy (single entry enforcement)
const upsertTermsAndPrivacy = async (req, res) => {
  try {
    const { content, isActive } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    const existingTermsAndPrivacy = await prisma.termsAndPrivacy.findFirst();
    let termsAndPrivacy;
    if (existingTermsAndPrivacy) {
      termsAndPrivacy = await prisma.termsAndPrivacy.update({
        where: { id: existingTermsAndPrivacy.id },
        data: {
          content,
          isActive: isActive !== undefined ? isActive : true,
          updatedAt: new Date(),
        },
      });
      res.status(200).json({ message: 'Terms and Privacy updated successfully', termsAndPrivacy });
    } else {
      termsAndPrivacy = await prisma.termsAndPrivacy.create({
        data: {
          content,
          isActive: isActive !== undefined ? isActive : true,
        },
      });
      res.status(201).json({ message: 'Terms and Privacy created successfully', termsAndPrivacy });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to save Terms and Privacy', details: error.message });
  }
};

// Get Terms and Privacy (for admin)
const getTermsAndPrivacy = async (req, res) => {
  try {
    const termsAndPrivacy = await prisma.termsAndPrivacy.findFirst();
    if (!termsAndPrivacy) {
      return res.status(404).json({ error: 'No Terms and Privacy found' });
    }
    res.status(200).json(termsAndPrivacy);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Terms and Privacy', details: error.message });
  }
};

// Delete Terms and Privacy
const deleteTermsAndPrivacy = async (req, res) => {
  try {
    const existingTermsAndPrivacy = await prisma.termsAndPrivacy.findFirst();
    if (!existingTermsAndPrivacy) {
      return res.status(404).json({ error: 'No Terms and Privacy found to delete' });
    }
    await prisma.termsAndPrivacy.delete({ where: { id: existingTermsAndPrivacy.id } });
    res.status(200).json({ message: 'Terms and Privacy deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete Terms and Privacy', details: error.message });
  }
};

// Get active Terms and Privacy (for public display)
const getActiveTermsAndPrivacy = async (req, res) => {
  try {
    const termsAndPrivacy = await prisma.termsAndPrivacy.findFirst({
      where: { isActive: true },
    });
    if (!termsAndPrivacy) {
      return res.status(404).json({ error: 'No active Terms and Privacy found' });
    }
    res.status(200).json(termsAndPrivacy);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active Terms and Privacy', details: error.message });
  }
};

module.exports = { upsertTermsAndPrivacy, getTermsAndPrivacy, deleteTermsAndPrivacy, getActiveTermsAndPrivacy };