const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function checkProductConflicts(productIds, excludeDealId = null) {
  for (const pid of productIds) {
    const existing = await prisma.deal.findFirst({
      where: {
        id: excludeDealId ? { not: excludeDealId } : undefined,
        isActive: true,
        ProductDeals: { some: { productId: pid } },
      },
    });
    if (existing) {
      throw new Error(`Product ${pid} is already associated with an active deal (ID: ${existing.id}).`);
    }
  }
}

async function setProductDealPlans(pdId) {
  const pd = await prisma.productDeal.findUnique({
    where: { id: pdId },
    include: { DealInstallments: true, Deal: true },
  });
  if (!pd) return;
  const productId = pd.productId;
  const dealId = pd.dealId;
  await prisma.productInstallments.updateMany({
    where: { product_id: productId, dealId: null },
    data: { isActive: false },
  });
  for (const ins of pd.DealInstallments) {
    await prisma.productInstallments.create({
      data: {
        product_id: productId,
        totalPrice: ins.totalPrice,
        monthlyAmount: ins.monthlyAmount,
        advance: ins.advance,
        months: ins.months,
        isActive: true,
        dealId,
      },
    });
  }
}

async function revertProductDealPlans(pdId) {
  const pd = await prisma.productDeal.findUnique({
    where: { id: pdId },
    include: { Deal: true },
  });
  if (!pd) return;
  const productId = pd.productId;
  const dealId = pd.dealId;
  await prisma.productInstallments.deleteMany({
    where: { product_id: productId, dealId },
  });
  await prisma.productInstallments.updateMany({
    where: { product_id: productId, dealId: null },
    data: { isActive: true },
  });
}

async function setDealPlans(dealId) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { ProductDeals: true },
  });
  if (!deal) return;
  for (const pd of deal.ProductDeals) {
    await setProductDealPlans(pd.id);
  }
}

async function revertDealPlans(dealId) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { ProductDeals: true },
  });
  if (!deal) {
    console.log(`Deal with ID ${dealId} not found in revertDealPlans.`);
    return;
  }
  console.log(`Reverting deal plans for deal ID ${dealId}.`);
  for (const pd of deal.ProductDeals) {
    await revertProductDealPlans(pd.id);
  }
}

async function revertExpiredDeals() {
  const now = new Date();
  const expiredDeals = await prisma.deal.findMany({
    where: { isActive: true, endDate: { lt: now } },
    include: { ProductDeals: true },
  });
  console.log(`Found ${expiredDeals.length} expired deals to revert.`);
  for (const deal of expiredDeals) {
    console.log(`Reverting expired deal ID ${deal.id}.`);
    await prisma.deal.update({
      where: { id: deal.id },
      data: { isActive: false },
    });
    await revertDealPlans(deal.id);
    for (const pd of deal.ProductDeals) {
      console.log(`Setting isDeal to false for product ID ${pd.productId} due to expired deal.`);
      await prisma.product.update({
        where: { id: pd.productId },
        data: { isDeal: false },
      });
    }
  }
}

