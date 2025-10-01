const { validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const getCustomers = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    status = "all",
    sort = "id",
    order = "desc",
  } = req.query;
  const offset = (page - 1) * limit;

  try {
    // Filters
    const where = {};
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { cnic: { contains: search } },
        { id: isNaN(search) ? undefined : Number(search) },
      ].filter(Boolean);
    }
    if (status === "active") where.isActive = true;
    if (status === "inactive") where.isActive = false;

    // Sorting
    const validSortFields = ["id", "firstName", "isActive"];
    const sortField = validSortFields.includes(sort) ? sort : "id";
    const sortOrder = order.toLowerCase() === "desc" ? "desc" : "asc";

    // Fetch customers
    const customers = await prisma.customers.findMany({
      where,
      skip: Number(offset),
      take: Number(limit),
      orderBy: { [sortField]: sortOrder },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        cnic: true,
        isVerified: true,
        isActive: true,
      },
    });

    // Count total
    const totalItems = await prisma.customers.count({ where });

    res.status(200).json({
      data: customers,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
};

const updateCustomer = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { firstName, lastName, email, phone, cnic, isActive } = req.body;
  const { id } = req.params;

  try {
    const customer = await prisma.customers.findUnique({ where: { id: Number(id) } });
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const updated = await prisma.customers.update({
      where: { id: Number(id) },
      data: { firstName, lastName, email, phone, cnic, isActive },
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update customer" });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.customers.delete({ where: { id: Number(id) } });
    res.status(200).json({ message: "Customer deleted successfully" });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Customer not found" });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to delete customer" });
  }
};

const toggleCustomerActive = async (req, res) => {
  const { id } = req.params;
  try {
    const customer = await prisma.customers.findUnique({ where: { id: Number(id) } });
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const updated = await prisma.customers.update({
      where: { id: Number(id) },
      data: { isActive: !customer.isActive },
    });
    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to toggle customer status" });
  }
};

module.exports = {
  getCustomers,
  updateCustomer,
  deleteCustomer,
  toggleCustomerActive,
};