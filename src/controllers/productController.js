const { PrismaClient } = require("@prisma/client");
const { validationResult } = require('express-validator');

const prisma = new PrismaClient();

const createProduct = async (req, res) => {
  try {
    let formattedData = {};
    if (req.body.formattedData) {
      try {
        formattedData = JSON.parse(req.body.formattedData);
      } catch (err) {
        return res.status(400).json({ message: "Invalid formattedData" });
      }
    }

    const {
      category_id,
      subcategory_id,
      name,
      short_description,
      long_description,
      stock,
      status,
      is_approved,
      isDeal,
      installments,
      price,
      tags
    } = formattedData;

    // Validate required fields
    if (!name || !category_id || !subcategory_id || !price) {
      return res.status(400).json({ message: "Name, category_id, subcategory_id, and price are required" });
    }

    // Fetch category name for generating installments
    const category = await prisma.categories.findUnique({
      where: { id: parseInt(category_id) },
      select: { name: true },
    });

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Use provided installments or generate default ones
    let finalInstallments = installments && installments.length > 0 ? installments : [];
    if (finalInstallments.length === 0) {
      try {
        finalInstallments = generateInstallments(category.name, parseFloat(price));
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }

    const uploadedFiles = req.files?.map(file => ({
      fileName: file.originalname,
      filePath: file.path,
      size: file.size,
      cloudinaryId: file.filename,
    })) || [];

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const productCreation = await prisma.product.create({
      data: {
        category_id: parseInt(category_id),
        subcategory_id: parseInt(subcategory_id),
        name,
        price,
        slugName: slug,
        status: status ?? true,
        brand: 'Qist Market',
        short_description: short_description || '',
        long_description: long_description || '',
        stock: stock ?? true,
        is_approved: is_approved ?? false,
        isDeal: isDeal ?? false,
        ProductImage: {
          create: uploadedFiles.map((file) => ({
            url: file.filePath,
          })),
        },
        ProductInstallments: {
          create: finalInstallments.map((ins) => ({
            totalPrice: parseFloat(ins.totalPrice),
            monthlyAmount: parseFloat(ins.monthlyAmount),
            advance: parseFloat(ins.advance),
            months: parseInt(ins.months),
            isActive: ins.isActive ?? true,
          })),
        },
        tags: {
          create: (tags || []).map(tagId => ({
            tag: { connect: { id: parseInt(tagId) } }
          }))
        }
      },
    });

    res.status(201).json(productCreation);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

function titleCase(str) {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function roundUpToNearest50(num) {
  return Math.ceil(num / 50) * 50;
}

function generateInstallments(categoryName, price) {
  const category = categoryName.toLowerCase();
  let plans = [];

  if (category === 'mobiles' && price <= 50000) {
    plans = [
      { months: 3, profit: 0.20, advance: 0.35 },
      { months: 6, profit: 0.35, advance: 0.25 },
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
    const advanceAmount = roundUpToNearest50(price * plan.advance);
    const profitAmount = roundUpToNearest50(price * plan.profit);
    const monthlyAmount = roundUpToNearest50((price + profitAmount - advanceAmount) / plan.months);
    const totalPrice = roundUpToNearest50(advanceAmount + (monthlyAmount * plan.months));
    return {
      advance: advanceAmount,
      totalPrice: totalPrice,
      monthlyAmount: monthlyAmount,
      months: plan.months,
      isActive: true,
    };
  });
}

const bulkCreateProducts = async (req, res) => {
  const { products } = req.body;
  try {
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: 'No products provided' });
    }
    const existingCategories = await prisma.categories.findMany({
      select: { id: true, name: true, slugName: true },
    });
    const existingSubcategories = await prisma.subcategories.findMany({
      select: { id: true, name: true, category_id: true, slugName: true },
    });
    const existingProducts = await prisma.product.findMany({
      select: { id: true, name: true, category_id: true, subcategory_id: true },
    });

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

    const categoriesToCreate = [];
    const subcategoriesToCreate = [];
    const productsToCreate = [];
    const installmentsToCreate = [];
    const newCategoryKeys = new Set();
    const newSubcategoryKeys = new Set();
    const skippedProducts = [];

    for (const data of products) {
      if (!data.name || !data.category || !data.subcategory || !data.price) {
        skippedProducts.push(data.name || 'unknown');
        continue;
      }

      const categoryName = titleCase(data.category.trim());
      const subcategoryName = titleCase(data.subcategory.trim());
      const categoryKey = categoryName.toLowerCase();
      const subcategoryKey = subcategoryName.toLowerCase();

      let price = data.price.toString().replace(/,/g, '');
      price = Math.round(parseFloat(price));
      if (isNaN(price) || price <= 0) {
        skippedProducts.push(data.name);
        continue;
      }

      let category = categoryMap.get(categoryKey);
      if (!category && !newCategoryKeys.has(categoryKey)) {
        newCategoryKeys.add(categoryKey);
        const categorySlug = categoryKey.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        categoriesToCreate.push({
          name: categoryName,
          slugName: categorySlug,
          description: '',
          isActive: true,
        });
      }

      const subKey = `${categoryName.toLowerCase()}_${subcategoryKey}`;
      let subcategory;
      if (category) {
        subcategory = subcategoryMap.get(`${category.id}_${subcategoryKey}`);
      }
      if (!subcategory && !newSubcategoryKeys.has(subKey)) {
        newSubcategoryKeys.add(subKey);
        const subcategorySlug = subcategoryKey.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        subcategoriesToCreate.push({
          categoryName,
          name: subcategoryName,
          slugName: subcategorySlug,
          description: '',
          isActive: true,
        });
      }

      let installments;
      try {
        installments = generateInstallments(categoryName, price);
      } catch (err) {
        skippedProducts.push(data.name);
        continue;
      }
      if (installments.length === 0) {
        skippedProducts.push(data.name);
        continue;
      }

      const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      productsToCreate.push({
        categoryName,
        subcategoryName,
        name: data.name,
        slugName: slug,
        status: data.status ?? true,
        brand: 'Qist Market',
        short_description: data.short_description || '',
        long_description: data.long_description || '',
        stock: data.stock ?? true,
        is_approved: data.is_approved ?? false,
        isDeal: data.isDeal ?? false,
        price: price,
        installments,
      });
    }

    await prisma.$transaction(async (tx) => {
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
    }, { timeout: 15000 });

    // Main transaction for products and installments
    const { created } = await prisma.$transaction(async (tx) => {
      const results = [];

      // Prepare products with resolved IDs
      const productData = [];
      for (const product of productsToCreate) {
        const category = categoryMap.get(product.categoryName.toLowerCase());
        if (!category) {
          skippedProducts.push(product.name);
          continue;
        }
        const subcategory = subcategoryMap.get(`${category.id}_${product.subcategoryName.toLowerCase()}`);
        if (!subcategory) {
          skippedProducts.push(product.name);
          continue;
        }

        const productKey = `${product.name.toLowerCase()}_${category.id}_${subcategory.id}`;
        if (productMap.has(productKey)) {
          skippedProducts.push(product.name);
          continue;
        }

        productData.push({
          category_id: category.id,
          subcategory_id: subcategory.id,
          name: product.name,
          slugName: product.slugName,
          status: product.status,
          brand: product.brand,
          short_description: product.short_description,
          long_description: product.long_description,
          stock: product.stock,
          is_approved: product.is_approved,
          isDeal: product.isDeal,
          price: product.price,
        });

        // Store installments with placeholder product_id
        product.installments.forEach(ins => {
          installmentsToCreate.push({
            product_id: null,
            totalPrice: ins.totalPrice, // Already rounded
            monthlyAmount: ins.monthlyAmount, // Already rounded
            advance: ins.advance, // Already rounded
            months: ins.months,
            isActive: ins.isActive,
            productKey,
          });
        });
      }

      // Batch create products
      if (productData.length > 0) {
        await tx.product.createMany({
          data: productData,
          skipDuplicates: true,
        });

        // Fetch newly created products to get their IDs
        const newProducts = await tx.product.findMany({
          where: {
            OR: productData.map(p => ({
              name: p.name,
              category_id: p.category_id,
              subcategory_id: p.subcategory_id,
            })),
          },
          select: { id: true, name: true, category_id: true, subcategory_id: true },
        });

        // Map new product IDs to installments
        const productIdMap = new Map(
          newProducts.map(p => [`${p.name.toLowerCase()}_${p.category_id}_${p.subcategory_id}`, p.id])
        );

        // Update installments with correct product IDs
        const updatedInstallments = installmentsToCreate
          .filter(ins => productIdMap.has(ins.productKey))
          .map(ins => ({
            product_id: productIdMap.get(ins.productKey),
            totalPrice: ins.totalPrice,
            monthlyAmount: ins.monthlyAmount,
            advance: ins.advance,
            months: ins.months,
            isActive: ins.isActive,
          }));

        // Batch create installments
        if (updatedInstallments.length > 0) {
          await tx.productInstallments.createMany({
            data: updatedInstallments,
            skipDuplicates: true,
          });
        }

        results.push(...newProducts);
      }

      return { created: results };
    }, { timeout: 60000 });

    res.status(201).json({
      message: `Products created successfully. ${created.length} created, ${skippedProducts.length} skipped.`,
      created,
      skipped: skippedProducts,
    });
  } catch (error) {
    console.error('Error creating bulk products:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  } finally {
    await prisma.$disconnect();
  }
};

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

    const uploadedFiles = req.files?.map(file => file.path) || [];
    if (uploadedFiles.length > 0) {
      const newImagesData = ids.flatMap(id => uploadedFiles.map(url => ({ product_id: id, url })));
      await prisma.productImage.createMany({ data: newImagesData });
    }

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
          },
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
    sort = "id",
    order = "desc",
  } = req.query;
  const offset = (page - 1) * limit;

  try {
    const where = {
      status: true,
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

    const validSortFields = ["name", "createdAt", "id"];
    const sortField = validSortFields.includes(sort) ? sort : "id";
    const sortOrder = ["asc", "desc"].includes(order.toLowerCase())
      ? order.toLowerCase()
      : "desc";

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
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
};


const getProductByName = async (req, res) => {
  try {
    const { name } = req.params;

    const product = await prisma.product.findFirst({
      where: {
        slugName: String(name),
        status: true,
      },
      include: {
        ProductImage: true,
        ProductInstallments: {
          where: { isActive: true },
        },
        categories: { select: { name: true } },
        subcategories: { select: { name: true, slugName: true } },
        tags: {
          include: {
            tag: true
          }
        }
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
      tags: product.tags.map(pt => pt.tag),
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
  } = req.query;
  const offset = (page - 1) * limit;

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Filters
    const where = {};
    if (search) {
      const orConditions = [
        { name: { contains: search } },
        {
          categories: {
            name: { contains: search },
          },
        },
        {
          subcategories: {
            name: { contains: search },
          },
        },
      ];

      if (!isNaN(search)) {
        orConditions.push({ id: Number(search) });
      }

      where.OR = orConditions;
    }
    if (status === 'active') where.status = true;
    if (status === 'inactive') where.status = false;

    const validSortFields = ['id', 'name', 'price', 'status'];
    const sortField = validSortFields.includes(sort) ? sort : 'name';
    const sortOrder = order.toLowerCase() === 'desc' ? 'desc' : 'asc';

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
        tags: {
          include: {
            tag: true
          }
        }
      },
    });

    const totalItems = await prisma.product.count({ where });

    const response = products.map(p => ({
      ...p,
      category_name: p.categories?.name || null,
      subcategory_name: p.subcategories?.name || null,
      tags: p.tags.map(pt => pt.tag),
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

const getProductsByIds = async (req, res) => {
  const { ids } = req.query;

  try {
    if (!ids) {
      return res.status(400).json({ message: "IDs parameter is required" });
    }

    // Convert comma-separated IDs to an array of integers
    const idArray = ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    if (idArray.length === 0) {
      return res.status(400).json({ message: "Valid product IDs are required" });
    }

    // Fetch products by IDs
    const products = await prisma.product.findMany({
      where: {
        id: { in: idArray },
      },
      orderBy: { id: "desc" },
      include: {
        ProductImage: true,
        ProductInstallments: true,
        categories: { select: { id: true, name: true } },
        subcategories: { select: { id: true, name: true } },
        tags: {
          include: {
            tag: true
          }
        }
      },
    });

    // Transform response
    const response = products.map(p => ({
      ...p,
      category_name: p.categories?.name || null,
      subcategory_name: p.subcategories?.name || null,
      tags: p.tags.map(pt => pt.tag),
      isDeal: p.isDeal,
      categories: undefined,
      subcategories: undefined,
    }));

    res.status(200).json({
      data: response,
    });
  } catch (error) {
    console.error("Error fetching products by IDs:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
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
        ProductInstallments: true,
        categories: { select: { id: true, name: true } },
        subcategories: { select: { id: true, name: true } },
        tags: {
          include: {
            tag: true
          }
        }
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const response = {
      ...product,
      category_name: product.categories?.name || null,
      subcategory_name: product.subcategories?.name || null,
      tags: product.tags.map(pt => pt.tag),
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
      short_description,
      long_description,
      stock,
      status,
      is_approved,
      isDeal,
      price,
      tags
    } = req.body;

    const currentProduct = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: { categories: { select: { name: true } } },
    });

    if (!currentProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    const data = {
      category_id: category_id ? parseInt(category_id) : undefined,
      subcategory_id: subcategory_id ? parseInt(subcategory_id) : undefined,
      name,
      short_description,
      long_description,
      stock,
      status,
      is_approved,
      isDeal,
      updatedAt: new Date(),
    };

    let regenerateInstallments = false;

    if (price !== undefined) {
      const newPrice = parseFloat(price);
      if (!isNaN(newPrice) && newPrice !== currentProduct.price) {
        data.price = newPrice;
        regenerateInstallments = true;
      }
    }

    if (category_id !== undefined && parseInt(category_id) !== currentProduct.category_id) {
      regenerateInstallments = true;
    }

    const updatedProduct = await prisma.product.update({
      where: { id: parseInt(id) },
      data,
    });

    if (regenerateInstallments) {
      const categoryName = category_id
        ? (await prisma.categories.findUnique({ where: { id: parseInt(category_id) }, select: { name: true } }))?.name
        : currentProduct.categories.name;

      const finalPrice = data.price || currentProduct.price;

      let installments;
      try {
        installments = generateInstallments(categoryName, finalPrice);
      } catch (err) {
        console.error("Error generating installments:", err);
        // Optionally handle error, but continue
      }

      if (installments && installments.length > 0) {
        await prisma.productInstallments.deleteMany({
          where: { product_id: parseInt(id) },
        });

        await prisma.productInstallments.createMany({
          data: installments.map((ins) => ({
            product_id: parseInt(id),
            totalPrice: parseFloat(ins.totalPrice),
            monthlyAmount: parseFloat(ins.monthlyAmount),
            advance: parseFloat(ins.advance),
            months: parseInt(ins.months),
            isActive: ins.isActive ?? true,
          })),
        });
      }
    }

    // Handle tags if provided
    if (tags !== undefined) {
      const originalTagIds = (await prisma.productTag.findMany({
        where: { productId: parseInt(id) },
        select: { tagId: true },
      })).map(pt => pt.tagId).sort((a, b) => a - b);
      const newTagIds = (tags || []).map(Number).sort((a, b) => a - b);

      if (JSON.stringify(originalTagIds) !== JSON.stringify(newTagIds)) {
        await prisma.productTag.deleteMany({ where: { productId: parseInt(id) } });
        if (newTagIds.length > 0) {
          await prisma.productTag.createMany({
            data: newTagIds.map(tagId => ({ productId: parseInt(id), tagId }))
          });
        }
      }
    }

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
    sort = "id",
    order = "desc",
  } = req.query;
  const offset = (page - 1) * limit;

  try {
    if (!prisma.categories) {
      return res.status(500).json({ error: "Server configuration error: categories model not found" });
    }

    const where = {
      status: true,
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
          isActive: true,
        },
      };
    }

    const validSortFields = ["name", "createdAt", "id"];
    const sortField = validSortFields.includes(sort) ? sort : "id";
    const sortOrder = ["asc", "desc"].includes(order.toLowerCase())
      ? order.toLowerCase()
      : "desc";

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
    sort = "id",
    order = "desc",
  } = req.query;
  const offset = (page - 1) * limit;

  try {
    if (!prisma.categories || !prisma.subcategories) {
      console.error("Prisma 'categories' or 'subcategories' model is undefined. Check schema.prisma and Prisma client initialization.");
      return res.status(500).json({ error: "Server configuration error: categories or subcategories model not found" });
    }

    const where = {
      status: true,
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
          isActive: true,
        },
      };
    }

    const validSortFields = ["name", "createdAt", "id"];
    const sortField = validSortFields.includes(sort) ? sort : "id";
    const sortOrder = ["asc", "desc"].includes(order.toLowerCase())
      ? order.toLowerCase()
      : "desc";

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

const bulkSetTags = async (req, res) => {
  const { productIds, tagIds } = req.body;
  try {
    if (!Array.isArray(productIds) || !Array.isArray(tagIds)) {
      return res.status(400).json({ message: 'productIds and tagIds must be arrays' });
    }
    await prisma.productTag.deleteMany({
      where: { productId: { in: productIds } }
    });
    const data = productIds.flatMap(pid => tagIds.map(tid => ({ productId: pid, tagId: tid })));
    if (data.length > 0) {
      await prisma.productTag.createMany({ data });
    }
    res.status(200).json({ message: 'Tags set successfully' });
  } catch (error) {
    console.error('Error setting bulk tags:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

module.exports = { createProduct, getAllProducts, getProductByName, toggleProductField, updateProduct, getProductPagination, getProductByCategorySlug, getProductByCategoryAndSubSlug, getLatestProducts, getAllProductsPagination, getProductById, getProductSearch, getProductBySubcategorySlugSimple, bulkCreateProducts, bulkUpdateProducts, bulkDeleteProducts, getProductsByIds, bulkSetTags }