const createDeal = async (req, res) => {
  try {
    const { name, startDate, endDate, isActive = true } = req.body;
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    if (isNaN(startDateObj) || isNaN(endDateObj)) {
      return res.status(400).json({ message: "Invalid startDate or endDate format. Please provide valid ISO 8601 date-time strings." });
    }
    if (endDateObj <= startDateObj) {
      return res.status(400).json({ message: "End date and time must be after start date and time." });
    }
    const deal = await prisma.deal.create({
      data: { name, startDate: startDateObj, endDate: endDateObj, isActive },
    });
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
      where: { isActive: true },
      include: {
        ProductDeals: {
          orderBy: { createdAt: 'desc' },
          include: {
            Product: {
              include: {
                ProductImage: { take: 1, orderBy: { id: 'asc' } },
                categories: { select: { name: true, slugName: true } },
                subcategories: { select: { name: true, slugName: true } },
              },
            },
            DealInstallments: { where: { isActive: true } },
          },
        },
      },
    });
    const response = deals.map((deal) => ({
      ...deal,
      products: deal.ProductDeals.map((pd) => ({
        product_id: pd.productId,
        product_name: pd.Product?.name || null,
        slugName: pd.Product?.slugName || null,
        category_name: pd.Product?.categories?.name || null,
        categories_SlugName: pd.Product?.categories?.slugName || null,
        subcategory_name: pd.Product?.subcategories?.name || null,
        subcategory_SlugName: pd.Product?.subcategories?.slugName || null,
        image_url: pd.Product?.ProductImage[0]?.url || null,
        installments: pd.DealInstallments,
      })),
      ProductDeals: undefined,
    }));
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching deals:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const getDealsPagination = async (req, res) => {
  const { page = 1, limit = 10, search = '', status = 'all', sort = 'id', order = 'desc' } = req.query;
  const skip = (page - 1) * limit;
  const take = Number(limit);
  await revertExpiredDeals();
  try {
    const where = { AND: [] };
    if (search) {
      where.AND.push({
        OR: [
          { name: { contains: search } },
          { ProductDeals: { some: { Product: { name: { contains: search } } } } },
          { id: isNaN(search) ? undefined : Number(search) },
        ].filter(Boolean),
      });
    }
    if (status === 'active') {
      where.AND.push({ isActive: true });
    } else if (status === 'inactive') {
      where.AND.push({ isActive: false });
    }
    const validSortFields = { id: 'id', name: 'name', startDate: 'startDate', endDate: 'endDate', isActive: 'isActive' };
    const sortField = validSortFields[sort] || 'id';
    const deals = await prisma.deal.findMany({
      where,
      orderBy: { [sortField]: order.toLowerCase() === 'desc' ? 'desc' : 'asc' },
      include: {
        ProductDeals: {
          include: { Product: { select: { name: true } } },
        },
      },
      skip,
      take,
    });
    const totalItems = await prisma.deal.count({ where });
    res.status(200).json({
      data: deals,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error('Error fetching deals:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const updateDeal = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, isActive } = req.body;
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    if (isNaN(startDateObj) || isNaN(endDateObj)) {
      return res.status(400).json({ message: "Invalid startDate or endDate format. Please provide valid ISO 8601 date-time strings." });
    }
    if (endDateObj <= startDateObj) {
      return res.status(400).json({ message: "End date and time must be after start date and time." });
    }
    const currentDeal = await prisma.deal.findUnique({
      where: { id: parseInt(id) },
      include: { ProductDeals: true },
    });
    if (!currentDeal) {
      return res.status(404).json({ message: "Deal not found." });
    }
    console.log(`Updating deal ID ${id} from isActive: ${currentDeal.isActive} to ${isActive}`);
    if (currentDeal.isActive && !isActive) {
      console.log(`Deactivating deal ID ${id}, reverting plans and setting isDeal to false.`);
      await revertDealPlans(parseInt(id));
      for (const pd of currentDeal.ProductDeals) {
        console.log(`Setting isDeal to false for product ID ${pd.productId}.`);
        await prisma.product.update({
          where: { id: pd.productId },
          data: { isDeal: false },
        });
      }
    }
    const updatedDeal = await prisma.deal.update({
      where: { id: parseInt(id) },
      data: { name, startDate: startDateObj, endDate: endDateObj, isActive },
    });
    if (isActive && !currentDeal.isActive) {
      console.log(`Activating deal ID ${id}, setting plans and isDeal to true.`);
      const productDeals = await prisma.productDeal.findMany({
        where: { dealId: parseInt(id) },
      });
      const productIds = productDeals.map((pd) => pd.productId);
      await checkProductConflicts(productIds, parseInt(id));
      await setDealPlans(parseInt(id));
      for (const pd of productDeals) {
        console.log(`Setting isDeal to true for product ID ${pd.productId}.`);
        await prisma.product.update({
          where: { id: pd.productId },
          data: { isDeal: true },
        });
      }
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
      include: { ProductDeals: true },
    });
    if (!currentDeal) {
      return res.status(404).json({ message: "Deal not found." });
    }
    console.log(`Toggling deal ID ${id} from isActive: ${currentDeal.isActive} to ${isActive}`);
    if (currentDeal.isActive !== isActive) {
      if (isActive) {
        console.log(`Activating deal ID ${id}, setting plans and isDeal to true.`);
        const productDeals = await prisma.productDeal.findMany({
          where: { dealId: parseInt(id) },
        });
        const productIds = productDeals.map((pd) => pd.productId);
        await checkProductConflicts(productIds, parseInt(id));
        await setDealPlans(parseInt(id));
        for (const pd of productDeals) {
          console.log(`Setting isDeal to true for product ID ${pd.productId}.`);
          await prisma.product.update({
            where: { id: pd.productId },
            data: { isDeal: true },
          });
        }
      } else {
        console.log(`Deactivating deal ID ${id}, reverting plans and setting isDeal to false.`);
        await revertDealPlans(parseInt(id));
        for (const pd of currentDeal.ProductDeals) {
          console.log(`Setting isDeal to false for product ID ${pd.productId}.`);
          await prisma.product.update({
            where: { id: pd.productId },
            data: { isDeal: false },
          });
        }
      }
    } else {
      console.log(`No state change for deal ID ${id}, isActive already ${isActive}.`);
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
      include: { ProductDeals: true },
    });
    if (!currentDeal) {
      return res.status(404).json({ message: "Deal not found." });
    }
    console.log(`Deleting deal ID ${id}.`);
    if (currentDeal.isActive) {
      console.log(`Deal ID ${id} is active, reverting plans and setting isDeal to false.`);
      await revertDealPlans(parseInt(id));
      for (const pd of currentDeal.ProductDeals) {
        console.log(`Setting isDeal to false for product ID ${pd.productId}.`);
        await prisma.product.update({
          where: { id: pd.productId },
          data: { isDeal: false },
        });
      }
    }
    await prisma.deal.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Deal deleted successfully' });
  } catch (error) {
    console.error('Error deleting deal:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

module.exports = {
  createDeal,
  getAllDeals,
  updateDeal,
  toggleDeal,
  deleteDeal,
  getDealsPagination,
  checkProductConflicts,
  setProductDealPlans,
  revertProductDealPlans,
  setDealPlans,
  revertDealPlans,
  revertExpiredDeals,
};