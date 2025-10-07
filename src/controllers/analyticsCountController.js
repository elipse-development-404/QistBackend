const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getActiveCustomersCount = async (req, res) => {
  try {
    const activeCustomersCount = await prisma.customers.count({
      where: { isActive: true },
    });
    res.json({ activeCustomersCount });
  } catch (error) {
    console.error('Error fetching active customers count:', error);
    res.status(500).json({ error: 'Failed to fetch active customers count' });
  }
};

const getPendingOrdersCount = async (req, res) => {
  try {
    const pendingOrdersCount = await prisma.createOrder.count({
      where: { status: 'Pending' },
    });
    res.json({ pendingOrdersCount });
  } catch (error) {
    console.error('Error fetching pending orders count:', error);
    res.status(500).json({ error: 'Failed to fetch pending orders count' });
  }
};

const getConfirmedOrdersCount = async (req, res) => {
  try {
    const confirmedOrdersCount = await prisma.createOrder.count({
      where: { status: 'Confirmed' },
    });
    res.json({ confirmedOrdersCount });
  } catch (error) {
    console.error('Error fetching confirmed orders count:', error);
    res.status(500).json({ error: 'Failed to fetch confirmed orders count' });
  }
};

const getShippedOrdersCount = async (req, res) => {
  try {
    const shippedOrdersCount = await prisma.createOrder.count({
      where: { status: 'Shipped' },
    });
    res.json({ shippedOrdersCount });
  } catch (error) {
    console.error('Error fetching shipped orders count:', error);
    res.status(500).json({ error: 'Failed to fetch shipped orders count' });
  }
};

const getDeliveredOrdersCount = async (req, res) => {
  try {
    const deliveredOrdersCount = await prisma.createOrder.count({
      where: { status: 'Delivered' },
    });
    res.json({ deliveredOrdersCount });
  } catch (error) {
    console.error('Error fetching delivered orders count:', error);
    res.status(500).json({ error: 'Failed to fetch delivered orders count' });
  }
};

const getTotalDealRevenue = async (req, res) => {
  try {
    const result = await prisma.createOrder.aggregate({
      where: { status: 'Delivered' },
      _sum: { totalDealValue: true },
    });
    const totalDealRevenue = result._sum.totalDealValue || 0;
    res.json({ totalDealRevenue });
  } catch (error) {
    console.error('Error fetching total deal revenue:', error);
    res.status(500).json({ error: 'Failed to fetch total deal revenue' });
  }
};

const getTotalAdvanceRevenue = async (req, res) => {
  try {
    const result = await prisma.createOrder.aggregate({
      where: { status: 'Delivered' },
      _sum: { advanceAmount: true },
    });
    const totalAdvanceRevenue = result._sum.advanceAmount || 0;
    res.json({ totalAdvanceRevenue });
  } catch (error) {
    console.error('Error fetching total advance revenue:', error);
    res.status(500).json({ error: 'Failed to fetch total advance revenue' });
  }
};

const getOrderTrends = async (req, res) => {
  try {
    const { period = 'monthly', from_date, to_date } = req.query;
    const now = new Date();

    let fromDate, toDate;
    if (from_date && to_date) {
      fromDate = new Date(`${from_date}T00:00:00Z`);
      toDate = new Date(`${to_date}T00:00:00Z`);
      toDate.setDate(toDate.getDate() + 1); // Include the entire to_date day
    } else {
      if (period === 'weekly') {
        fromDate = new Date(now);
        fromDate.setDate(now.getDate() - 28);
        toDate = new Date(now);
        toDate.setDate(now.getDate() + 1);
      } else {
        fromDate = new Date(now.getFullYear(), 0, 1);
        toDate = new Date(now.getFullYear() + 1, 0, 1);
      }
    }

    // Generate intervals based on period
    const intervals = [];
    let current = new Date(fromDate);
    while (current < toDate) {
      let end = new Date(current);
      if (period === 'weekly') {
        end.setDate(current.getDate() + 7);
      } else {
        end.setMonth(current.getMonth() + 1);
      }
      if (end > toDate) end = toDate;
      intervals.push({ start: new Date(current), end });
      current = end;
    }

    // Fetch data for each interval
    const labels = [];
    const totalOrdersData = [];
    const pendingOrdersData = [];
    const deliveredOrdersData = [];

    for (const interval of intervals) {
      // Generate label
      let label;
      if (period === 'weekly') {
        label = `Week of ${interval.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      } else {
        label = interval.start.toLocaleString('default', { month: 'short', year: 'numeric' });
      }
      labels.push(label);

      // Query data for the interval
      const intervalData = await prisma.createOrder.groupBy({
        by: ['status'],
        where: {
          status: { in: ['Pending', 'Confirmed', 'Shipped', 'Delivered'] },
          createdAt: { gte: interval.start, lt: interval.end },
        },
        _count: { id: true },
      });

      const total = intervalData.reduce((sum, item) => sum + item._count.id, 0);
      const pending = intervalData.find(item => item.status === 'Pending')?._count.id || 0;
      const delivered = intervalData.find(item => item.status === 'Delivered')?._count.id || 0;

      totalOrdersData.push(total);
      pendingOrdersData.push(pending);
      deliveredOrdersData.push(delivered);
    }

    const chartData = {
      labels,
      datasets: [
        {
          label: 'Total Orders (Pending, Confirmed, Shipped, Delivered)',
          data: totalOrdersData,
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        },
        {
          label: 'Pending Orders',
          data: pendingOrdersData,
          backgroundColor: 'rgba(255, 159, 64, 0.2)',
          borderColor: 'rgba(255, 159, 64, 1)',
          borderWidth: 1,
        },
        {
          label: 'Delivered Orders',
          data: deliveredOrdersData,
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
        },
      ],
    };

    res.json({ chartData });
  } catch (error) {
    console.error('Error fetching order trends:', error);
    res.status(500).json({ error: 'Failed to fetch order trends' });
  }
};

const getTotalSales = async (req, res) => {
  try {
    const totalSales = await prisma.createOrder.count({
      where: {
        status: {
          in: ['Pending', 'Confirmed', 'Shipped', 'Delivered'],
        },
      },
    });

    res.status(200).json({ totalSales });
  } catch (error) {
    console.error('Error fetching total sales:', error);
    res.status(500).json({ error: 'Failed to fetch total sales' });
  }
};

module.exports = {
  getActiveCustomersCount,
  getPendingOrdersCount,
  getConfirmedOrdersCount,
  getShippedOrdersCount,
  getDeliveredOrdersCount,
  getTotalDealRevenue,
  getTotalAdvanceRevenue,
  getOrderTrends,
  getTotalSales,
};