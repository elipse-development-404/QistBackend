const { PrismaClient } = require('@prisma/client');
const { cloudinary } = require('../Config/cloudinary');

const prisma = new PrismaClient();

const getAgreement = async (req, res) => {
  try {
    const agreement = await prisma.agreement.findFirst({
      include: { images: true },
    });

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    res.status(200).json(agreement);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch agreement' });
  }
};

const updateAgreement = async (req, res) => {
  const images = req.files;

  if (!images || images.length === 0) {
    return res.status(400).json({ error: 'At least one image is required' });
  }

  try {
    let agreement = await prisma.agreement.findFirst();

    if (agreement) {
      const oldImages = await prisma.agreementImage.findMany({
        where: { agreementId: agreement.id },
      });
      for (const img of oldImages) {
        if (img.cloudinary_id) {
          await cloudinary.uploader.destroy(img.cloudinary_id);
        }
      }
      await prisma.agreementImage.deleteMany({
        where: { agreementId: agreement.id },
      });

      agreement = await prisma.agreement.update({
        where: { id: agreement.id },
        data: {
          images: {
            create: images.map((image) => ({
              image_url: image.path,
              cloudinary_id: image.filename,
            })),
          },
        },
        include: { images: true },
      });
    } else {
      agreement = await prisma.agreement.create({
        data: {
          images: {
            create: images.map((image) => ({
              image_url: image.path,
              cloudinary_id: image.filename,
            })),
          },
        },
        include: { images: true },
      });
    }

    res.status(200).json(agreement);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update/create agreement' });
  }
};

const deleteImage = async (req, res) => {
  const { id } = req.params;
  try {
    const image = await prisma.agreementImage.findUnique({
      where: { id: Number(id) },
    });

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    if (image.cloudinary_id) {
      await cloudinary.uploader.destroy(image.cloudinary_id);
    }

    await prisma.agreementImage.delete({
      where: { id: Number(id) },
    });

    res.status(200).json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
};

module.exports = {
  getAgreement,
  updateAgreement,
  deleteImage,
};