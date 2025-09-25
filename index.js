const express = require('express');
const cors = require('cors');
const authRoutes = require('./src/routes/authRoutes');
const categoryRoutes = require('./src/routes/categoryRoutes');
const subcategoryRoutes = require('./src/routes/subcategoryRoutes');
const productRoutes = require('./src/routes/productRoutes');
const productInstallmentRoutes = require('./src/routes/productInstallmentRoutes');
const dealRoutes = require('./src/routes/dealRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const bannerRoutes = require('./src/routes/bannerRoutes');
const productDealRoutes = require('./src/routes/productDealRoutes');
const topCategoryRoutes = require('./src/routes/topCategoryRoutes');
const authCustomer = require('./src/routes/authCustomer');
const faqsRoutes = require('./src/routes/faqsRoutes');
const aboutRoutes = require('./src/routes/aboutRoutes');
const termsAndPrivacyRoutes = require('./src/routes/termsAndPrivacyRoutes');
const returnsRefundsPolicyRoutes = require('./src/routes/returnsRefundsPolicyRoutes');
const verificationProcessRoutes = require('./src/routes/verificationProcessRoutes');
const deliveryPolicyRoutes = require('./src/routes/deliveryPolicyRoutes');
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  process.exit(0);
});