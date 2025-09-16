const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

const updateProfile = async (req, res) => {
  const { firstName, lastName, phone } = req.body;
  try {
    const customer = await prisma.customers.update({
      where: { id: req.customer.customerId },
      data: { firstName, lastName, phone },
    });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

const changePassword = async (req, res) => {
  const { oldPassword, newPassword, confirmNewPassword } = req.body;
  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  try {
    const customer = await prisma.customers.findUnique({ where: { id: req.customer.customerId } });
    const isValid = await bcrypt.compare(oldPassword, customer.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid old password' });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.customers.update({
      where: { id: customer.id },
      data: { password: hashedPassword },
    });
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
};

const getOrders = async (req, res) => {
  try {
    const orders = await prisma.createOrder.findMany({
      where: { customerId: req.customer.customerId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

module.exports = { updateProfile, changePassword, getOrders };