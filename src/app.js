const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const subcategoryRoutes = require('./routes/subcategoryRoutes');
const productRoutes = require('./routes/productRoutes');
const productInstallmentRoutes = require('./routes/productInstallmentRoutes');
const dealRoutes = require('./routes/dealRoutes');
const orderRoutes = require('./routes/orderRoutes');
const bannerRoutes = require('./routes/bannerRoutes');
const productDealRoutes = require('./routes/productDealRoutes');
const topCategoryRoutes = require('./routes/topCategoryRoutes');
const authCustomer = require('./routes/authCustomer');
const faqsRoutes = require('./routes/faqsRoutes');
const aboutRoutes = require('./routes/aboutRoutes');
const termsAndPrivacyRoutes = require('./routes/termsAndPrivacyRoutes');
const returnsRefundsPolicyRoutes = require('./routes/returnsRefundsPolicyRoutes');
const verificationProcessRoutes = require('./routes/verificationProcessRoutes');
const deliveryPolicyRoutes = require('./routes/deliveryPolicyRoutes');
const visitUsRoutes = require('./routes/visitUsRoutes');
const qaRoutes = require('./routes/qaRoutes');
const agreementRoutes = require('./routes/agreementRoutes');
const customerAdminRoutes = require('./routes/customerAdminRoutes');
const organizationSettingsRoutes = require('./routes/organizationSettingsRoutes');
const contactRoutes = require('./routes/contactRoutes');
const adminRoutes = require('./routes/adminRoutes');
const analyticsCountRoutes = require('./routes/analyticsCountRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const rolesRoutes = require('./routes/rolesRoutes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
  res.status(200).json({ status: 'success', message: 'Server is running!!' });
});

app.use('/api', authRoutes);
app.use('/api', categoryRoutes);
app.use('/api', subcategoryRoutes);
app.use('/api', productRoutes);
app.use('/api', dealRoutes);
app.use('/api', productDealRoutes);
app.use('/api', productInstallmentRoutes);
app.use('/api', orderRoutes);
app.use('/api', bannerRoutes);
app.use('/api', topCategoryRoutes);
app.use('/api', authCustomer);
app.use('/api', faqsRoutes);
app.use('/api', aboutRoutes);
app.use('/api', termsAndPrivacyRoutes);
app.use('/api', returnsRefundsPolicyRoutes);
app.use('/api', verificationProcessRoutes);
app.use('/api', deliveryPolicyRoutes);
app.use('/api', visitUsRoutes);
app.use('/api', qaRoutes);
app.use('/api', agreementRoutes);
app.use('/api', customerAdminRoutes);
app.use('/api', organizationSettingsRoutes);
app.use('/api', contactRoutes);
app.use('/api', adminRoutes);
app.use('/api', analyticsCountRoutes);
app.use('/api', notificationRoutes);
app.use('/api', rolesRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  process.exit(0);
});