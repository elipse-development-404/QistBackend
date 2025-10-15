const express = require("express");
const {
  createReview,
  updateReview,
  deleteReview,
  getReviewsByProduct,
  getUserReviews,
  getAllReviews,
  updateReviewStatus,
  likeDislikeReview,
  checkReviewEligibility,
} = require("../controllers/reviewController");
const { authenticateCustomerToken } = require("../middlewares/authCustomerMiddleware");
const { authenticateToken } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");

const router = express.Router();

router.post("/reviews", authenticateCustomerToken, upload.array("media", 5), createReview);
router.put("/reviews/:reviewId", authenticateCustomerToken, upload.array("media", 5), updateReview);
router.delete("/reviews/:reviewId", authenticateCustomerToken, deleteReview);
router.get("/reviews/product/:productId", getReviewsByProduct);
router.get("/reviews/user/:productId", authenticateCustomerToken, getUserReviews);
router.get("/reviews/all", authenticateToken, getAllReviews);
router.put("/reviews/:reviewId/:status", authenticateToken, updateReviewStatus);
router.post("/reviews/:reviewId/:isLike", authenticateCustomerToken, likeDislikeReview);
router.get("/orders/delivered/:productId", authenticateCustomerToken, checkReviewEligibility);

module.exports = router;