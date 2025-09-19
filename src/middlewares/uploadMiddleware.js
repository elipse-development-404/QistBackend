
const multer = require('multer');
const { storage } = require('../Config/cloudinary');

const upload = multer({ storage });

module.exports = upload;
