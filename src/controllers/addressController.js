const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getAddresses = async (req, res) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { customerId: req.customer.customerId },
    });
    res.json(addresses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch addresses' });
  }
};

const addAddress = async (req, res) => {
  const { firstName, lastName, company, address1, city, region, zipCode, phone, isDefault } = req.body;
  try {
    if (isDefault) {
      await prisma.address.updateMany({
        where: { customerId: req.customer.customerId, isDefault: true },
        data: { isDefault: false },
      });
    }
    const address = await prisma.address.create({
      data: {
        customerId: req.customer.customerId,
        firstName,
        lastName,
        company,
        address1,
        city,
        region,
        zipCode,
        phone,
        isDefault,
      },
    });
    res.status(201).json(address);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add address' });
  }
};

const updateAddress = async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, company, address1, city, region, zipCode, phone, isDefault } = req.body;
  try {
    if (isDefault) {
      await prisma.address.updateMany({
        where: { customerId: req.customer.customerId, isDefault: true },
        data: { isDefault: false },
      });
    }
    const address = await prisma.address.update({
      where: { id: parseInt(id) },
      data: { firstName, lastName, company, address1, city, region, zipCode, phone, isDefault },
    });
    res.json(address);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update address' });
  }
};

const deleteAddress = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.address.delete({
      where: { id: parseInt(id) },
    });
    res.json({ message: 'Address deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete address' });
  }
};

module.exports = { getAddresses, addAddress, updateAddress, deleteAddress };