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

// NEW: Function to get product names by category/subcategory
const getProductNamesByCategory = async (categoryName) => {
  const products = await prisma.product.findMany({
    where: { 
      categories: {
        name: { contains: categoryName }
      }
    },
    select: { name: true }
  });
  return products.map(p => p.name);
};

const getProductNamesBySubCategory = async (subCategoryName) => {
  const products = await prisma.product.findMany({
    where: { 
      subcategories: {
        name: { contains: subCategoryName }
      }
    },
    select: { name: true }
  });
  return products.map(p => p.name);
};

// UPDATED: Helper function to build where clause
const buildWhereClause = async (filters) => {
  const where = {};
  
  console.log('🔍 Building where clause with filters:', filters);
  
  // Basic filters - City, Area, Item
  if (filters.city) where.city = { contains: filters.city };
  if (filters.area) where.area = { contains: filters.area };
  if (filters.item) where.productName = { contains: filters.item };
  
  // NEW: Improved category and subcategory filtering
  if (filters.category || filters.subCategory) {
    const productConditions = [];
    
    if (filters.category) {
      console.log('🏷️ Filtering by category:', filters.category);
      const productNames = await getProductNamesByCategory(filters.category);
      console.log(`📦 Found ${productNames.length} products for category "${filters.category}":`, productNames);
      
      if (productNames.length > 0) {
        productConditions.push({
          productName: { in: productNames }
        });
      } else {
        // If no products found, return empty result
        console.log('❌ No products found for category, returning empty filter');
        productConditions.push({
          productName: { in: [] } // This will return no results
        });
      }
    }
    
    if (filters.subCategory) {
      console.log('📋 Filtering by subcategory:', filters.subCategory);
      const productNames = await getProductNamesBySubCategory(filters.subCategory);
      console.log(`📦 Found ${productNames.length} products for subcategory "${filters.subCategory}":`, productNames);
      
      if (productNames.length > 0) {
        productConditions.push({
          productName: { in: productNames }
        });
      } else {
        // If no products found, return empty result
        console.log('❌ No products found for subcategory, returning empty filter');
        productConditions.push({
          productName: { in: [] } // This will return no results
        });
      }
    }
    
    // Add to where clause
    if (productConditions.length > 0) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: productConditions
      });
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

// Get all metrics with filters
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

    const { startDate, endDate } = getDateRange(period, from_date, to_date);
    const whereClause = await buildWhereClause(filters);
    
    // Add date filter to where clause
    whereClause.createdAt = {
      gte: startDate,
      lt: endDate
    };

    console.log('📊 Fetching metrics with where clause:', JSON.stringify(whereClause, null, 2));

    // Execute all queries in parallel
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
      // Active Customers
      prisma.customers.count({
        where: { isActive: true }
      }),

      // Total Sales (all orders except cancelled/rejected)
      prisma.createOrder.count({
        where: {
          ...whereClause,
          status: { notIn: ['Cancelled', 'Rejected'] }
        }
      }),

      // Pending Orders
      prisma.createOrder.count({
        where: { ...whereClause, status: 'Pending' }
      }),

      // Confirmed Orders
      prisma.createOrder.count({
        where: { ...whereClause, status: 'Confirmed' }
      }),

      // Shipped Orders
      prisma.createOrder.count({
        where: { ...whereClause, status: 'Shipped' }
      }),

      // Delivered Orders
      prisma.createOrder.count({
        where: { ...whereClause, status: 'Delivered' }
      }),

      // Total Deal Revenue (only delivered orders)
      prisma.createOrder.aggregate({
        where: { 
          ...whereClause, 
          status: 'Delivered' 
        },
        _sum: { totalDealValue: true }
      }),

      // Total Advance Revenue (all orders except cancelled/rejected)
      prisma.createOrder.aggregate({
        where: {
          ...whereClause,
          status: { notIn: ['Cancelled', 'Rejected'] }
        },
        _sum: { advanceAmount: true }
      }),

      // Cancelled Orders
      prisma.createOrder.count({
        where: { ...whereClause, status: 'Cancelled' }
      }),

      // Rejected Orders
      prisma.createOrder.count({
        where: { ...whereClause, status: 'Rejected' }
      })
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
      dateRange: {
        start: startDate,
        end: endDate,
        period
      }
    };

    console.log('📈 Metrics result:', metrics);
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard metrics', 
      details: error.message 
    });
  }
};

