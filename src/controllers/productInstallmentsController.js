const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();




const updateProductInstallments = async (req, res) => {
  try {
    let installments = req.body.ProductInstallments;

    if (!Array.isArray(installments) || installments.length === 0) {
      return res.status(400).json({ message: "No installments provided" });
    }

    // Remove existing installments for this product (if replacing them)
    await prisma.ProductInstallments.deleteMany({
      where: { product_id: installments[0].product_id },
    });

    // Insert new installments
    const productCreation = await prisma.ProductInstallments.createMany({
      data: installments.map((ins) => ({
        totalPrice: ins.totalPrice,
        monthlyAmount: ins.monthlyAmount,
        advance: ins.advance,
        months: ins.months,
        isActive: ins.isActive ?? true,
        product_id: ins.product_id,
      })),
    });

    res.status(201).json({
      message: "Installments updated successfully",
      count: productCreation.count,
    });
  } catch (error) {
    console.error("Error updating installments:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};



const updateProductImages = async (req, res) => {
  try {
    let {product_id} = req.body;

    

    // Remove existing installments for this product (if replacing them)
   

    const uploadedFiles = req.files?.map(file => ({
      
      url: file.path,
      product_id: parseInt(product_id),
      
    })) || [];

    // Insert new installments
    const productCreation = await prisma.ProductImage.createMany({
      data: uploadedFiles
    });

  

  const newImages = await prisma.ProductImage.findMany({
  where: { product_id: parseInt(product_id) },
  orderBy: { id: "desc" },
  take: uploadedFiles.length,
});

res.status(201).json({
  message: "Images uploaded successfully",
  uploaded: newImages,
});
  } catch (error) {
    console.error("Error updating installments:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};


const deleteProductImages = async (req, res) => {
    const {id}=req.params

    try {
        const deletedFiles=await prisma.ProductImage.delete({
            where:{id:parseInt(id)}
        })

        res.status(201).json(deletedFiles)
        
    } catch (error) {
        console.error("Error Deleting Files:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
    }
}




module.exports = { updateProductInstallments,updateProductImages,deleteProductImages }