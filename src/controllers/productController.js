const { PrismaClient } = require("@prisma/client");

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
      price,
      stock,
      status,
      createdAt,
      installments
    } = formattedData


    const uploadedFiles = req.files?.map(file => ({
      fileName: file.originalname,
      filePath: file.path,
      size: file.size,
      cloudinaryId: file.filename
    })) || [];


    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric ko - bana do
      .replace(/^-+|-+$/g, ''); // shuru/akhir ke - hata do



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
        // price: parseFloat(price),
        stock: true,
        createdAt,
        ProductImage: {
          create:
            uploadedFiles.map((file) => ({
              url: file.filePath,

            }))

        },

        ProductInstallments: {
          create:
            installments.map((ins) => ({
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
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }

}


const getProductPagination = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    subcategory_id,
    minPrice,
    maxPrice,
    sort = "name",
    order = "asc",
  } = req.query;
  const offset = (page - 1) * limit;

  try {
    const where = {};
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
      where: { slugName: String(name) },
      include: {
        ProductImage: true,
        ProductInstallments: true,
        categories: { select: { name: true } },
        subcategories: { select: { name: true } },
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Flatten category/subcategory name if needed
    const response = {
      ...product,
      category_name: product.category?.name || null,
      subcategory_name: product.subcategory?.name || null,
      category: undefined,
      subcategory: undefined,
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// ---------- Get All Products ----------
const getAllProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        ProductImage: true,
        ProductInstallments: true,
        categories: { select: { name: true } },
        subcategories: { select: { name: true } },
      },
    });

    const response = products.map(p => ({
      ...p,
      category_name: p.category?.name || null,
      subcategory_name: p.subcategory?.name || null,
      category: undefined,
      subcategory: undefined,
    }));

    res.json(response);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};



const updateProduct = async (req, res) => {
  try {
   
    const {
      id,
      category_id,
      subcategory_id,
      name,
      brand,
      short_description,
      long_description,
      stock,
      status,
      installments
    } = req.body


    const uploadedFiles = req.files?.map(file => ({
      fileName: file.originalname,
      filePath: file.path,
      size: file.size,
      cloudinaryId: file.filename
    })) || [];

    const productUpdation = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        category_id,
        subcategory_id,
        name,
        status,
        brand,
        short_description,
        long_description,
        stock,
        updatedAt,
      }
    })

    const enriched = await Promise.all(

      uploadedFiles.map(async (file) => {

        await prisma.productImage.create({
          where: { product_id: parseInt(id) },
          data: {
            url: file.filePath,
          }
        })
      })
    )
    

    const enriched2 = await Promise.all(

      installments.map(async(ins) => {
  
        const productInstallments = await prisma.productInstallments.create({
          where: { product_id: parseInt(id) },
          data: {
              totalPrice: ins.totalPrice,
              monthlyAmount: ins.monthlyAmount,
              advance: ins.advance,
              months: ins.months,
             
          }
        })
  
      })
    )

    res.status(201).json(productUpdation)



  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }

}

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

const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        ProductImage: true,
        ProductInstallments: true,
        categories: { select: { name: true } },
        subcategories: { select: { name: true } },
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Flatten category/subcategory name if needed
    const response = {
      ...product,
      category_name: product.category?.name || null,
      subcategory_name: product.subcategory?.name || null,
      category: undefined,
      subcategory: undefined,
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
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
      console.error("Prisma 'categories' model is undefined. Check schema.prisma and Prisma client initialization.");
      return res.status(500).json({ error: "Server configuration error: categories model not found" });
    }

    const where = {};

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
  const { categorySlug, subcategorySlug } = req.params; // Access both slugs from URL params
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
    // Validate Prisma client and models
    if (!prisma.categories || !prisma.subcategories) {
      console.error("Prisma 'categories' or 'subcategories' model is undefined. Check schema.prisma and Prisma client initialization.");
      return res.status(500).json({ error: "Server configuration error: categories or subcategories model not found" });
    }

    const where = {};

    // Filter by category
    if (categorySlug) {
      const category = await prisma.categories.findFirst({
        where: {
          // Try slugName first, fall back to name
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

    // Filter by subcategory (if provided)
    if (subcategorySlug) {
      const subcategory = await prisma.subcategories.findFirst({
        where: {
          // Try slugName first, fall back to name
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

    // Apply price filters if provided
    if (minPrice !== undefined && maxPrice !== undefined) {
      where.ProductInstallments = {
        some: {
          advance: {
            gte: parseFloat(minPrice),
            lte: parseFloat(maxPrice),
          },
        },
      };
    }

    // Validate sorting fields
    const validSortFields = ["name"];
    const sortField = validSortFields.includes(sort) ? sort : "name";
    const sortOrder = order.toLowerCase() === "desc" ? "desc" : "asc";

    // Fetch products with pagination, sorting, and includes
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
          orderBy: { id: "desc" },
          take: 1,
        },
      },
    });

    console.log(`Found ${products.length} products for categorySlug: ${categorySlug}${subcategorySlug ? `, subcategorySlug: ${subcategorySlug}` : ''}`);

    // Map response to include category and subcategory names
    const response = products.map((p) => ({
      ...p,
      category_name: p.categories?.name || null,
      subcategory_name: p.subcategories?.name || null,
      advance: p.ProductInstallments[0]?.advance || 0,
    }));

    // Count total items for pagination
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

module.exports = { createProduct, getAllProducts, getProductById, getProductByName,toggleProductField,updateProduct,getProductPagination,getProductByCategorySlug,getProductByCategoryAndSubSlug }