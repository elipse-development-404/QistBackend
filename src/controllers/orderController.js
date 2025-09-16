const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const createOrders = async (req, res) => {
  try {
    const data = req.body;

    // Validate required fields (unchanged)
    const requiredFields = [
      'email',
      'phone',
      'firstName',
      'lastName',
      'cnic',
      'city',
      'area',
      'address',
      'paymentMethod',
      'productName',
      'totalDealValue',
      'advanceAmount',
      'monthlyAmount',
      'months'
    ];
    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null) {
        return res.status(400).json({ error: `${field} is required` });
      }
    }

    // Validate field types and values
    if (typeof data.productName !== 'string' || data.productName.trim() === '') {
      return res.status(400).json({ error: 'productName must be a non-empty string' });
    }
    if (isNaN(data.totalDealValue) || data.totalDealValue < 0) {
      return res.status(400).json({ error: 'totalDealValue must be a non-negative number' });
    }
    if (isNaN(data.advanceAmount) || data.advanceAmount < 0) {
      return res.status(400).json({ error: 'advanceAmount must be a non-negative number' });
    }
    if (isNaN(data.monthlyAmount) || data.monthlyAmount < 0) {
      return res.status(400).json({ error: 'monthlyAmount must be a non-negative number' });
    }
    if (!Number.isInteger(data.months) || data.months < 0) {
      return res.status(400).json({ error: 'months must be a non-negative integer' });
    }

    // If authenticated, set customerId
    let customerId = null;
    if (req.customer) {
      customerId = req.customer.customerId;
    }

    const newOrder = await prisma.createOrder.create({
      data: {
        customerId,
        email: data.email,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        cnic: data.cnic,
        city: data.city,
        area: data.area,
        address: data.address,
        orderNotes: data.orderNotes || null,
        paymentMethod: data.paymentMethod,
        productName: data.productName,
        totalDealValue: Number(data.totalDealValue),
        advanceAmount: Number(data.advanceAmount),
        monthlyAmount: Number(data.monthlyAmount),
        months: Number(data.months),
      },
    });

    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order', details: error.message });
  }
}

module.exports = { createOrders };