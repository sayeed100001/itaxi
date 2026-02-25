import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth';

export class DriverSettingsController {
    async getDriverSettings(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;

            // Get driver record
            const driver = await prisma.driver.findUnique({
                where: { userId },
                select: {
                    id: true,
                    settings: true,
                },
            });

            if (!driver) {
                return res.status(404).json({ success: false, message: 'Driver not found' });
            }

            // Parse settings JSON or return defaults
            const settings = driver.settings ? JSON.parse(driver.settings as string) : null;

            return res.json({
                success: true,
                data: settings,
            });
        } catch (error) {
            console.error('Get driver settings error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch settings',
            });
        }
    }

    async updateDriverSettings(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;

            const settingsData = req.body;

            // Get driver record
            const driver = await prisma.driver.findUnique({
                where: { userId },
            });

            if (!driver) {
                return res.status(404).json({ success: false, message: 'Driver not found' });
            }

            // Update settings
            const updatedDriver = await prisma.driver.update({
                where: { id: driver.id },
                data: {
                    settings: JSON.stringify(settingsData),
                },
            });

            return res.json({
                success: true,
                message: 'Settings updated successfully',
                data: JSON.parse(updatedDriver.settings as string),
            });
        } catch (error) {
            console.error('Update driver settings error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update settings',
            });
        }
    }
}
