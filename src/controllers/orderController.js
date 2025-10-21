const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const prisma = new PrismaClient();

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const WATI_ACCESS_TOKEN = process.env.WATI_ACCESS_TOKEN;
const WATI_ORDER_CONFIRMATION_TEMPLATE_NAME = process.env.WATI_ORDER_CONFIRMATION_TEMPLATE_NAME;
const WATI_ORDER_CONFIRMATION_BROADCAST_NAME = process.env.WATI_ORDER_CONFIRMATION_BROADCAST_NAME;
const WATI_ORDER_TRACKING_TEMPLATE_NAME = process.env.WATI_ORDER_TRACKING_TEMPLATE_NAME;
const WATI_ORDER_TRACKING_BROADCAST_NAME = process.env.WATI_ORDER_TRACKING_BROADCAST_NAME;
const WATI_ORDER_CANCEL_TEMPLATE_NAME = process.env.WATI_ORDER_CANCEL_TEMPLATE_NAME;
const WATI_ORDER_CANCEL_BROADCAST_NAME = process.env.WATI_ORDER_CANCEL_BROADCAST_NAME;
const WATI_ORDER_REJECTED_TEMPLATE_NAME = process.env.WATI_ORDER_REJECTED_TEMPLATE_NAME;
const WATI_ORDER_REJECTED_BROADCAST_NAME = process.env.WATI_ORDER_REJECTED_BROADCAST_NAME;
const WATI_ORDER_STATUS_UPDATE_TEMPLATE_NAME = process.env.WATI_ORDER_STATUS_UPDATE_TEMPLATE_NAME;
const WATI_ORDER_STATUS_UPDATE_BROADCAST_NAME = process.env.WATI_ORDER_STATUS_UPDATE_BROADCAST_NAME;
const WATI_BASE_URL = process.env.WATI_BASE_URL;

const sendEmail = async (to, subject, orderData) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  let orderNoticeMessage = '';
  const isFullDetails = subject === 'Order Confirmation';

  if (subject === 'Order Confirmation') {
    orderNoticeMessage = 'Your order has been successfully placed!';
  } else if (subject === 'Order Tracking Details') {
    orderNoticeMessage = 'Order details retrieved successfully.';
  } else if (subject === 'Order Cancel Request Approved') {
    orderNoticeMessage = 'Your order cancel request has been approved. Your order is now cancelled.';
  } else if (subject.includes('Updated to Rejected')) {
    orderNoticeMessage = `Your order has been rejected.`;
  } else {
    orderNoticeMessage = `Great news! Your order is now ${orderData.status}.`;
  }

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
        ${orderData.status === 'Rejected' && orderData.rejectionReason ? `
          <div class="order-detail-wrap">
            <h5 class="fw-bold text-danger">Rejection Reason</h5>
            <p>${orderData.rejectionReason}</p>
          </div>
        ` : ''}
        <ul class="order-overview-list">
          <li>Order number: <strong>${orderData.id}</strong></li>
          <li>Tracking Number: <strong>${orderData.tokenNumber || ''}</strong></li>
          <li>Date: <strong>${new Date(orderData.createdAt).toLocaleDateString()}</strong></li>
          <li>Status: <strong>${orderData.status || ''}</strong></li>
          <li>Product: <strong>${orderData.productName || ''}</strong></li>
          <li>Advance: <strong>Rs. ${Number(orderData.advanceAmount).toLocaleString() || ''}</strong></li>
          <li>Area: <strong>${orderData.area || ''}</strong></li>
          ${isFullDetails ? `
            <li>Payment method: <strong>${orderData.paymentMethod || ''}</strong></li>
          ` : ''}
        </ul>
        ${isFullDetails ? `
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
                <td>${orderData.productName || ''}</td>
                <td><span class="fw-bold">Rs. ${Number(orderData.advanceAmount).toLocaleString() || ''}</span></td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th>Payment method:</th>
                <td>${orderData.paymentMethod || ''}</td>
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
                <td><span class="fw-bold">Rs. ${Number(orderData.advanceAmount).toLocaleString() || ''}</span></td>
                <td><span class="fw-bold">Rs. ${Number(orderData.monthlyAmount).toLocaleString() || ''}</span></td>
                <td><span class="fw-bold">Months: ${orderData.months || ''}</span></td>
                <td><span class="fw-bold">Rs. ${Number(orderData.totalDealValue).toLocaleString() || ''}</span></td>
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
                <td><span class="fw-bold">${orderData.fullName}</span></td>
              </tr>
              <tr>
                <td><span class="fw-bold">WhatsApp Number:</span></td>
                <td><span class="fw-bold">${orderData.phone}</span></td>
              </tr>
              ${orderData.alternativePhone ? `
              <tr>
                <td><span class="fw-bold">Alternative Number:</span></td>
                <td><span class="fw-bold">${orderData.alternativePhone}</span></td>
              </tr>
              ` : ''}
              ${orderData.email ? `
              <tr>
                <td><span class="fw-bold">Email:</span></td>
                <td><span class="fw-bold">${orderData.email}</span></td>
              </tr>
              ` : ''}
              <tr>
                <td><span class="fw-bold">Address:</span></td>
                <td><span class="fw-bold">${orderData.address || ''}</span></td>
              </tr>
              <tr>
                <td><span class="fw-bold">City:</span></td>
                <td><span class="fw-bold">${orderData.city || ''}</span></td>
              </tr>
              <tr>
                <td><span class="fw-bold">Area:</span></td>
                <td><span class="fw-bold">${orderData.area || ''}</span></td>
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
        ` : ''}
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to,
      subject,
      html: htmlContent,
    });
    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error(`Error sending email for ${subject}:`, error);
    throw new Error('Failed to send email');
  }
};

