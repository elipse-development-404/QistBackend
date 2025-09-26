const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Create QuestionAnswer
const createQA = async (req, res) => {
  try {
    const { question, answer, status } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ error: 'Question and answer are required' });
    }
    const qa = await prisma.questionAnswer.create({
      data: {
        question,
        answer,
        status: status || 'active',
      },
    });
    res.status(201).json({ message: 'QuestionAnswer created successfully', qa });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create QuestionAnswer', details: error.message });
  }
};

// List all QuestionAnswers
const getAllQAs = async (req, res) => {
  try {
    const qas = await prisma.questionAnswer.findMany();
    res.status(200).json(qas);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch QuestionAnswers', details: error.message });
  }
};

// Update QuestionAnswer
const updateQA = async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer, status } = req.body;
    const qa = await prisma.questionAnswer.update({
      where: { id: parseInt(id) },
      data: { question, answer, status },
    });
    res.status(200).json({ message: 'QuestionAnswer updated successfully', qa });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update QuestionAnswer', details: error.message });
  }
};

// Delete QuestionAnswer
const deleteQA = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.questionAnswer.delete({ where: { id: parseInt(id) } });
    res.status(200).json({ message: 'QuestionAnswer deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete QuestionAnswer', details: error.message });
  }
};

const getActiveQAs = async (req, res) => {
  try {
    const qas = await prisma.questionAnswer.findMany({
      where: { status: 'active' },
    });
    res.status(200).json(qas);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active QuestionAnswers', details: error.message });
  }
};

module.exports = { createQA, getAllQAs, updateQA, deleteQA, getActiveQAs };