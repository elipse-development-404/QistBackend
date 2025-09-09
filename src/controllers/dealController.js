const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function setDealPlans(dealId) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      DealInstallments: true,
    },
  });

  if (!deal) return;

  const productId = deal.productId;

  await prisma.productInstallments.updateMany({
    where: {
      product_id: productId,
      dealId: null,
    },
    data: {
      isActive: false,
    },
  });

  for (const ins of deal.DealInstallments) {
    await prisma.productInstallments.create({
      data: {
        product_id: productId,
        totalPrice: ins.totalPrice,
        monthlyAmount: ins.monthlyAmount,
        advance: ins.advance,
        months: ins.months,
        isActive: true,
        dealId: deal.id,
      },
    });
  }
}

async function revertDealPlans(dealId) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
  });

  if (!deal) return;

  const productId = deal.productId;

  await prisma.productInstallments.deleteMany({
    where: {
      product_id: productId,
      dealId: deal.id,
    },
  });

  await prisma.productInstallments.updateMany({
    where: {
      product_id: productId,
      dealId: null,
    },
    data: {
      isActive: true,
    },
  });
}

async function revertExpiredDeals() {
  const now = new Date();
  const expiredDeals = await prisma.deal.findMany({
    where: {
      isActive: true,
      endDate: { lt: now },
    },
    include: {
      Product: true,
    },
  });

  for (const deal of expiredDeals) {
    await prisma.deal.update({
      where: { id: deal.id },
      data: { isActive: false },
    });

    await revertDealPlans(deal.id);
  }
}

const createDeal = async (req, res) => {
  try {
    const { name, startDate, endDate, productId, installments, isActive = true } = req.body;

    const deal = await prisma.deal.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        productId: parseInt(productId),
        isActive,
        DealInstallments: {
          create: installments.map(ins => ({
            totalPrice: parseFloat(ins.totalPrice),
            monthlyAmount: parseFloat(ins.monthlyAmount),
            advance: parseFloat(ins.advance),
            months: parseInt(ins.months),
            isActive: true,
          })),
        },
      },
    });

    if (isActive) {
      await setDealPlans(deal.id);
    }

    res.status(201).json(deal);
  } catch (error) {
    console.error('Error creating deal:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const getAllDeals = async (req, res) => {
  await revertExpiredDeals();

  try {
    const deals = await prisma.deal.findMany({
      include: {
        Product: { select: { name: true } },
        DealInstallments: true,
      },
    });
    res.json(deals);
  } catch (error) {
    console.error('Error fetching deals:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const updateDeal = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, productId, installments, isActive } = req.body;

    const currentDeal = await prisma.deal.findUnique({
      where: { id: parseInt(id) },
      include: {
        DealInstallments: true,
      },
    });

    if (currentDeal.isActive) {
      await revertDealPlans(parseInt(id));
    }

    const updatedDeal = await prisma.deal.update({
      where: { id: parseInt(id) },
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        productId: parseInt(productId),
        isActive,
        DealInstallments: {
          deleteMany: {},
          create: installments.map(ins => ({
            totalPrice: parseFloat(ins.totalPrice),
            monthlyAmount: parseFloat(ins.monthlyAmount),
            advance: parseFloat(ins.advance),
            months: parseInt(ins.months),
            isActive: true,
          })),
        },
      },
    });

    if (isActive) {
      await setDealPlans(parseInt(id));
    }

    res.json(updatedDeal);
  } catch (error) {
    console.error('Error updating deal:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const toggleDeal = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const currentDeal = await prisma.deal.findUnique({
      where: { id: parseInt(id) },
    });

    if (currentDeal.isActive !== isActive) {
      if (isActive) {
        await setDealPlans(parseInt(id));
      } else {
        await revertDealPlans(parseInt(id));
      }
    }

    const updatedDeal = await prisma.deal.update({
      where: { id: parseInt(id) },
      data: { isActive },
    });

    res.json(updatedDeal);
  } catch (error) {
    console.error('Error toggling deal:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const deleteDeal = async (req, res) => {
  try {
    const { id } = req.params;

    const currentDeal = await prisma.deal.findUnique({
      where: { id: parseInt(id) },
    });

    if (currentDeal.isActive) {
      await revertDealPlans(parseInt(id));
    }

    await prisma.deal.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: 'Deal deleted successfully' });
  } catch (error) {
    console.error('Error deleting deal:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

module.exports = { createDeal, getAllDeals, updateDeal, toggleDeal, deleteDeal };