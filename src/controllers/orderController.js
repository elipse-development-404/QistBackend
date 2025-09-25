const { validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const prisma = new PrismaClient();

const sendEmail = async (to, subject, orderData) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // Use TLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  let orderNoticeMessage = '';
  if (subject === 'Order Confirmation') {
    orderNoticeMessage = 'Your order has been successfully placed!';
  } else if (subject === 'Order Tracking Details') {
    orderNoticeMessage = 'Order details retrieved successfully.';
  } else if (subject === 'Order Cancel Request Approved') {
    orderNoticeMessage = 'Your order cancel request has been approved. Your order is now cancelled.';
  } else if (subject.includes('Updated to Rejected')) {
    orderNoticeMessage = `Your order has been rejected. Reason: ${orderData.rejectionReason || 'N/A'}`;
  } else {
    orderNoticeMessage = `Order update. Current Order Status: ${orderData.status}`;
  }

  // HTML email template
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 20px auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        h1, h5 { color: #333; }
        p { color: #555; }
        .order-notice { text-align: center; padding: 20px; background: #e0f7fa; border-radius: 8px; }
        .order-notice svg { margin-bottom: 10px; }
        .order-overview-list { list-style: none; padding: 0; margin: 20px 0; }
        .order-overview-list li { margin-bottom: 10px; font-size: 16px; }
        .order-overview-list li strong { color: #000; }
        .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .table th, .table td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        .table th { background: #f8f8f8; font-weight: bold; }
        .table td { color: #555; }
        .fw-bold { font-weight: bold; }
        .text-center { text-align: center; }
        .text-danger { color: #d32f2f; }
        .btn { display: inline-block; padding: 10px 20px; background: #007bff; color: #fff; text-decoration: none; border-radius: 5px; }
        @media (max-width: 600px) { .container { padding: 10px; } .table th, .table td { font-size: 14px; } }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="order-notice text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="#007bff" viewBox="0 0 256 256">
            <path d="M225.86,102.82c-3.77-3.94-7.67-8-9.14-11.57-1.36-3.27-1.44-8.69-1.52-13.94-.15-9.76-.31-20.82-8-28.51s-18.75-7.85-28.51-8c-5.25-.08-10.67-.16-13.94-1.52-3.56-1.47-7.63-5.37-11.57-9.14C146.28,23.51,138.44,16,128,16s-18.27,7.51-25.18,14.14c-3.94,3.77-8,7.67-11.57,9.14C88,40.64,82.56,40.72,77.31,40.8c-9.76.15-20.82.31-28.51,8S41,67.55,40.8,77.31c-.08,5.25-.16,10.67-1.52,13.94-1.47,3.56-5.37,7.63-9.14,11.57C23.51,109.72,16,117.56,16,128s7.51,18.27,14.14,25.18c3.77,3.94,7.67,8,9.14,11.57,1.36,3.27,1.44,8.69,1.52,13.94.15,9.76.31,20.82,8,28.51s18.75,7.85,28.51,8c5.25.08,10.67.16,13.94,1.52,3.56,1.47,7.63,5.37,11.57,9.14C109.72,232.49,117.56,240,128,240s18.27-7.51,25.18-14.14c3.94-3.77,8-7.67,11.57-9.14,3.27-1.36,8.69-1.44,13.94-1.52,9.76-.15,20.82-.31,28.51-8s7.85-18.75,8-28.51c.08-5.25.16-10.67,1.52-13.94,1.47-3.56,5.37-7.63,9.14-11.57C232.49,146.28,240,138.44,240,128S232.49,109.73,225.86,102.82Zm-11.55,39.29c-4.79,5-9.75,10.17-12.38,16.52-2.52,6.1-2.63,13.07-2.73,19.82-.1,7-.21,14.33-3.32,17.43s-10.39,3.22-17.43,3.32c-6.75.1-13.72.21-19.82,2.73-6.35,2.63-11.52,7.59-16.52,12.38S132,224,128,224s-9.15-4.92-14.11-9.69-10.17-9.75-16.52-12.38c-6.1-2.52-13.07-2.63-19.82-2.73-7-.1-14.33-.21-17.43-3.32s-3.22-10.39-3.32-17.43c-.1-6.75-.21-13.72-2.73-19.82-2.63-6.35-7.59-11.52-12.38-16.52S32,132,32,128s4.92-9.15,9.69-14.11,9.75-10.17,12.38-16.52c2.52-6.1,2.63-13.07,2.73-19.82.1-7,.21-14.33,3.32-17.43S70.51,56.9,77.55,56.8c6.75-.1,13.72-.21,19.82-2.73,6.35-2.63,11.52-7.59,16.52-12.38S124,32,128,32s9.15,4.92,14.11,9.69,10.17,9.75,16.52,12.38c6.1,2.52,13.07,2.63,19.82,2.73,7,.1,14.33.21,17.43,3.32s3.22,10.39,3.32,17.43c.1,6.75.21,13.72,2.73,19.82,2.63,6.35,7.59,11.52,12.38,16.52S224,124,224,128,219.08,137.15,214.31,142.11ZM173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34Z" />
          </svg>
          <p>${orderNoticeMessage}</p>
        </div>
        ${orderData.rejectionReason && orderData.status === "Rejected" ? `
          <div class="order-detail-wrap">
            <h5 class="fw-bold text-danger">Rejection Reason</h5>
            <p>${orderData.rejectionReason}</p>
          </div>
        ` : ""}
        <ul class="order-overview-list">
          <li>Order number: <strong>${orderData.id}</strong></li>
          <li>Tracking Number: <strong>${orderData.tokenNumber}</strong></li>
          <li>Date: <strong>${new Date(orderData.createdAt).toLocaleDateString()}</strong></li>
          <li>Status: <strong>${orderData.status}</strong></li>
          <li>Advance: <strong>Rs. ${orderData.advanceAmount}</strong></li>
          <li>Payment method: <strong>${orderData.paymentMethod}</strong></li>
        </ul>
        <div class="order-detail-wrap">
          <h5 class="fw-bold">Order Details</h5>
          <table class="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Total Advance</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${orderData.productName}</td>
                <td><span class="fw-bold">Rs. ${orderData.advanceAmount}</span></td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th>Payment method:</th>
                <td>${orderData.paymentMethod}</td>
              </tr>
            </tfoot>
          </table>
          <table class="table">
            <thead>
              <tr>
                <th>Advance Amount</th>
                <th>Installment Amount</th>
                <th>Months Plan</th>
                <th>Total Deal Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span class="fw-bold">Rs. ${orderData.advanceAmount}</span></td>
                <td><span class="fw-bold">Rs. ${orderData.monthlyAmount}</span></td>
                <td><span class="fw-bold">Months: ${orderData.months}</span></td>
                <td><span class="fw-bold">Rs. ${orderData.totalDealValue}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="order-detail-wrap">
          <h5 class="fw-bold">Billing Address</h5>
          <table class="table">
            <tbody>
              <tr>
                <td><span class="fw-bold">Customer Name:</span></td>
                <td><span class="fw-bold">${orderData.firstName} ${orderData.lastName}</span></td>
              </tr>
              <tr>
                <td><span class="fw-bold">Phone:</span></td>
                <td><span class="fw-bold">${orderData.phone}</span></td>
              </tr>
              <tr>
                <td><span class="fw-bold">Email:</span></td>
                <td><span class="fw-bold">${orderData.email}</span></td>
              </tr>
              <tr>
                <td><span class="fw-bold">Address:</span></td>
                <td><span class="fw-bold">${orderData.address}</span></td>
              </tr>
              <tr>
                <td><span class="fw-bold">City:</span></td>
                <td><span class="fw-bold">${orderData.city}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        ${orderData.orderNotes ? `
          <div class="order-detail-wrap">
            <h5 class="fw-bold">Order Notes</h5>
            <p>${orderData.orderNotes}</p>
          </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to,
    subject,
    html: htmlContent,
  });
};

const getOrders = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    status = 'all',
  } = req.query;
  const skip = (page - 1) * limit;
  const take = Number(limit);

  try {
    const where = { AND: [] };

    where.AND.push({
      status: {
        notIn: ['Cancelled', 'Rejected'],
      },
    });

    if (search) {
      where.AND.push({
        OR: [
          { id: isNaN(search) ? undefined : Number(search) },
          { tokenNumber: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { productName: { contains: search, mode: 'insensitive' } },
        ].filter(Boolean),
      });
    }

    if (status !== 'all') {
      where.AND.push({ status });
    }

    const orders = await prisma.createOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const totalItems = await prisma.createOrder.count({ where });

    res.status(200).json({
      data: orders,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

const getPendingOrders = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = '',
  } = req.query;
  const skip = (page - 1) * limit;
  const take = Number(limit);

  try {
    const where = { 
      AND: [
        { status: 'Pending' },
        { status: { notIn: ['Cancelled', 'Rejected'] } },
      ],
    };

    if (search) {
      where.AND.push({
        OR: [
          { id: isNaN(search) ? undefined : Number(search) },
          { tokenNumber: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { productName: { contains: search, mode: 'insensitive' } },
        ].filter(Boolean),
      });
    }

    const orders = await prisma.createOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const totalItems = await prisma.createOrder.count({ where });

    res.status(200).json({
      data: orders,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch pending orders' });
  }
};

const getDeliveredOrders = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = '',
  } = req.query;
  const skip = (page - 1) * limit;
  const take = Number(limit);

  try {
    const where = { 
      AND: [
        { status: 'Delivered' },
        { status: { notIn: ['Cancelled', 'Rejected'] } },
      ],
    };

    if (search) {
      where.AND.push({
        OR: [
          { id: isNaN(search) ? undefined : Number(search) },
          { tokenNumber: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { productName: { contains: search, mode: 'insensitive' } },
        ].filter(Boolean),
      });
    }

    const orders = await prisma.createOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const totalItems = await prisma.createOrder.count({ where });

    res.status(200).json({
      data: orders,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch delivered orders' });
  }
};

const getCancelledOrders = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = '',
  } = req.query;
  const skip = (page - 1) * limit;
  const take = Number(limit);

  try {
    const where = { 
      AND: [
        { status: 'Cancelled' },
      ],
    };

    if (search) {
      where.AND.push({
        OR: [
          { id: isNaN(search) ? undefined : Number(search) },
          { tokenNumber: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { productName: { contains: search, mode: 'insensitive' } },
        ].filter(Boolean),
      });
    }

    const orders = await prisma.createOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const totalItems = await prisma.createOrder.count({ where });

    res.status(200).json({
      data: orders,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch cancelled orders' });
  }
};

const getOrderById = async (req, res) => {
  const { id } = req.params;

  try {
    const order = await prisma.createOrder.findUnique({
      where: { id: Number(id) },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
};

const createOrders = async (req, res) => {
  try {
    const data = req.body;

    // Validate required fields
    const requiredFields = [
      'email',
      'phone',
      'firstName',
      'lastName',
      'cnic',
      'city',
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
    if (data.customerID) {
      customerId = data.customerID;
    }

    // Generate unique token (8-character alphanumeric)
    const tokenNumber = crypto.randomBytes(4).toString('hex').toUpperCase();

    const newOrder = await prisma.createOrder.create({
      data: {
        customerId,
        email: data.email,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        cnic: data.cnic,
        city: data.city,
        address: data.address,
        orderNotes: data.orderNotes || null,
        paymentMethod: data.paymentMethod,
        productName: data.productName,
        totalDealValue: Number(data.totalDealValue),
        advanceAmount: Number(data.advanceAmount),
        monthlyAmount: Number(data.monthlyAmount),
        months: Number(data.months),
        tokenNumber,
      },
    });

    // Send confirmation email
    await sendEmail(newOrder.email, 'Order Confirmation', newOrder);

    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order', details: error.message });
  }
};

const trackOrder = async (req, res) => {
  try {
    const { tokenOrId, phone } = req.body;

    if (!tokenOrId || !phone) {
      return res.status(400).json({ error: 'order no or token no and phone are required' });
    }

    // Find order by token or ID, and phone
    const order = await prisma.createOrder.findFirst({
      where: {
        phone,
        OR: [
          { id: Number(tokenOrId) ? Number(tokenOrId) : undefined },
          { tokenNumber: tokenOrId },
        ],
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Send tracking email
    await sendEmail(order.email, 'Order Tracking Details', order);

    res.status(200).json(order);
  } catch (error) {
    console.error('Error tracking order:', error);
    res.status(500).json({ error: 'Failed to track order', details: error.message });
  }
};

// New: Get pending cancel requests for admin
const getCancelRequests = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = '',
  } = req.query;
  const skip = (page - 1) * limit;
  const take = Number(limit);

  try {
    const where = { 
      AND: [
        { cancelRequest: 'pending' },
        { status: { notIn: ['Cancelled', 'Rejected'] } },
      ],
    };

    if (search) {
      where.AND.push({
        OR: [
          { id: isNaN(search) ? undefined : Number(search) },
          { tokenNumber: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { productName: { contains: search, mode: 'insensitive' } },
        ].filter(Boolean),
      });
    }

    const orders = await prisma.createOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const totalItems = await prisma.createOrder.count({ where });

    res.status(200).json({
      data: orders,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch cancel requests' });
  }
};

// New: Admin approves cancel request
const approveCancel = async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await prisma.createOrder.findUnique({ where: { id: Number(orderId) } });
    if (!order || order.cancelRequest !== 'pending') {
      return res.status(400).json({ error: 'No pending cancel request' });
    }
    const updatedOrder = await prisma.createOrder.update({
      where: { id: Number(orderId) },
      data: { cancelRequest: 'approved', status: 'Cancelled' },
    });
    await sendEmail(updatedOrder.email, 'Order Cancel Request Approved', updatedOrder);
    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to approve cancellation' });
  }
};

const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status, rejectionReason } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    let data = { status };
    if (status === 'Rejected') {
      if (!rejectionReason) {
        return res.status(400).json({ error: 'Rejection reason is required' });
      }
      data.rejectionReason = rejectionReason;
    }

    const updatedOrder = await prisma.createOrder.update({
      where: { id: Number(id) },
      data,
    });

    await sendEmail(updatedOrder.email, `Order Status Updated to ${status}`, updatedOrder);

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

const getRejectedOrders = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = '',
  } = req.query;
  const skip = (page - 1) * limit;
  const take = Number(limit);

  try {
    const where = { 
      AND: [
        { status: 'Rejected' },
      ],
    };

    if (search) {
      where.AND.push({
        OR: [
          { id: isNaN(search) ? undefined : Number(search) },
          { tokenNumber: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { productName: { contains: search, mode: 'insensitive' } },
        ].filter(Boolean),
      });
    }

    const orders = await prisma.createOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const totalItems = await prisma.createOrder.count({ where });

    res.status(200).json({
      data: orders,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch rejected orders' });
  }
};

module.exports = { createOrders, trackOrder, getOrders, getPendingOrders, getDeliveredOrders, getOrderById, getCancelRequests, approveCancel, getCancelledOrders, updateOrderStatus, getRejectedOrders };