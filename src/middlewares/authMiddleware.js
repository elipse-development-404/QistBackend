const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      adminId: decoded.adminId,
      fullName: decoded.fullName,
      email: decoded.email,
      profilePicture: decoded.profilePicture,
      isSuper: decoded.isSuper,
      isAdmin: decoded.isAdmin,
      isAccess: decoded.isAccess,
    };
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { authenticateToken };