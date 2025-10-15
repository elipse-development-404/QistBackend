const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const createReview = async (req, res) => {
  try {
    const { productId, comment, rating } = req.body;
    const customer = req.customer;

    if (!productId || !comment || !rating) {
      return res.status(400).json({ error: "Product ID, comment, and rating are required" });
    }

    if (isNaN(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const order = await prisma.createOrder.findFirst({
      where: {
        customerId: customer.customerId,
        productName: { equals: (await prisma.product.findUnique({ where: { id: parseInt(productId) } })).name },
        status: "Delivered",
      },
    });

    if (!order) {
      return res.status(403).json({ error: "You can only review products with delivered orders" });
    }

    const existingReview = await prisma.review.findFirst({
      where: { customerId: customer.customerId, productId: parseInt(productId), orderId: order.id },
    });

    if (existingReview) {
      return res.status(400).json({ error: "You have already reviewed this product" });
    }

    const review = await prisma.review.create({
      data: {
        customerId: customer.customerId,
        productId: parseInt(productId),
        orderId: order.id,
        comment,
        rating: parseInt(rating),
        status: "PENDING",
      },
      include: { customer: { select: { fullName: true } }, product: { select: { name: true } } },
    });

    let mediaUrls = [];
    if (req.files && req.files.length > 0) {
      const medias = await Promise.all(
        req.files.map(file =>
          prisma.reviewMedia.create({
            data: {
              reviewId: review.id,
              mediaUrl: file.path,
              cloudinaryId: file.filename,
            },
          })
        )
      );
      mediaUrls = medias.map(m => m.mediaUrl);
    }

    res.status(201).json({ ...review, mediaUrls });
  } catch (error) {
    console.error("Error creating review:", error);
    res.status(500).json({ error: "Failed to create review", details: error.message });
  }
};

const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { comment, rating } = req.body;
    const removedMedia = Array.isArray(req.body.removedMedia) ? req.body.removedMedia : (req.body.removedMedia ? [req.body.removedMedia] : []);
    const customer = req.customer;

    if (!comment || !rating) {
      return res.status(400).json({ error: "Comment and rating are required" });
    }

    if (isNaN(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const review = await prisma.review.findUnique({ where: { id: parseInt(reviewId) } });
    if (!review || review.customerId !== customer.customerId) {
      return res.status(403).json({ error: "You can only edit your own reviews" });
    }

    if (removedMedia.length > 0) {
      await prisma.reviewMedia.deleteMany({
        where: {
          reviewId: review.id,
          mediaUrl: { in: removedMedia },
        },
      });
    }

    const updatedReview = await prisma.review.update({
      where: { id: parseInt(reviewId) },
      data: {
        comment,
        rating: parseInt(rating),
        status: "PENDING",
        updatedAt: new Date(),
      },
      include: { customer: { select: { fullName: true } }, product: { select: { name: true } } },
    });

    let newMediaUrls = [];
    if (req.files && req.files.length > 0) {
      const medias = await Promise.all(
        req.files.map(file =>
          prisma.reviewMedia.create({
            data: {
              reviewId: updatedReview.id,
              mediaUrl: file.path,
              cloudinaryId: file.filename,
            },
          })
        )
      );
      newMediaUrls = medias.map(m => m.mediaUrl);
    }

    // Fetch current media
    const currentMedia = await prisma.reviewMedia.findMany({
      where: { reviewId: updatedReview.id },
      select: { mediaUrl: true },
    });

    const mediaUrls = currentMedia.map(m => m.mediaUrl);

    res.status(200).json({ ...updatedReview, mediaUrls });
  } catch (error) {
    console.error("Error updating review:", error);
    res.status(500).json({ error: "Failed to update review", details: error.message });
  }
};

const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const customer = req.customer;

    const review = await prisma.review.findUnique({ where: { id: parseInt(reviewId) } });
    if (!review || (review.customerId !== customer.customerId && !req.user)) {
      return res.status(403).json({ error: "Unauthorized to delete this review" });
    }

    await prisma.review.delete({ where: { id: parseInt(reviewId) } });
    res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({ error: "Failed to delete review", details: error.message });
  }
};

const getReviewsByProduct = async (req, res) => {
  const { productId } = req.params;
  const customer = req.customer;

  try {
    const where = { productId: parseInt(productId), status: "APPROVED" };

    const reviews = await prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { fullName: true } },
        product: { select: { name: true } },
        ReviewMedia: { select: { mediaUrl: true } },
        userLikes: customer
          ? {
              where: { customerId: customer.customerId },
              select: { isLike: true },
            }
          : undefined,
      },
    });

    const totalItems = await prisma.review.count({ where });

    const formattedReviews = reviews.map((review) => ({
      ...review,
      mediaUrls: review.ReviewMedia.map(m => m.mediaUrl),
      userReaction: review.userLikes?.[0]?.isLike
        ? "like"
        : review.userLikes?.[0]?.isLike === false
        ? "dislike"
        : null,
    }));

    res.status(200).json({
      data: formattedReviews,
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews", details: error.message });
  }
};

const getUserReviews = async (req, res) => {
  const { productId } = req.params;
  const customer = req.customer;

  try {
    const userReviews = await prisma.review.findMany({
      where: {
        customerId: customer.customerId,
        productId: parseInt(productId),
      },
      include: { 
        customer: { select: { fullName: true } }, 
        product: { select: { name: true } },
        ReviewMedia: { select: { mediaUrl: true } },
      },
    });

    const formattedUserReviews = userReviews.map(review => ({
      ...review,
      mediaUrls: review.ReviewMedia.map(m => m.mediaUrl),
    }));

    res.status(200).json({ userReviews: formattedUserReviews });
  } catch (error) {
    console.error("Error fetching user reviews:", error);
    res.status(500).json({ error: "Failed to fetch user reviews", details: error.message });
  }
};

