const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

const getProfile = async (req, res) => {
  try {
    const customer = await prisma.customers.findUnique({
      where: { id: req.customer.customerId },
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, cnic: true },
    });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

const updateProfile = async (req, res) => {
  const { firstName, lastName, phone, cnic } = req.body;
  try {
    const customer = await prisma.customers.findUnique({
      where: { id: req.customer.customerId },
      select: { cnic: true },
    });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Only allow cnic update if it's currently null
    const updateData = {
      firstName,
      lastName,
      phone,
      ...(customer.cnic === null && cnic ? { cnic } : {}),
    };

    const updatedCustomer = await prisma.customers.update({
      where: { id: req.customer.customerId },
      data: updateData,
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, cnic: true },
    });
    res.json(updatedCustomer);
  } catch (error) {
    console.error('Error updating profile:', error);
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
    console.error('Error changing password:', error);
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
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

const requestCancel = async (req, res) => {
  const { orderId } = req.params;
  const customerId = req.customer.customerId;
  try {
    const order = await prisma.createOrder.findUnique({ where: { id: Number(orderId) } });
    if (!order || order.customerId !== customerId) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.cancelRequest !== 'none') {
      return res.status(400).json({ error: 'Cancel request already sent' });
    }
    if (order.status === 'Delivered') {
      return res.status(400).json({ error: 'Cannot cancel a delivered order' });
    }
    const updatedOrder = await prisma.createOrder.update({
      where: { id: Number(orderId) },
      data: { cancelRequest: 'pending' },
    });
    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error('Error requesting cancellation:', error);
    res.status(500).json({ error: 'Failed to request cancellation' });
  }
};

module.exports = { getProfile, updateProfile, changePassword, getOrders, requestCancel };