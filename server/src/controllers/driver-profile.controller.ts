import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth';

export class DriverProfileController {
  // Get driver profile with vehicle and documents
  async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const driver = await prisma.driver.findUnique({
        where: { userId: req.user!.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              city: true,
              province: true,
            },
          },
          documents: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!driver) {
        return res.status(404).json({ success: false, message: 'Driver not found' });
      }

      res.json({ success: true, data: driver });
    } catch (error) {
      next(error);
    }
  }

  // Update driver profile
  async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, email, city, province, vehicleType, plateNumber, whatsappNumber } = req.body;

      const driver = await prisma.driver.findUnique({
        where: { userId: req.user!.id },
      });

      if (!driver) {
        return res.status(404).json({ success: false, message: 'Driver not found' });
      }

      // Update user info
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { name, email, city, province },
      });

      // Update driver info
      const updatedDriver = await prisma.driver.update({
        where: { id: driver.id },
        data: {
          vehicleType,
          plateNumber,
          whatsappNumber,
          city,
          province,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              city: true,
              province: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: updatedDriver,
        message: 'Profile updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Upload document
  async uploadDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { type, fileName, fileUrl, fileSize, mimeType, expiryDate, notes } = req.body;

      const driver = await prisma.driver.findUnique({
        where: { userId: req.user!.id },
      });

      if (!driver) {
        return res.status(404).json({ success: false, message: 'Driver not found' });
      }

      const document = await prisma.driverDocument.create({
        data: {
          driverId: driver.id,
          type,
          fileName,
          fileUrl,
          fileSize,
          mimeType,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          notes,
          status: 'PENDING',
        },
      });

      res.json({
        success: true,
        data: document,
        message: 'Document uploaded successfully. Awaiting admin review.',
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all documents
  async getDocuments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const driver = await prisma.driver.findUnique({
        where: { userId: req.user!.id },
      });

      if (!driver) {
        return res.status(404).json({ success: false, message: 'Driver not found' });
      }

      const documents = await prisma.driverDocument.findMany({
        where: { driverId: driver.id },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, data: documents });
    } catch (error) {
      next(error);
    }
  }

  // Delete document
  async deleteDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { documentId } = req.params;

      const driver = await prisma.driver.findUnique({
        where: { userId: req.user!.id },
      });

      if (!driver) {
        return res.status(404).json({ success: false, message: 'Driver not found' });
      }

      const document = await prisma.driverDocument.findFirst({
        where: { id: documentId, driverId: driver.id },
      });

      if (!document) {
        return res.status(404).json({ success: false, message: 'Document not found' });
      }

      await prisma.driverDocument.delete({
        where: { id: documentId },
      });

      res.json({ success: true, message: 'Document deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
