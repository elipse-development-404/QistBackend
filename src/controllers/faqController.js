const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Create FAQ
const createFaq = async (req, res) => {
  try {
    const { question, answer, status } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ error: 'Question and answer are required' });
    }
    const faq = await prisma.faq.create({
      data: {
        question,
        answer,
        status: status || 'active',
      },
    });
    res.status(201).json({ message: 'FAQ created successfully', faq });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create FAQ', details: error.message });
  }
};

// List all FAQs (for admin)
const getAllFaqs = async (req, res) => {
  try {
    const faqs = await prisma.faq.findMany();
    res.status(200).json(faqs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch FAQs', details: error.message });
  }
};

// Get active FAQs for a product (replace [PRODUCT_NAME])
const getFaqsForProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) },
      select: { name: true },
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const faqs = await prisma.faq.findMany({
      where: { status: 'active' },
    });
    // Replace [PRODUCT_NAME] with actual product name
    const formattedFaqs = faqs.map(faq => ({
      ...faq,
      question: faq.question.replace(/\[PRODUCT_NAME\]/g, product.name),
      answer: faq.answer.replace(/\[PRODUCT_NAME\]/g, product.name),
    }));
    res.status(200).json(formattedFaqs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch FAQs', details: error.message });
  }
};

// Update FAQ
const updateFaq = async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer, status } = req.body;
    const faq = await prisma.faq.update({
      where: { id: parseInt(id) },
      data: { question, answer, status },
    });
    res.status(200).json({ message: 'FAQ updated successfully', faq });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update FAQ', details: error.message });
  }
};

// Delete FAQ
const deleteFaq = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.faq.delete({ where: { id: parseInt(id) } });
    res.status(200).json({ message: 'FAQ deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete FAQ', details: error.message });
  }
};

module.exports = {createFaq, getAllFaqs, getFaqsForProduct, updateFaq, deleteFaq}