const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Create or Update Verification Process (single entry enforcement)
const upsertVerificationProcess = async (req, res) => {
  try {
    const { content, isActive } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    const existingVerificationProcess = await prisma.verificationProcess.findFirst();
    let verificationProcess;
    if (existingVerificationProcess) {
      verificationProcess = await prisma.verificationProcess.update({
        where: { id: existingVerificationProcess.id },
        data: {
          content,
          isActive: isActive !== undefined ? isActive : true,
          updatedAt: new Date(),
        },
      });
      res.status(200).json({ message: 'Verification Process updated successfully', verificationProcess });
    } else {
      verificationProcess = await prisma.verificationProcess.create({
        data: {
          content,
          isActive: isActive !== undefined ? isActive : true,
        },
      });
      res.status(201).json({ message: 'Verification Process created successfully', verificationProcess });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to save Verification Process', details: error.message });
  }
};

// Get Verification Process (for admin)
const getVerificationProcess = async (req, res) => {
  try {
    const verificationProcess = await prisma.verificationProcess.findFirst();
    if (!verificationProcess) {
      return res.status(404).json({ error: 'No Verification Process found' });
    }
    res.status(200).json(verificationProcess);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Verification Process', details: error.message });
  }
};

// Delete Verification Process
const deleteVerificationProcess = async (req, res) => {
  try {
    const existingVerificationProcess = await prisma.verificationProcess.findFirst();
    if (!existingVerificationProcess) {
      return res.status(404).json({ error: 'No Verification Process found to delete' });
    }
    await prisma.verificationProcess.delete({ where: { id: existingVerificationProcess.id } });
    res.status(200).json({ message: 'Verification Process deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete Verification Process', details: error.message });
  }
};

// Get active Verification Process (for public display)
const getActiveVerificationProcess = async (req, res) => {
  try {
    const verificationProcess = await prisma.verificationProcess.findFirst({
      where: { isActive: true },
    });
    if (!verificationProcess) {
      return res.status(404).json({ error: 'No active Verification Process found' });
    }
    res.status(200).json(verificationProcess);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active Verification Process', details: error.message });
  }
};

module.exports = { upsertVerificationProcess, getVerificationProcess, deleteVerificationProcess, getActiveVerificationProcess };