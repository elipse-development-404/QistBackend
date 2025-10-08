const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Fetch notifications with pagination and read/unread filter
const getNotifications = async (req, res) => {
  const { page = 1, limit = 20, status = 'all' } = req.query;
  const skip = (page - 1) * limit;
  const take = Number(limit);

  try {
    const where = {};
    if (status === 'read') {
      where.isRead = true;
    } else if (status === 'unread') {
      where.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        order: {
          select: {
            id: true,
            productName: true,
            firstName: true,
            lastName: true,
            tokenNumber: true,
          },
        },
      },
    });

    const totalItems = await prisma.notification.count({ where });

    res.status(200).json({
      data: notifications,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// Mark a single notification as read
const markNotificationAsRead = async (req, res) => {
  const { id } = req.params;

  try {
    const notification = await prisma.notification.findUnique({
      where: { id: Number(id) },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id: Number(id) },
      data: { isRead: true },
    });

    res.status(200).json(updatedNotification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

// Mark all notifications as read
const markAllNotificationsAsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });

    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
};

module.exports = { getNotifications, markNotificationAsRead, markAllNotificationsAsRead };