const getAllReviews = async (req, res) => {
  const { page = 1, limit = 10, search = "", status = "all" } = req.query;
  const skip = (page - 1) * limit;

  try {
    const where = {};
    if (search) {
      where.OR = [
        { comment: { contains: search } },
        { customer: { fullName: { contains: search } } },
        { product: { name: { contains: search } } },
      ];
    }
    if (status !== "all") {
      where.status = status.toUpperCase();
    }

    const reviews = await prisma.review.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      orderBy: { createdAt: "desc" },
      include: { 
        customer: { select: { fullName: true } }, 
        product: { select: { name: true } },
        ReviewMedia: { select: { mediaUrl: true } },
      },
    });

    const totalItems = await prisma.review.count({ where });

    const formattedReviews = reviews.map(review => ({
      ...review,
      mediaUrls: review.ReviewMedia.map(m => m.mediaUrl),
    }));

    res.status(200).json({
      data: formattedReviews,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews", details: error.message });
  }
};

const updateReviewStatus = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { status } = req.params;

    if (!status || !["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ error: "Valid status is required (APPROVED or REJECTED)" });
    }

    const review = await prisma.review.update({
      where: { id: parseInt(reviewId) },
      data: {
        status,
        updatedAt: new Date(),
      },
      include: { customer: { select: { fullName: true } }, product: { select: { name: true } } },
    });

    res.status(200).json(review);
  } catch (error) {
    console.error("Error updating review status:", error);
    res.status(500).json({ error: "Failed to update review status", details: error.message });
  }
};

const likeDislikeReview = async (req, res) => {
  try {
    const { reviewId, isLike } = req.params;
    const customer = req.customer;

    const review = await prisma.review.findUnique({ where: { id: parseInt(reviewId) } });
    if (!review || review.status !== "APPROVED") {
      return res.status(400).json({ error: "Review not found or not approved" });
    }

    const existingLike = await prisma.userReviewLike.findUnique({
      where: { customerId_reviewId: { customerId: customer.customerId, reviewId: parseInt(reviewId) } },
    });

    // Start a transaction to ensure atomicity
    const updatedReview = await prisma.$transaction(async (tx) => {
      let data = {};

      if (existingLike) {
        if (existingLike.isLike === (isLike === "like")) {
          // User clicked the same action again, remove the reaction
          await tx.userReviewLike.delete({
            where: { customerId_reviewId: { customerId: customer.customerId, reviewId: parseInt(reviewId) } },
          });
          data = { [isLike === "like" ? "likes" : "dislikes"]: { decrement: 1 } };
        } else {
          // User switched from like to dislike or vice versa
          await tx.userReviewLike.update({
            where: { customerId_reviewId: { customerId: customer.customerId, reviewId: parseInt(reviewId) } },
            data: { isLike: isLike === "like" },
          });
          data = {
            likes: { increment: isLike === "like" ? 1 : -1 },
            dislikes: { increment: isLike === "like" ? -1 : 1 },
          };
        }
      } else {
        // No existing reaction, create a new one
        await tx.userReviewLike.create({
          data: {
            customerId: customer.customerId,
            reviewId: parseInt(reviewId),
            isLike: isLike === "like",
          },
        });
        data = { [isLike === "like" ? "likes" : "dislikes"]: { increment: 1 } };
      }

      // Update review with new like/dislike counts
      return await tx.review.update({
        where: { id: parseInt(reviewId) },
        data,
        include: {
          customer: { select: { fullName: true } },
          product: { select: { name: true } },
          ReviewMedia: { select: { mediaUrl: true } },
          userLikes: {
            where: { customerId: customer.customerId },
            select: { isLike: true },
          },
        },
      });
    });

    const formattedReview = {
      ...updatedReview,
      mediaUrls: updatedReview.ReviewMedia.map(m => m.mediaUrl),
      userReaction: updatedReview.userLikes?.[0]?.isLike
        ? "like"
        : updatedReview.userLikes?.[0]?.isLike === false
        ? "dislike"
        : null,
    };

    res.status(200).json(formattedReview);
  } catch (error) {
    console.error(`Error ${isLike === "like" ? "liking" : "disliking"} review:`, error);
    res.status(500).json({ error: `Failed to ${isLike === "like" ? "like" : "dislike"} review`, details: error.message });
  }
};

const checkReviewEligibility = async (req, res) => {
  try {
    const { productId } = req.params;
    const customer = req.customer;

    const order = await prisma.createOrder.findFirst({
      where: {
        customerId: customer.customerId,
        productName: { equals: (await prisma.product.findUnique({ where: { id: parseInt(productId) } })).name },
        status: "Delivered",
      },
    });

    res.status(200).json({ canReview: !!order });
  } catch (error) {
    console.error("Error checking review eligibility:", error);
    res.status(500).json({ error: "Failed to check review eligibility", details: error.message });
  }
};

module.exports = {
  createReview,
  updateReview,
  deleteReview,
  getReviewsByProduct,
  getUserReviews,
  getAllReviews,
  updateReviewStatus,
  likeDislikeReview,
  checkReviewEligibility,
};