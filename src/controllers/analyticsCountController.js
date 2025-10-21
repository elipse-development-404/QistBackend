const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function to calculate date ranges
const getDateRange = (period, customStart, customEnd) => {
  const now = new Date();
  let startDate, endDate;

  if (customStart && customEnd) {
    startDate = new Date(customStart);
    endDate = new Date(customEnd);
    endDate.setDate(endDate.getDate() + 1); // Include end date
    return { startDate, endDate };
  }

  switch (period) {
    case 'week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      endDate = new Date(now);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
      break;
    case 'half_year':
      const half = Math.floor(now.getMonth() / 6);
      startDate = new Date(now.getFullYear(), half * 6, 1);
      endDate = new Date(now.getFullYear(), (half + 1) * 6, 0);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
      break;
    default: // monthly
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  return { startDate, endDate };
};

// Build where clause for filtering
const buildWhereClause = (filters) => {
  const where = {};
  
  console.log('🔍 Building where clause with filters:', filters);
  
  // Basic filters - City and Area
  if (filters.city) where.city = { contains: filters.city };
  if (filters.area) where.area = { contains: filters.area };
  if (filters.item) where.productName = { contains: filters.item };
  
  // Category and subcategory filtering
  if (filters.category) {
    console.log('🏷️ Filtering by category ID:', filters.category);
    const categoryId = parseInt(filters.category);
    if (!isNaN(categoryId)) {
      where.category_id = categoryId;
    }
  }
  
  if (filters.subCategory) {
    console.log('📋 Filtering by subcategory ID:', filters.subCategory);
    const subcategoryId = parseInt(filters.subCategory);
    if (!isNaN(subcategoryId)) {
      where.subcategory_id = subcategoryId;
    }
  }
  
  // Price range
  if (filters.minPrice || filters.maxPrice) {
    where.AND = where.AND || [];
    const priceCondition = {};
    if (filters.minPrice) priceCondition.gte = parseFloat(filters.minPrice);
    if (filters.maxPrice) priceCondition.lte = parseFloat(filters.maxPrice);
    
    where.AND.push({
      OR: [
        { totalDealValue: priceCondition },
        { advanceAmount: priceCondition }
      ]
    });
  }

  console.log('✅ Final where clause:', JSON.stringify(where, null, 2));
  return where;
};

// Get dashboard metrics
const getDashboardMetrics = async (req, res) => {
  try {
    const { 
      period = 'month',
      from_date, 
      to_date,
      city,
      area,
      category,
      sub_category,
      item,
      min_price,
      max_price
    } = req.query;

    const filters = {
      city, area, category, subCategory: sub_category, item,
      minPrice: min_price, maxPrice: max_price
    };

    console.log('🎯 Received filters for metrics:', filters);

    const { startDate, endDate } = getDateRange(period, from_date, to_date);
    
    const whereClause = buildWhereClause(filters);
    whereClause.createdAt = {
      gte: startDate,
      lt: endDate
    };

    const totalOrders = await prisma.createOrder.count({ where: whereClause });
    console.log('📊 Total orders for metrics:', totalOrders, JSON.stringify(whereClause, null, 2));

    const [
      activeCustomersCount,
      totalSalesCount,
      pendingOrdersCount,
      confirmedOrdersCount,
      shippedOrdersCount,
      deliveredOrdersCount,
      totalDealRevenueResult,
      totalAdvanceRevenueResult,
      cancelledOrdersCount,
      rejectedOrdersCount
    ] = await Promise.all([
      prisma.customers.count({ where: { isActive: true } }),
      prisma.createOrder.count({
        where: { ...whereClause, status: { notIn: ['Cancelled', 'Rejected'] } }
      }),
      prisma.createOrder.count({ where: { ...whereClause, status: 'Pending' } }),
      prisma.createOrder.count({ where: { ...whereClause, status: 'Confirmed' } }),
      prisma.createOrder.count({ where: { ...whereClause, status: 'Shipped' } }),
      prisma.createOrder.count({ where: { ...whereClause, status: 'Delivered' } }),
      prisma.createOrder.aggregate({
        where: { ...whereClause, status: 'Delivered' },
        _sum: { totalDealValue: true }
      }),
      prisma.createOrder.aggregate({
        where: { ...whereClause, status: { notIn: ['Cancelled', 'Rejected'] } },
        _sum: { advanceAmount: true }
      }),
      prisma.createOrder.count({ where: { ...whereClause, status: 'Cancelled' } }),
      prisma.createOrder.count({ where: { ...whereClause, status: 'Rejected' } })
    ]);

    const metrics = {
      activeCustomersCount,
      totalSalesCount,
      pendingOrdersCount,
      confirmedOrdersCount,
      shippedOrdersCount,
      deliveredOrdersCount,
      cancelledOrdersCount,
      rejectedOrdersCount,
      totalDealRevenue: totalDealRevenueResult._sum.totalDealValue || 0,
      totalAdvanceRevenue: totalAdvanceRevenueResult._sum.advanceAmount || 0,
      dateRange: { start: startDate, end: endDate, period }
    };

    console.log('📈 Metrics result:', {
      category: filters.category,
      subCategory: filters.subCategory,
      totalSales: metrics.totalSalesCount,
      totalRevenue: metrics.totalDealRevenue,
      deliveredOrders: metrics.deliveredOrdersCount
    });
    
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard metrics', 
      details: error.message 
    });
  }
};

