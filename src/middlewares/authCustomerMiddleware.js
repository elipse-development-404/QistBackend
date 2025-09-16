const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const authenticateCustomerToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, customer) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.customer = customer;
    next();
  });
};

module.exports = { authenticateCustomerToken };