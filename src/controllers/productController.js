const { PrismaClient } = require("@prisma/client");
const { validationResult } = require('express-validator');

const prisma = new PrismaClient();

const createProduct = async (req, res) => {
  try {
    let formattedData = {}
    if (req.body.formattedData) {
      try {
        formattedData = JSON.parse(req.body.formattedData)
      } catch (err) {
        return res.status(400).json({ message: "Invalid formattedData" })
      }
    }

    const {
      category_id,
      subcategory_id,
      name,
      brand,
      short_description,
      long_description,
      stock,
      status,
      is_approved,
      isDeal,
      installments
    } = formattedData

    const uploadedFiles = req.files?.map(file => ({
      fileName: file.originalname,
      filePath: file.path,
      size: file.size,
      cloudinaryId: file.filename
    })) || [];

    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const productCreation = await prisma.product.create({
      data: {
        category_id: parseInt(category_id),
        subcategory_id: parseInt(subcategory_id),
        name,
        slugName: slug,
        status,
        brand,
        short_description,
        long_description,
        stock,
        is_approved,
        isDeal,
        ProductImage: {
          create: uploadedFiles.map((file) => ({
            url: file.filePath,
          }))
        },
        ProductInstallments: {
          create: installments.map((ins) => ({
            totalPrice: ins.totalPrice,
            monthlyAmount: ins.monthlyAmount,
            advance: ins.advance,
            months: ins.months,
            isActive: true,
          }))
        }
      }
    })

    res.status(201).json(productCreation)

  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}

// controllers/productController.js (corrected bulkCreateProducts)

// controllers/productController.js (updated bulkCreateProducts with duplicate check)

const bulkCreateProducts = async (req, res) => {
  const { products } = req.body;
  try {
    // Validate input
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: 'No products provided' });
    }

    const created = await prisma.$transaction(async (tx) => {
      const results = [];
      const skippedProducts = [];

      // Fetch all existing categories and subcategories upfront
      const existingCategories = await tx.categories.findMany({
        select: { id: true, name: true, slugName: true },
      });
      const existingSubcategories = await tx.subcategories.findMany({
        select: { id: true, name: true, category_id: true, slugName: true },
      });

      // Fetch all existing products to check for duplicates
      const existingProducts = await tx.product.findMany({
        select: { id: true, name: true, category_id: true, subcategory_id: true },
      });

      // Create maps for quick lookup
      const categoryMap = new Map(existingCategories.map(cat => [cat.name.toLowerCase(), cat]));
      const subcategoryMap = new Map(
        existingSubcategories.map(sub => [`${sub.category_id}_${sub.name.toLowerCase()}`, sub])
      );
      const productMap = new Map(
        existingProducts.map(prod => [
          `${prod.name.toLowerCase()}_${prod.category_id}_${prod.subcategory_id}`,
          prod
        ])
      );

      const productsToCreate = [];
      const categoriesToCreate = [];
      const subcategoriesToCreate = [];

      // Process products
      for (const data of products) {
        // Validate required fields
        if (!data.name || !data.category || !data.subcategory || !data.price) {
          throw new Error(`Missing required fields for product: ${data.name || 'unknown'}`);
        }

        // Parse price (handle commas)
        let price = data.price.toString().replace(/,/g, '');
        price = parseFloat(price);
        if (isNaN(price) || price <= 0) {
          throw new Error(`Invalid price for product: ${data.name}`);
        }

        // Find or prepare category
        const categoryKey = data.category.toLowerCase();
        let category = categoryMap.get(categoryKey);
        if (!category) {
          const categorySlug = data.category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          categoriesToCreate.push({
            name: data.category,
            slugName: categorySlug,
            description: '',
            isActive: true,
          });
        }

        // Find or prepare subcategory
        let subcategory;
        if (category) {
          subcategory = subcategoryMap.get(`${category.id}_${data.subcategory.toLowerCase()}`);
        }
        if (!subcategory) {
          const subcategorySlug = data.subcategory.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          subcategoriesToCreate.push({
            categoryName: data.category,
            name: data.subcategory,
            slugName: subcategorySlug,
            description: '',
            isActive: true,
          });
        }

        // Check for existing product
        const productKey = category && subcategory 
          ? `${data.name.toLowerCase()}_${category.id}_${subcategory.id}`
          : null;
        if (productKey && productMap.has(productKey)) {
          skippedProducts.push(data.name);
          continue; // Skip this product if it already exists
        }

        // Generate installments
        const installments = generateInstallments(data.category, price);
        if (installments.length === 0) {
          throw new Error(`No installment plans generated for product: ${data.name}`);
        }

        // Prepare product for creation
        const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        productsToCreate.push({
          categoryName: data.category,
          subcategoryName: data.subcategory,
          category_id: category ? category.id : null,
          subcategory_id: subcategory ? subcategory.id : null,
          name: data.name,
          slugName: slug,
          status: data.status ?? true,
          brand: data.brand || data.subcategory,
          short_description: data.short_description || '',
          long_description: data.long_description || '',
          stock: data.stock ?? true,
          is_approved: data.is_approved ?? false,
          isDeal: data.isDeal ?? false,
          installments,
        });
      }

      // Create new categories
      for (const cat of categoriesToCreate) {
        const newCategory = await tx.categories.create({ data: cat });
        categoryMap.set(cat.name.toLowerCase(), newCategory);
      }

      // Create new subcategories
      for (const sub of subcategoriesToCreate) {
        const category = categoryMap.get(sub.categoryName.toLowerCase());
        if (!category) {
          throw new Error(`Category not found for subcategory: ${sub.name}`);
        }
        const newSubcategory = await tx.subcategories.create({
          data: {
            category_id: category.id,
            name: sub.name,
            slugName: sub.slugName,
            description: sub.description,
            isActive: sub.isActive,
          },
        });
        subcategoryMap.set(`${category.id}_${sub.name.toLowerCase()}`, newSubcategory);
      }

      // Update product category_id and subcategory_id
      for (const product of productsToCreate) {
        const category = categoryMap.get(product.categoryName.toLowerCase());
        if (!category) {
          throw new Error(`Category not found for product: ${product.name}`);
        }
        const subcategory = subcategoryMap.get(`${category.id}_${product.subcategoryName.toLowerCase()}`);
        if (!subcategory) {
          throw new Error(`Subcategory not found for product: ${product.name}`);
        }
        product.category_id = category.id;
        product.subcategory_id = subcategory.id;

        // Double-check for duplicates after resolving category/subcategory
        const productKey = `${product.name.toLowerCase()}_${product.category_id}_${product.subcategory_id}`;
        if (productMap.has(productKey)) {
          skippedProducts.push(product.name);
          continue; // Skip if product exists
        }
      }

      // Create products
      for (const product of productsToCreate) {
        const createdProduct = await tx.product.create({
          data: {
            category_id: product.category_id,
            subcategory_id: product.subcategory_id,
            name: product.name,
            slugName: product.slugName,
            status: product.status,
            brand: product.brand,
            short_description: product.short_description,
            long_description: product.long_description,
            stock: product.stock,
            is_approved: product.is_approved,
            isDeal: product.isDeal,
            ProductImage: { create: [] },
            ProductInstallments: {
              create: product.installments.map(ins => ({
                totalPrice: ins.totalPrice,
                monthlyAmount: ins.monthlyAmount,
                advance: ins.advance,
                months: ins.months,
                isActive: ins.isActive,
              })),
            },
          },
        });
        results.push(createdProduct);
      }

      return { created: results, skipped: skippedProducts };
    }, { timeout: 15000 }); // 15-second timeout

    res.status(201).json({
      message: `Products created successfully. ${created.created.length} created, ${created.skipped.length} skipped.`,
      created: created.created,
      skipped: created.skipped,
    });
  } catch (error) {
    console.error('Error creating bulk products:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Helper function to generate installments (unchanged)
function generateInstallments(categoryName, price) {
  const category = categoryName.toLowerCase();
  let plans = [];

  if (category === 'mobiles' && price <= 50000) {
    plans = [
      { months: 3, profit: 0.20, advance: 0.35 },
      { months: 6, profit: 0.35, advance: 0.24 },
      { months: 9, profit: 0.45, advance: 0.20 },
      { months: 12, profit: 0.55, advance: 0.15 },
    ];
  } else if (price > 50000 && price <= 100000) {
    plans = [
      { months: 3, profit: 0.20, advance: 0.40 },
      { months: 6, profit: 0.35, advance: 0.35 },
      { months: 9, profit: 0.45, advance: 0.30 },
      { months: 12, profit: 0.55, advance: 0.25 },
    ];
  } else if (price > 100000) {
    plans = [
      { months: 3, profit: 0.20, advance: 0.40 },
      { months: 6, profit: 0.35, advance: 0.35 },
      { months: 9, profit: 0.45, advance: 0.30 },
      { months: 12, profit: 0.55, advance: 0.25 },
      { months: 24, profit: 0.85, advance: 0.25 },
    ];
  } else {
    throw new Error(`No installment plans available for category: ${categoryName} and price: ${price}`);
  }

  return plans.map(plan => {
    const advanceAmount = Math.round(price * plan.advance * 100) / 100;
    const profitAmount = Math.round(price * plan.profit * 100) / 100;
    const totalPrice = Math.round((price + profitAmount) * 100) / 100;
    const monthlyAmount = Math.round(((totalPrice - advanceAmount) / plan.months) * 100) / 100;
    return {
      advance: advanceAmount,
      totalPrice,
      monthlyAmount,
      months: plan.months,
      isActive: true,
    };
  });
}

const bulkUpdateProducts = async (req, res) => {
  const { ids, updates } = req.body;
  try {
    if (updates) {
      await prisma.product.updateMany({
        where: { id: { in: ids } },
        data: {
          status: updates.status !== undefined ? updates.status : undefined,
          stock: updates.stock !== undefined ? updates.stock : undefined,
        },
      });
    }
    // For new images
    const uploadedFiles = req.files?.map(file => file.path) || [];
    if (uploadedFiles.length > 0) {
      const newImagesData = ids.flatMap(id => uploadedFiles.map(url => ({ product_id: id, url })));
      await prisma.productImage.createMany({ data: newImagesData });
    }
    // For new installment (parse from formData if sent)
    ids.forEach(id => {
      const newInstStr = req.body[`newInstallment_${id}`];
      if (newInstStr) {
        const newInst = JSON.parse(newInstStr);
        prisma.productInstallments.create({
          data: {
            product_id: id,
            totalPrice: parseFloat(newInst.totalPrice),
            monthlyAmount: parseFloat(newInst.monthlyAmount),
            advance: parseFloat(newInst.advance),
            months: parseInt(newInst.months),
            isActive: true,
          }
        });
      }
    });
    res.status(200).json({ message: 'Products updated successfully' });
  } catch (error) {
    console.error('Error bulk updating products:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const bulkDeleteProducts = async (req, res) => {
  const { ids } = req.body;
  try {
    await prisma.product.deleteMany({
      where: { id: { in: ids } },
    });
    res.status(200).json({ message: 'Products deleted successfully' });
  } catch (error) {
    console.error('Error bulk deleting products:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};


const getProductPagination = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    subcategory_id,
    minPrice,
    maxPrice,
    sort = "createdAt",
    order = "desc",
  } = req.query;
  const offset = (page - 1) * limit;

  try {
    const where = {
      status: true, // Only fetch products with status: true
    };
    if (subcategory_id) {
      where.subcategory_id = parseInt(subcategory_id);
    }
    if (minPrice !== undefined && maxPrice !== undefined) {
      where.ProductInstallments = {
        some: {
          advance: {
            gte: parseFloat(minPrice),
            lte: parseFloat(maxPrice),
          },
          isActive: true,
        },
      };
    }

    const validSortFields = ["name", "createdAt"];
    const sortField = validSortFields.includes(sort) ? sort : "createdAt";
    const sortOrder = order.toLowerCase() === "desc" ? "desc" : "asc";

    const products = await prisma.product.findMany({
      where,
      skip: Number(offset),
      take: Number(limit),
      orderBy: { [sortField]: sortOrder },
      include: {
        categories: { select: { id: true, name: true } },
        subcategories: { select: { id: true, name: true } },
        ProductImage: true,
        ProductInstallments: {
          where: { isActive: true },
          orderBy: { id: "desc" },
          take: 1,
        },
      },
    });

    const response = products.map((p) => ({
      ...p,
      category_name: p.categories?.name,
      subcategory_name: p.subcategories?.name,
      advance: p.ProductInstallments[0]?.advance || 0,
      isDeal: p.isDeal,
    }));

    const totalItems = await prisma.product.count({ where });

    res.status(200).json({
      data: response,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
};


const getProductByName = async (req, res) => {
  try {
    const { name } = req.params;

    const product = await prisma.product.findFirst({
      where: {
        slugName: String(name),
        status: true, // Only fetch product with status: true
      },
      include: {
        ProductImage: true,
        ProductInstallments: {
          where: { isActive: true }, // Only include active installments
        },
        categories: { select: { name: true } },
        subcategories: { select: { name: true, slugName: true } },
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const response = {
      ...product,
      category_name: product.categories?.name || null,
      subcategory_name: product.subcategories?.name || null,
      subcategory_slug_name: product.subcategories?.slugName || null,
      isDeal: product.isDeal,
      categories: undefined,
      subcategories: undefined,
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

const getAllProductsPagination = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    status = 'all',
    sort = 'name',
    order = 'desc',
    ids,  // New: Support ?ids=1,2,3
  } = req.query;
  const offset = (page - 1) * limit;

  try {
    // Input validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Filters
    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { id: isNaN(search) ? undefined : Number(search) },
      ].filter(Boolean);
    }
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (ids) {
      where.id = { in: ids.split(',').map(Number) };  // New: Filter by ids
    }

    // Sorting
    const validSortFields = ['id', 'name', 'price', 'isActive'];
    const sortField = validSortFields.includes(sort) ? sort : 'name';
    const sortOrder = order.toLowerCase() === 'desc' ? 'desc' : 'asc';

    // Fetch products
    const products = await prisma.product.findMany({
      where,
      skip: Number(offset),
      take: Number(limit),
      orderBy: { [sortField]: sortOrder },
      include: {
        ProductImage: true,
        ProductInstallments: true,
        categories: { select: { name: true } },
        subcategories: { select: { name: true } },
      },
    });

    // Count total
    const totalItems = await prisma.product.count({ where });

    // Transform response
    const response = products.map(p => ({
      ...p,
      category_name: p.categories?.name || null,
      subcategory_name: p.subcategories?.name || null,
      isDeal: p.isDeal,
      categories: undefined,
      subcategories: undefined,
    }));

    res.status(200).json({
      data: response,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id || isNaN(id)) {
      return res.status(400).json({ message: "Valid product ID is required" });
    }

    const product = await prisma.product.findUnique({
      where: {
        id: parseInt(id),
        status: true, // Only fetch product with status: true
      },
      include: {
        ProductImage: true,
        ProductInstallments: {
          where: { isActive: true }, // Include all active installments
          orderBy: { id: "desc" }, // Sort by ID in descending order
        },
        categories: { select: { id: true, name: true } },
        subcategories: { select: { id: true, name: true } },
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const response = {
      ...product,
      category_name: product.categories?.name || null,
      subcategory_name: product.subcategories?.name || null,
      isDeal: product.isDeal,
      categories: undefined,
      subcategories: undefined,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching product by ID:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// ---------- Get All Products ----------
const getAllProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        status: true, // Only fetch products with status: true
      },
      orderBy: {
        createdAt: 'desc', // Sort by creation date, latest first
      },
      include: {
        ProductImage: true,
        ProductInstallments: true,
        categories: { select: { name: true } },
        subcategories: { select: { name: true } },
      },
    });

    const response = products.map(p => ({
      ...p,
      category_name: p.categories?.name || null,
      subcategory_name: p.subcategories?.name || null,
      isDeal: p.isDeal,
      categories: undefined,
      subcategories: undefined,
    }));

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};



const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      category_id,
      subcategory_id,
      name,
      brand,
      short_description,
      long_description,
      stock,
      status,
      is_approved,
      isDeal,
    } = req.body;

    const updatedProduct = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        category_id: category_id ? parseInt(category_id) : undefined,
        subcategory_id: subcategory_id ? parseInt(subcategory_id) : undefined,
        name,
        brand,
        short_description,
        long_description,
        stock,
        status,
        is_approved,
        isDeal,
        updatedAt: new Date(),
      }
    });

    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const toggleProductField = async (req, res) => {
  try {
    const { id } = req.params;       // product id from URL
    const { stock,status } = req.body;      // which field to toggle: "stock" or "status"

    
    // Get current product
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    let  updatedProduct=null;

    // Toggle the field
    if (stock!== undefined) {
      
       updatedProduct = await prisma.product.update({
        where: { id: parseInt(id) },
        data: {
           stock,
             
           updatedAt: new Date(),      // update timestamp
        },
      });
    }
    
    if (status!== undefined) {
      
      updatedProduct = await prisma.product.update({
        where: { id: parseInt(id) },
        data: {
           
           status,  
           updatedAt: new Date(),      // update timestamp
        },
      });
    }
    
    

    res.json({
      message: `toggled successfully`,
      product: updatedProduct,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
};

const getProductByCategorySlug = async (req, res) => {
  const { categorySlug } = req.params;
  const {
    page = 1,
    limit = 10,
    minPrice,
    maxPrice,
    sort = "name",
    order = "asc",
  } = req.query;
  const offset = (page - 1) * limit;

  try {
    if (!prisma.categories) {
      return res.status(500).json({ error: "Server configuration error: categories model not found" });
    }

    const where = {
      status: true, // Only fetch products with status: true
    };

    if (categorySlug) {
      const category = await prisma.categories.findFirst({
        where: {
          name: {
            contains: String(categorySlug),
          },
        },
        select: { id: true, name: true },
      });

      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      where.category_id = category.id;
    }

    if (minPrice !== undefined && maxPrice !== undefined) {
      where.ProductInstallments = {
        some: {
          advance: {
            gte: parseFloat(minPrice),
            lte: parseFloat(maxPrice),
          },
          isActive: true, // Only fetch active installments
        },
      };
    }

    const validSortFields = ["name"];
    const sortField = validSortFields.includes(sort) ? sort : "name";
    const sortOrder = order.toLowerCase() === "desc" ? "desc" : "asc";

    const products = await prisma.product.findMany({
      where,
      skip: Number(offset),
      take: Number(limit),
      orderBy: { [sortField]: sortOrder },
      include: {
        categories: { select: { id: true, name: true } },
        subcategories: { select: { id: true, name: true } },
        ProductImage: true,
        ProductInstallments: {
          where: { isActive: true }, // Only include active installments
          orderBy: { id: "desc" },
          take: 1,
        },
      },
    });

    const response = products.map((p) => ({
      ...p,
      category_name: p.categories?.name || null,
      subcategory_name: p.subcategories?.name || null,
      advance: p.ProductInstallments[0]?.advance || 0,
      isDeal: p.isDeal,
    }));

    const totalItems = await prisma.product.count({ where });

    res.status(200).json({
      data: response,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching products by category slug:", error);
    res.status(500).json({ error: "Failed to fetch products", details: error.message });
  }
};

const getProductByCategoryAndSubSlug = async (req, res) => {
  const { categorySlug, subcategorySlug } = req.params;
  const {
    page = 1,
    limit = 10,
    minPrice,
    maxPrice,
    sort = "name",
    order = "asc",
  } = req.query;
  const offset = (page - 1) * limit;

  try {
    if (!prisma.categories || !prisma.subcategories) {
      console.error("Prisma 'categories' or 'subcategories' model is undefined. Check schema.prisma and Prisma client initialization.");
      return res.status(500).json({ error: "Server configuration error: categories or subcategories model not found" });
    }

    const where = {
      status: true, // Only fetch products with status: true
    };

    if (categorySlug) {
      const category = await prisma.categories.findFirst({
        where: {
          OR: [
            { slugName: { contains: String(categorySlug) } },
            { name: { contains: String(categorySlug) } },
          ],
        },
        select: { id: true, name: true },
      });

      if (!category) {
        console.log(`Category with slugName or name containing "${categorySlug}" not found`);
        return res.status(404).json({ error: "Category not found" });
      }

      console.log(`Found category: ${category.name} (ID: ${category.id})`);
      where.category_id = category.id;
    } else {
      console.log("No categorySlug provided");
      return res.status(400).json({ error: "Category slug is required" });
    }

    if (subcategorySlug) {
      const subcategory = await prisma.subcategories.findFirst({
        where: {
          OR: [
            { slugName: { contains: String(subcategorySlug) } },
            { name: { contains: String(subcategorySlug) } },
          ],
        },
        select: { id: true, name: true },
      });

      if (!subcategory) {
        console.log(`Subcategory with slugName or name containing "${subcategorySlug}" not found`);
        return res.status(404).json({ error: "Subcategory not found" });
      }

      console.log(`Found subcategory: ${subcategory.name} (ID: ${subcategory.id})`);
      where.subcategory_id = subcategory.id;
    }

    if (minPrice !== undefined && maxPrice !== undefined) {
      where.ProductInstallments = {
        some: {
          advance: {
            gte: parseFloat(minPrice),
            lte: parseFloat(maxPrice),
          },
          isActive: true, // Only fetch active installments
        },
      };
    }

    const validSortFields = ["name"];
    const sortField = validSortFields.includes(sort) ? sort : "name";
    const sortOrder = order.toLowerCase() === "desc" ? "desc" : "asc";

    const products = await prisma.product.findMany({
      where,
      skip: Number(offset),
      take: Number(limit),
      orderBy: { [sortField]: sortOrder },
      include: {
        categories: { select: { id: true, name: true } },
        subcategories: { select: { id: true, name: true } },
        ProductImage: true,
        ProductInstallments: {
          where: { isActive: true }, // Only include active installments
          orderBy: { id: "desc" },
          take: 1,
        },
      },
    });

    console.log(`Found ${products.length} products for categorySlug: ${categorySlug}${subcategorySlug ? `, subcategorySlug: ${subcategorySlug}` : ''}`);

    const response = products.map((p) => ({
      ...p,
      category_name: p.categories?.name || null,
      subcategory_name: p.subcategories?.name || null,
      advance: p.ProductInstallments[0]?.advance || 0,
      isDeal: p.isDeal,
    }));

    const totalItems = await prisma.product.count({ where });

    res.status(200).json({
      data: response,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching products by category/subcategory slug:", error);
    res.status(500).json({ error: "Failed to fetch products", details: error.message });
  }
};

const getLatestProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        status: true, // Already present, kept for clarity
      },
      take: 10,
      orderBy: { id: "desc" },
      include: {
        ProductImage: {
          take: 1,
          orderBy: { id: "asc" },
        },
        ProductInstallments: {
          where: { isActive: true }, // Only include active installments
          orderBy: { id: "desc" },
          take: 1,
        },
        categories: { select: { name: true } },
        subcategories: { select: { name: true } },
      },
    });

    const response = products.map((p) => ({
      id: p.id,
      name: p.name,
      slugName: p.slugName,
      category_name: p.categories?.name || null,
      subcategory_name: p.subcategories?.name || null,
      advance: p.ProductInstallments[0]?.advance || 0,
      image_url: p.ProductImage[0]?.url || null,
      ProductInstallments: p.ProductInstallments,
      isDeal: p.isDeal,
    }));

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching latest products:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

const getProductSearch = async (req, res) => {
  const { search, category, subcategory, page = 1, limit = 10, minPrice, maxPrice, sort = "name", order = "asc" } = req.query;
  const offset = (page - 1) * limit;

  try {
    const where = { status: true };

    // Handle search term
    if (search) {
      const lowerSearch = search.toLowerCase().trim();

      // Check if search term matches a subcategory name or slug (case-insensitive)
      const subcategoryMatch = await prisma.subcategories.findFirst({
        where: {
          OR: [
            {
              name: {
                equals: lowerSearch, // Exact case-insensitive match (manual handling)
              },
            },
            {
              slugName: {
                equals: lowerSearch, // Exact case-insensitive match (manual handling)
              },
            },
          ],
        },
        select: { id: true },
      });

      if (subcategoryMatch) {
        // If search term matches a subcategory exactly, filter by subcategory_id
        where.subcategory_id = subcategoryMatch.id;
      } else {
        // Otherwise, search in product name and description (case-insensitive)
        where.OR = [
          {
            name: {
              contains: lowerSearch,
            },
          },
          {
            short_description: {
              contains: lowerSearch,
            },
          },
          {
            long_description: {
              contains: lowerSearch,
            },
          },
        ];
      }
    }

    // Handle category filter
    if (category) {
      const cat = await prisma.categories.findFirst({
        where: { slugName: category.toLowerCase().trim() }, // Case-insensitive slug matching
        select: { id: true },
      });
      if (cat) {
        where.category_id = cat.id;
      } else {
        return res.status(404).json({ error: "Category not found" });
      }
    }

    // Handle subcategory filter
    if (subcategory) {
      const sub = await prisma.subcategories.findFirst({
        where: { slugName: subcategory.toLowerCase().trim() }, // Case-insensitive slug matching
        select: { id: true },
      });
      if (sub) {
        where.subcategory_id = sub.id;
      } else {
        return res.status(404).json({ error: "Subcategory not found" });
      }
    }

    // Handle price range filter
    if (minPrice !== undefined && maxPrice !== undefined) {
      where.ProductInstallments = {
        some: {
          advance: {
            gte: parseFloat(minPrice),
            lte: parseFloat(maxPrice),
          },
          isActive: true,
        },
      };
    }

    // Validate sorting fields
    const validSortFields = ["name", "createdAt"];
    const sortField = validSortFields.includes(sort) ? sort : "name";
    const sortOrder = order.toLowerCase() === "desc" ? "desc" : "asc";

    // Fetch products
    const products = await prisma.product.findMany({
      where,
      skip: Number(offset),
      take: Number(limit),
      orderBy: { [sortField]: sortOrder },
      include: {
        categories: { select: { id: true, name: true } },
        subcategories: { select: { id: true, name: true } },
        ProductImage: {
          take: 1, // Limit to one image per product
          orderBy: { id: "asc" },
        },
        ProductInstallments: {
          where: { isActive: true },
          orderBy: { id: "desc" },
          take: 1, // Limit to one installment plan
        },
      },
    });

    // Transform response
    const response = products.map((p) => ({
      id: p.id,
      name: p.name,
      slugName: p.slugName,
      category_name: p.categories?.name || null,
      subcategory_name: p.subcategories?.name || null,
      advance: p.ProductInstallments[0]?.advance || 0,
      image_url: p.ProductImage[0]?.url || null,
      short_description: p.short_description,
      stock: p.stock,
      isDeal: p.isDeal,
    }));

    // Count total items
    const totalItems = await prisma.product.count({ where });

    res.status(200).json({
      data: response,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error in product search:", error);
    res.status(500).json({ error: "Failed to search products", details: error.message });
  }
};

const getProductBySubcategorySlugSimple = async (req, res) => {
  const { subcategorySlug } = req.params;

  try {
    // Check if the subcategories model exists in Prisma
    if (!prisma.subcategories) {
      return res.status(500).json({ error: "Server configuration error: subcategories model not found" });
    }

    // Define the where clause for products with status: true
    const where = {
      status: true,
    };

    // Find subcategory by slug
    if (subcategorySlug) {
      const subcategory = await prisma.subcategories.findFirst({
        where: {
          OR: [
            { slugName: { contains: String(subcategorySlug) } },
            { name: { contains: String(subcategorySlug) } },
          ],
        },
        select: { id: true, name: true },
      });

      if (!subcategory) {
        return res.status(404).json({ error: "Subcategory not found" });
      }
      where.subcategory_id = subcategory.id;
    } else {
      return res.status(400).json({ error: "Subcategory slug is required" });
    }

    // Fetch exactly 10 products, ordered by id in descending order (latest first)
    const products = await prisma.product.findMany({
      where,
      take: 20,
      orderBy: { id: "desc" },
      include: {
        categories: { select: { id: true, name: true } },
        subcategories: { select: { id: true, name: true } },
        ProductImage: {
          take: 1, // Limit to one image per product
          orderBy: { id: "asc" },
        },
        ProductInstallments: {
          where: { isActive: true }, // Only include active installments
          orderBy: { id: "desc" }, // Latest installment first
          take: 1, // Limit to one installment
        },
      },
    });

    // Transform response
    const response = products.map((p) => ({
      id: p.id,
      name: p.name,
      slugName: p.slugName,
      category_name: p.categories?.name || null,
      subcategory_name: p.subcategories?.name || null,
      advance: p.ProductInstallments[0]?.advance || 0,
      image_url: p.ProductImage[0]?.url || null,
      isDeal: p.isDeal,
    }));

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching products by subcategory slug:", error);
    res.status(500).json({ error: "Failed to fetch products", details: error.message });
  }
};

module.exports = { createProduct, getAllProducts, getProductByName, toggleProductField, updateProduct, getProductPagination, getProductByCategorySlug, getProductByCategoryAndSubSlug, getLatestProducts, getAllProductsPagination, getProductById, getProductSearch, getProductBySubcategorySlugSimple, bulkCreateProducts, bulkUpdateProducts, bulkDeleteProducts }