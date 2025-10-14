const { PrismaClient } = require("@prisma/client");
const { checkProductConflicts, setProductDealPlans, revertProductDealPlans } = require("./dealController");

const prisma = new PrismaClient();

const createProductDeal = async (req, res) => {
  try {
    const { dealId, productId, installments } = req.body;
    const existingPd = await prisma.productDeal.findUnique({
      where: { dealId_productId: { dealId: parseInt(dealId), productId: parseInt(productId) } },
    });
    if (existingPd) {
      return res.status(400).json({ message: "Product is already associated with this deal." });
    }
    const deal = await prisma.deal.findUnique({ where: { id: parseInt(dealId) } });
    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }
    if (deal.isActive) {
      await checkProductConflicts([parseInt(productId)], parseInt(dealId));
    }
    const pd = await prisma.productDeal.create({
      data: {
        dealId: parseInt(dealId),
        productId: parseInt(productId),
        DealInstallments: {
          create: installments.map((ins) => ({
            totalPrice: parseFloat(ins.totalPrice),
            monthlyAmount: parseFloat(ins.monthlyAmount),
            advance: parseFloat(ins.advance),
            months: parseInt(ins.months),
            isActive: true,
          })),
        },
      },
    });

    await prisma.product.update({
      where: { id: parseInt(productId) },
      data: { isDeal: true },
    });
    if (deal.isActive) {
      await setProductDealPlans(pd.id);
    }
    res.status(201).json(pd);
  } catch (error) {
    console.error('Error creating product deal:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const getProductDealsPagination = async (req, res) => {
  const { page = 1, limit = 10, search = '', status = 'all', sort = 'id', order = 'desc' } = req.query;
  const skip = (page - 1) * limit;
  const take = Number(limit);
  try {
    const where = { AND: [] };
    if (search) {
      where.AND.push({
        OR: [
          { Deal: { name: { contains: search } } },
          { Product: { name: { contains: search } } },
          { id: isNaN(search) ? undefined : Number(search) },
        ].filter(Boolean),
      });
    }
    if (status === 'active') {
      where.AND.push({ Deal: { isActive: true } });
    } else if (status === 'inactive') {
      where.AND.push({ Deal: { isActive: false } });
    }
    const validSortFields = { id: 'id', dealId: 'dealId', productId: 'productId' };
    const sortField = validSortFields[sort] || 'id';
    const productDeals = await prisma.productDeal.findMany({
      where,
      orderBy: { [sortField]: order.toLowerCase() === 'desc' ? 'desc' : 'asc' },
      include: {
        Deal: { select: { name: true, startDate: true, endDate: true, isActive: true } },
        Product: { select: { name: true } },
        DealInstallments: true,
      },
      skip,
      take,
    });
    const totalItems = await prisma.productDeal.count({ where });
    res.status(200).json({
      data: productDeals,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error('Error fetching product deals:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const updateProductDeal = async (req, res) => {
  try {
    const { id } = req.params;
    const { installments } = req.body;
    const pd = await prisma.productDeal.findUnique({
      where: { id: parseInt(id) },
      include: { Deal: true },
    });
    if (!pd) {
      return res.status(404).json({ message: "Product deal not found." });
    }
    if (pd.Deal.isActive) {
      await revertProductDealPlans(parseInt(id));
    }
    await prisma.dealInstallments.deleteMany({ where: { productDealId: parseInt(id) } });
    await prisma.dealInstallments.createMany({
      data: installments.map((ins) => ({
        productDealId: parseInt(id),
        totalPrice: parseFloat(ins.totalPrice),
        monthlyAmount: parseFloat(ins.monthlyAmount),
        advance: parseFloat(ins.advance),
        months: parseInt(ins.months),
        isActive: true,
      })),
    });
    if (pd.Deal.isActive) {
      await setProductDealPlans(parseInt(id));
    }
    const updatedPd = await prisma.productDeal.findUnique({
      where: { id: parseInt(id) },
      include: { DealInstallments: true },
    });
    res.json(updatedPd);
  } catch (error) {
    console.error('Error updating product deal:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const deleteProductDeal = async (req, res) => {
  try {
    const { id } = req.params;
    const pd = await prisma.productDeal.findUnique({
      where: { id: parseInt(id) },
      include: { Deal: true },
    });
    if (!pd) {
      return res.status(404).json({ message: "Product deal not found." });
    }
    if (pd.Deal.isActive) {
      await revertProductDealPlans(parseInt(id));
    }
    await prisma.productDeal.delete({ where: { id: parseInt(id) } });
    
    const remainingDeals = await prisma.productDeal.findMany({
      where: {
        productId: pd.productId,
        Deal: { isActive: true },
      },
    });

    if (remainingDeals.length === 0) {
      await prisma.product.update({
        where: { id: pd.productId },
        data: { isDeal: false },
      });
    }
    res.json({ message: 'Product deal deleted successfully' });
  } catch (error) {
    console.error('Error deleting product deal:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

module.exports = { createProductDeal, getProductDealsPagination, updateProductDeal, deleteProductDeal };