const express = require("express");
const router = express.Router();
const { body, query } = require("express-validator");
const { getTags, createTag, updateTag, toggleTagStatus, deleteTag, getAllTagsPagination } = require("../controllers/tagController");

// Get all tags
router.get("/tags", getTags);

router.get(
  "/all-tags-pagination",
  [
    query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
    query("limit").optional().isInt({ min: 1 }).withMessage("Limit must be a positive integer"),
    query("search").optional().isString().trim().withMessage("Search must be a string"),
    query("status")
      .optional()
      .isIn(["all", "active", "inactive"])
      .withMessage("Status must be 'all', 'active', or 'inactive'"),
  ],
  getAllTagsPagination
);

// Create a new tag
router.post(
  "/tags",
  [
    body("name")
      .notEmpty()
      .withMessage("Tag name is required")
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage("Tag name must be between 1 and 50 characters"),
  ],
  createTag
);

// Update a tag
router.put(
  "/tags/:id",
  [
    body("name")
      .notEmpty()
      .withMessage("Tag name is required")
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage("Tag name must be between 1 and 50 characters"),
    body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
  ],
  updateTag
);

// Toggle tag status
router.patch(
  "/tags/:id/toggle",
  [
    body("isActive").isBoolean().withMessage("isActive must be a boolean"),
  ],
  toggleTagStatus
);

// Delete a tag
router.delete("/tags/:id", deleteTag);

module.exports = router;