const sendOrderWhatsApp = async (phone, subject, orderData) => {
  let waPhone = phone.startsWith('0') ? '92' + phone.slice(1) : phone.startsWith('+92') ? phone.slice(1) : phone;
  if (!waPhone.startsWith('92')) {
    throw new Error('Invalid phone format for WhatsApp');
  }
  const url = `${WATI_BASE_URL}/api/v1/sendTemplateMessage?whatsappNumber=${waPhone}`;

  let templateName, broadcastName, orderNoticeMessage, parameters;

  if (subject === 'Order Confirmation') {
    templateName = WATI_ORDER_CONFIRMATION_TEMPLATE_NAME;
    broadcastName = WATI_ORDER_CONFIRMATION_BROADCAST_NAME;
    orderNoticeMessage = 'Your order has been successfully placed!';
    parameters = [
      { name: '1', value: `${orderData.fullName}` },
      { name: '2', value: orderData.id.toString() },
      { name: '3', value: orderData.tokenNumber },
      { name: '4', value: new Date(orderData.createdAt).toLocaleDateString() },
      { name: '5', value: orderData.status },
      { name: '6', value: orderData.productName },
      { name: '7', value: Number(orderData.advanceAmount).toLocaleString() },
      { name: '8', value: Number(orderData.monthlyAmount).toLocaleString() },
      { name: '9', value: orderData.months?.toString() },
      { name: '10', value: Number(orderData.totalDealValue).toLocaleString() },
      { name: '11', value: orderData.paymentMethod },
      { name: '12', value: orderData.address },
      { name: '13', value: orderData.city },
      { name: '14', value: orderData.area },
    ];
  } else if (subject === 'Order Tracking Details') {
    templateName = WATI_ORDER_TRACKING_TEMPLATE_NAME;
    broadcastName = WATI_ORDER_TRACKING_BROADCAST_NAME;
    orderNoticeMessage = 'Order details retrieved successfully.';
    parameters = [
      { name: '1', value: `${orderData.fullName}` },
      { name: '2', value: orderData.id.toString() },
      { name: '3', value: orderData.tokenNumber },
      { name: '4', value: new Date(orderData.createdAt).toLocaleDateString() },
      { name: '5', value: orderData.status },
      { name: '6', value: orderData.productName },
      { name: '7', value: Number(orderData.advanceAmount).toLocaleString() },
    ];
  } else if (subject === 'Order Cancel Request Approved') {
    templateName = WATI_ORDER_CANCEL_TEMPLATE_NAME;
    broadcastName = WATI_ORDER_CANCEL_BROADCAST_NAME;
    orderNoticeMessage = 'Your order cancel request has been approved. Your order is now cancelled.';
    parameters = [
      { name: '1', value: `${orderData.fullName}` },
      { name: '17', value: orderNoticeMessage },
      { name: '2', value: orderData.id.toString() },
      { name: '3', value: orderData.tokenNumber },
      { name: '4', value: new Date(orderData.createdAt).toLocaleDateString() },
      { name: '5', value: orderData.status },
      { name: '6', value: orderData.productName },
      { name: '7', value: Number(orderData.advanceAmount).toLocaleString() },
    ];
  } else if (subject.includes('Updated to Rejected')) {
    templateName = WATI_ORDER_REJECTED_TEMPLATE_NAME;
    broadcastName = WATI_ORDER_REJECTED_BROADCAST_NAME;
    orderNoticeMessage = `Your order has been rejected.`;
    parameters = [
      { name: '1', value: `${orderData.fullName}` },
      { name: '17', value: orderNoticeMessage },
      { name: '2', value: orderData.id.toString() },
      { name: '3', value: orderData.tokenNumber },
      { name: '4', value: new Date(orderData.createdAt).toLocaleDateString() },
      { name: '5', value: orderData.status },
      { name: '6', value: orderData.productName },
      { name: '7', value: Number(orderData.advanceAmount).toLocaleString() },
      { name: '9', value: `Rejection Reason: ${orderData.rejectionReason || "N/A"}` },
    ];
  } else if (subject.startsWith('Order Status Updated to')) {
    templateName = WATI_ORDER_STATUS_UPDATE_TEMPLATE_NAME;
    broadcastName = WATI_ORDER_STATUS_UPDATE_BROADCAST_NAME;
    orderNoticeMessage = `Great news! Your order is now ${orderData.status}.`;
    parameters = [
      { name: '1', value: `${orderData.fullName}` },
      { name: '17', value: orderNoticeMessage },
      { name: '2', value: orderData.id.toString() },
      { name: '3', value: orderData.tokenNumber },
      { name: '4', value: new Date(orderData.createdAt).toLocaleDateString() },
      { name: '5', value: orderData.status },
      { name: '6', value: orderData.productName },
      { name: '7', value: Number(orderData.advanceAmount).toLocaleString() },
    ];
  } else {
    throw new Error('Invalid subject for WhatsApp notification');
  }

  const body = {
    template_name: templateName,
    broadcast_name: broadcastName,
    parameters,
  };

  try {
    const response = await axios.post(url, body, {
      headers: {
        'Authorization': `Bearer ${WATI_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to send WhatsApp message');
  }
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
        notIn: ['Delivered', 'Cancelled', 'Rejected'],
      },
    });

    if (search) {
      where.AND.push({
        OR: [
          { id: isNaN(search) ? undefined : Number(search) },
          { tokenNumber: { contains: search } },
          { fullName: { contains: search } },
          { productName: { contains: search } },
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
          { tokenNumber: { contains: search } },
          { fullName: { contains: search } },
          { productName: { contains: search } },
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
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = req.query.search || '';

  if (isNaN(page) || isNaN(limit) || page < 1 || limit < 1) {
    return res.status(400).json({ error: 'Invalid page or limit parameters' });
  }

  const skip = (page - 1) * limit;
  const take = limit;

  try {
    const where = {
      AND: [
        { status: 'Delivered' },
        { status: { notIn: ['Cancelled', 'Rejected'] } },
      ],
    };

    if (search) {
      const orConditions = [
        { tokenNumber: { contains: search } },
        { fullName: { contains: search } },
        { productName: { contains: search } },
      ];

      if (!isNaN(search)) {
        orConditions.push({ id: Number(search) });
      }

      where.AND.push({ OR: orConditions });
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
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    console.error('Error fetching delivered orders:', error);
    res.status(500).json({ error: 'Failed to fetch delivered orders', details: error.message });
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
          { tokenNumber: { contains: search } },
          { fullName: { contains: search } },
          { productName: { contains: search } },
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

    const requiredFields = [
      'phone', 'fullName', 'cnic', 'city', 'area', 'address', 'paymentMethod',
      'productName', 'totalDealValue', 'advanceAmount', 'monthlyAmount', 'months'
    ];
    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null) {
        return res.status(400).json({ error: `${field} is required` });
      }
    }

    if (data.email && !isValidEmail(data.email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (data.alternativePhone && !/^\d{11,}$/.test(data.alternativePhone)) {
      return res.status(400).json({ error: "Invalid alternative number format" });
    }

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

    // Look up the product to get category_id and subcategory_id
    const product = await prisma.product.findFirst({
      where: { name: data.productName },
      select: { id: true, category_id: true, subcategory_id: true },
    });

    if (!product) {
      return res.status(400).json({ error: `Product "${data.productName}" not found` });
    }

    let referralType = null;
    let referralDetails = null;
    if (data.referralSource && typeof data.referralSource === 'object') {
      referralType = data.referralSource.type || 'unknown';
      referralDetails = data.referralSource.details ? JSON.stringify(data.referralSource.details) : null;
      if (typeof referralType !== 'string' || referralType.length > 100) {
        return res.status(400).json({ error: 'referralType must be a string with max length 100' });
      }
      if (referralDetails && referralDetails.length > 65535) {
        return res.status(400).json({ error: 'referralDetails exceeds maximum length' });
      }
    }

    const existingOrder = await prisma.createOrder.findFirst({
      where: {
        phone: data.phone,
        productName: data.productName,
        status: {
          notIn: ['Cancelled', 'Rejected'],
        },
      },
    });

    if (existingOrder) {
      return res.status(400).json({
        error: `An order for the product "${data.productName}" has already been placed. Please review your existing orders or contact support for assistance.`,
      });
    }

    let customerId = null;
    if (data.customerID) {
      customerId = data.customerID;
    }

    const tokenNumber = crypto.randomBytes(4).toString('hex').toUpperCase();

    const newOrder = await prisma.createOrder.create({
      data: {
        customerId,
        email: data.email || null,
        phone: data.phone,
        alternativePhone: data.alternativePhone || null,
        fullName: data.fullName,
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
        tokenNumber,
        referralType,
        referralDetails,
        category_id: product.category_id,
        subcategory_id: product.subcategory_id,
      },
    });

    await prisma.notification.create({
      data: {
        orderId: newOrder.id,
        type: 'NEW_ORDER',
        message: `New order #${newOrder.id} placed for ${newOrder.productName} by ${newOrder.fullName}`,
      },
    });

    await sendOrderWhatsApp(newOrder.phone, 'Order Confirmation', newOrder);
    if (newOrder.email) await sendEmail(newOrder.email, 'Order Confirmation', newOrder);

    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order', details: error.message });
  }
};