// Enhanced Order Trends with advanced filtering
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

    const { startDate, endDate } = getDateRange(period, from_date, to_date);
    const baseWhereClause = await buildWhereClause(filters);
    baseWhereClause.createdAt = { gte: startDate, lt: endDate };

    // Include only relevant statuses
    baseWhereClause.status = { 
      in: ['Pending', 'Confirmed', 'Shipped', 'Delivered'] 
    };

    console.log('📊 Fetching order trends with where clause:', JSON.stringify(baseWhereClause, null, 2));

    // Generate intervals based on period
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

    // Fetch data for each interval
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
          _sum: {
            totalDealValue: true,
            advanceAmount: true
          }
        });

        // Generate label based on period
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

    // Prepare chart datasets
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

    // Fixed revenue datasets
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

    res.json({
      orderTrends: {
        labels,
        datasets
      },
      revenueTrends: {
        labels,
        datasets: revenueDatasets
      },
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
    
    // Get all orders first
    const orders = await prisma.createOrder.findMany({
      where: {
        createdAt: { gte: startDate, lt: endDate },
        status: { notIn: ['Cancelled', 'Rejected'] }
      }
    });

    // Get all products for mapping
    const allProducts = await prisma.product.findMany({
      include: {
        categories: { select: { id: true, name: true } },
        subcategories: { select: { id: true, name: true } }
      }
    });

    // Create product name to category/subcategory mapping
    const productMap = {};
    allProducts.forEach(product => {
      productMap[product.name] = {
        category: product.categories?.name || 'Unknown Category',
        subcategory: product.subcategories?.name || 'Unknown Subcategory'
      };
    });

    // Group orders by dimension
    const groupedData = {};
    
    orders.forEach(order => {
      let key;
      const productInfo = productMap[order.productName] || {
        category: 'Unknown Category',
        subcategory: 'Unknown Subcategory'
      };

      switch (dimension) {
        case 'category':
          key = productInfo.category;
          break;
        case 'sub_category':
          key = productInfo.subcategory;
          break;
        case 'item':
          key = order.productName;
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
        groupedData[key] = {
          orderCount: 0,
          totalRevenue: 0,
          advanceCollected: 0
        };
      }

      groupedData[key].orderCount++;
      groupedData[key].totalRevenue += Number(order.totalDealValue) || 0;
      groupedData[key].advanceCollected += Number(order.advanceAmount) || 0;
    });

    // Convert to array and sort
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

// Get filter options for dropdowns
const getFilterOptions = async (req, res) => {
  try {
    // Get categories and subcategories
    const [categories, subcategories] = await Promise.all([
      prisma.categories.findMany({
        where: { isActive: true },
        select: { id: true, name: true }
      }),
      prisma.subcategories.findMany({
        where: { isActive: true },
        select: { id: true, name: true, category_id: true }
      })
    ]);

    // Get all orders for cities, areas, and product names
    const allOrders = await prisma.createOrder.findMany({
      select: {
        city: true,
        area: true,
        productName: true
      },
      take: 10000
    });

    // Manual filtering and deduplication
    const cities = [...new Set(allOrders.map(order => order.city).filter(city => 
      city !== null && city !== undefined && city.toString().trim() !== ''
    ))].sort();

    const areas = [...new Set(allOrders.map(order => order.area).filter(area => 
      area !== null && area !== undefined && area.toString().trim() !== ''
    ))].sort();

    const productNames = [...new Set(allOrders.map(order => order.productName).filter(productName => 
      productName !== null && productName !== undefined && productName.toString().trim() !== ''
    ))].sort();

    res.json({
      cities,
      areas,
      productNames,
      categories: categories.map(c => ({ 
        id: c.id, 
        name: c.name
      })),
      subcategories: subcategories.map(s => ({ 
        id: s.id, 
        name: s.name,
        category_id: s.category_id
      }))
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