// Get order trends
const getOrderTrends = async (req, res) => {
  try {
    const { 
      period = 'monthly', 
      from_date, 
      to_date,
      city,
      area,
      category,
      sub_category,
      item,
      min_price,
      max_price
    } = req.query;

    const filters = {
      city, area, category, subCategory: sub_category, item,
      minPrice: min_price, maxPrice: max_price
    };

    console.log('🎯 Received filters for trends:', filters);

    const { startDate, endDate } = getDateRange(period, from_date, to_date);
    
    const baseWhereClause = buildWhereClause(filters);
    baseWhereClause.createdAt = { gte: startDate, lt: endDate };
    baseWhereClause.status = { in: ['Pending', 'Confirmed', 'Shipped', 'Delivered'] };

    const totalOrders = await prisma.createOrder.count({ where: baseWhereClause });
    console.log('📊 Total orders for trends:', totalOrders, JSON.stringify(baseWhereClause, null, 2));

    const intervals = [];
    let current = new Date(startDate);
    
    while (current < endDate) {
      let end = new Date(current);
      if (period === 'weekly') {
        end.setDate(current.getDate() + 7);
      } else if (period === 'daily') {
        end.setDate(current.getDate() + 1);
      } else {
        end.setMonth(current.getMonth() + 1);
      }
      if (end > endDate) end = endDate;
      intervals.push({ start: new Date(current), end });
      current = end;
    }

    const trendsData = await Promise.all(
      intervals.map(async (interval) => {
        const whereClause = {
          ...baseWhereClause,
          createdAt: { gte: interval.start, lt: interval.end }
        };

        const orders = await prisma.createOrder.groupBy({
          by: ['status'],
          where: whereClause,
          _count: { id: true },
          _sum: { totalDealValue: true, advanceAmount: true }
        });

        let label;
        if (period === 'daily') {
          label = interval.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else if (period === 'weekly') {
          label = `Week of ${interval.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        } else {
          label = interval.start.toLocaleString('default', { month: 'short', year: 'numeric' });
        }

        const byStatus = {};
        orders.forEach(item => {
          byStatus[item.status] = {
            count: item._count.id,
            revenue: Number(item._sum.totalDealValue) || 0,
            advance: Number(item._sum.advanceAmount) || 0
          };
        });

        return {
          label,
          interval: { start: interval.start, end: interval.end },
          total: orders.reduce((sum, item) => sum + item._count.id, 0),
          totalRevenue: orders.reduce((sum, item) => sum + (Number(item._sum.totalDealValue) || 0), 0),
          totalAdvance: orders.reduce((sum, item) => sum + (Number(item._sum.advanceAmount) || 0), 0),
          byStatus
        };
      })
    );

    const labels = trendsData.map(item => item.label);
    
    const datasets = [
      {
        label: 'Total Orders',
        data: trendsData.map(item => item.total),
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2,
        tension: 0.4
      },
      {
        label: 'Pending Orders',
        data: trendsData.map(item => item.byStatus.Pending?.count || 0),
        backgroundColor: 'rgba(255, 159, 64, 0.2)',
        borderColor: 'rgba(255, 159, 64, 1)',
        borderWidth: 2,
        tension: 0.4
      },
      {
        label: 'Confirmed Orders',
        data: trendsData.map(item => item.byStatus.Confirmed?.count || 0),
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 2,
        tension: 0.4
      },
      {
        label: 'Shipped Orders',
        data: trendsData.map(item => item.byStatus.Shipped?.count || 0),
        backgroundColor: 'rgba(153, 102, 255, 0.2)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 2,
        tension: 0.4
      },
      {
        label: 'Delivered Orders',
        data: trendsData.map(item => item.byStatus.Delivered?.count || 0),
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 2,
        tension: 0.4
      }
    ];

    const revenueDatasets = [
      {
        label: 'Total Revenue',
        data: trendsData.map(item => Number(item.totalRevenue || 0)),
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 2,
        tension: 0.4,
        yAxisID: 'y'
      },
      {
        label: 'Advance Collected',
        data: trendsData.map(item => Number(item.totalAdvance || 0)),
        backgroundColor: 'rgba(255, 205, 86, 0.2)',
        borderColor: 'rgba(255, 205, 86, 1)',
        borderWidth: 2,
        tension: 0.4,
        yAxisID: 'y'
      }
    ];

    console.log('📈 Order trends summary:', {
      category: filters.category,
      subCategory: filters.subCategory,
      totalOrders: trendsData.reduce((sum, item) => sum + item.total, 0),
      totalRevenue: trendsData.reduce((sum, item) => sum + (item.totalRevenue || 0), 0)
    });

    res.json({
      orderTrends: { labels, datasets },
      revenueTrends: { labels, datasets: revenueDatasets },
      summary: {
        totalOrders: trendsData.reduce((sum, item) => sum + item.total, 0),
        totalRevenue: trendsData.reduce((sum, item) => sum + (item.totalRevenue || 0), 0),
        totalAdvance: trendsData.reduce((sum, item) => sum + (item.totalAdvance || 0), 0)
      }
    });
  } catch (error) {
    console.error('Error fetching order trends:', error);
    res.status(500).json({ 
      error: 'Failed to fetch order trends', 
      details: error.message 
    });
  }
};

// Analytics by dimension
const getAnalyticsByDimension = async (req, res) => {
  try {
    const { dimension = 'city', period = 'month', from_date, to_date } = req.query;
    
    const { startDate, endDate } = getDateRange(period, from_date, to_date);
    
    const orders = await prisma.createOrder.findMany({
      where: {
        createdAt: { gte: startDate, lt: endDate },
        status: { notIn: ['Cancelled', 'Rejected'] }
      },
      take: 1000 // Limit for performance
    });

    console.log('📊 Total orders for analytics:', orders.length);

    const [allCategories, allSubcategories] = await Promise.all([
      prisma.categories.findMany({ select: { id: true, name: true } }),
      prisma.subcategories.findMany({ select: { id: true, name: true } })
    ]);

    const categoryMap = {};
    const subcategoryMap = {};
    allCategories.forEach(cat => { categoryMap[cat.id] = cat.name; });
    allSubcategories.forEach(sub => { subcategoryMap[sub.id] = sub.name; });

    const groupedData = {};
    orders.forEach(order => {
      let key;
      switch (dimension) {
        case 'category':
          key = order.category_id ? categoryMap[order.category_id] : 'Unknown Category';
          break;
        case 'sub_category':
          key = order.subcategory_id ? subcategoryMap[order.subcategory_id] : 'Unknown Subcategory';
          break;
        case 'item':
          key = order.productName || 'Unknown Product';
          break;
        case 'city':
          key = order.city || 'Unknown City';
          break;
        case 'area':
          key = order.area || 'Unknown Area';
          break;
        default:
          key = order.city || 'Unknown City';
      }

      if (!groupedData[key]) {
        groupedData[key] = { orderCount: 0, totalRevenue: 0, advanceCollected: 0 };
      }

      groupedData[key].orderCount++;
      groupedData[key].totalRevenue += Number(order.totalDealValue) || 0;
      groupedData[key].advanceCollected += Number(order.advanceAmount) || 0;
    });

    const formattedData = Object.entries(groupedData)
      .map(([name, data]) => ({
        name,
        orderCount: data.orderCount,
        totalRevenue: data.totalRevenue,
        advanceCollected: data.advanceCollected,
        avgOrderValue: data.orderCount > 0 ? data.totalRevenue / data.orderCount : 0
      }))
      .sort((a, b) => b.orderCount - a.orderCount);

    res.json({
      dimension,
      period: { start: startDate, end: endDate },
      data: formattedData
    });
  } catch (error) {
    console.error('Error fetching analytics by dimension:', error);
    res.status(500).json({ 
      error: 'Failed to fetch analytics', 
      details: error.message 
    });
  }
};

// Get filter options
const getFilterOptions = async (req, res) => {
  try {
    const [categories, subcategories, orders] = await Promise.all([
      prisma.categories.findMany({
        where: { isActive: true },
        select: { id: true, name: true }
      }),
      prisma.subcategories.findMany({
        where: { isActive: true },
        select: { id: true, name: true, category_id: true }
      }),
      prisma.createOrder.findMany({
        select: { city: true, area: true, productName: true },
        take: 10000
      })
    ]);

    const cities = [...new Set(orders.map(order => order.city).filter(city => 
      city !== null && city !== undefined && city.toString().trim() !== ''
    ))].sort();

    const areas = [...new Set(orders.map(order => order.area).filter(area => 
      area !== null && area !== undefined && area.toString().trim() !== ''
    ))].sort();

    const productNames = [...new Set(orders.map(order => order.productName).filter(productName => 
      productName !== null && productName !== undefined && productName.toString().trim() !== ''
    ))].sort();

    res.json({
      cities,
      areas,
      productNames,
      categories: categories.map(c => ({ id: c.id, name: c.name })),
      subcategories: subcategories.map(s => ({ id: s.id, name: s.name, category_id: s.category_id }))
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({ 
      error: 'Failed to fetch filter options',
      details: error.message 
    });
  }
};

module.exports = {
  getDashboardMetrics,
  getOrderTrends,
  getAnalyticsByDimension,
  getFilterOptions
};