const requestCancelOrder = async (req, res) => {
  const { id } = req.params;

  try {
    const order = await prisma.createOrder.findUnique({
      where: { id: Number(id) },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.cancelRequest === 'pending') {
      return res.status(400).json({ error: 'Cancel request already pending' });
    }

    const updatedOrder = await prisma.createOrder.update({
      where: { id: Number(id) },
      data: { cancelRequest: 'pending' },
    });

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error('Error requesting order cancellation:', error);
    res.status(500).json({ error: 'Failed to request order cancellation' });
  }
};

const trackOrder = async (req, res) => {
  try {
    const { tokenOrId, phone } = req.body;

    if (!tokenOrId || !phone) {
      return res.status(400).json({ error: 'order no or token no and phone are required' });
    }

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

    await sendOrderWhatsApp(order.phone, 'Order Tracking Details', order);
    if (order.email) await sendEmail(order.email, 'Order Tracking Details', order);

    res.status(200).json(order);
  } catch (error) {
    console.error('Error tracking order:', error);
    res.status(500).json({ error: 'Failed to track order', details: error.message });
  }
};

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
          { tokenNumber: { contains: search } },
          { fullName: { contains: search } },
          { productName: { contains: search } },
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
    await sendOrderWhatsApp(updatedOrder.phone, 'Order Cancel Request Approved', updatedOrder);
    if (updatedOrder.email) await sendEmail(updatedOrder.email, 'Order Cancel Request Approved', updatedOrder);
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

    const subject = status === 'Rejected' ? 'Order Status Updated to Rejected' : `Order Status Updated to ${status}`;
    await sendOrderWhatsApp(updatedOrder.phone, subject, updatedOrder);

    if (updatedOrder.email) {
      await sendEmail(updatedOrder.email, subject, updatedOrder);
    }

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
          { tokenNumber: { contains: search } },
          { fullName: { contains: search } },
          { productName: { contains: search } },
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

async function getMyOrders(req, res) {
  const { customerId } = req.params;
  const userId = customerId;
  try {
    const orders = await prisma.createOrder.findMany({
      where: { customerId: userId },
    });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { createOrders, trackOrder, getOrders, getPendingOrders, getDeliveredOrders, getOrderById, getCancelRequests, approveCancel, getCancelledOrders, updateOrderStatus, getRejectedOrders, requestCancelOrder, getMyOrders };