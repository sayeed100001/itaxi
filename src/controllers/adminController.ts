import { Request, Response } from 'express';
import { prisma } from '../prisma.js';

export class AdminController {

    // Requirement 11: Admin Panel Access (Manage Users)
    static async getAllUsers(req: Request, res: Response): Promise<any> {
        try {
            const users = await prisma.user.findMany({
                select: { id: true, name: true, phone: true, role: true, balance: true, rating: true, created_at: true }
            });
            res.json(users);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch users' });
        }
    }

    // Requirement 9: Admin KYC & Account Level
    // Requirement 12: Credit approval & Management
    static async approveDriverKYC(req: Request, res: Response): Promise<any> {
        try {
            const { id } = req.params; // Driver ID
            const driverId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
            const { taxi_type, initial_credit } = req.body;

            // Mark driver as active & assign taxi type
            const updatedDriver = await prisma.driver.update({
                where: { id: driverId },
                data: {
                    is_active: true,
                    status: 'offline',
                    taxi_type_id: taxi_type || 'eco'
                }
            });

            // If admin grants credit, update Wallet (Requirement 7)
            if (initial_credit && initial_credit > 0) {
                await prisma.user.update({
                    where: { id: driverId },
                    data: { balance: { increment: initial_credit } }
                });
            }

            res.json({ message: 'KYC Approved and Driver Activated', driver: updatedDriver });
        } catch (error) {
            console.error('KYC Error:', error);
            res.status(500).json({ error: 'Failed to process KYC approval' });
        }
    }

    // Requirement 11: System Monthly Revenue
    static async getSystemRevenue(req: Request, res: Response): Promise<any> {
        try {
            // Aggregate all commission deductions from drivers
            const revenue = await prisma.transaction.aggregate({
                _sum: { amount: true },
                where: { 
                    type: 'debit', 
                    description: { contains: 'Commission' } 
                }
            });

            res.json({ monthly_revenue: Number(revenue._sum.amount || 0) });
        } catch (error) {
            console.error('Revenue Calc Error:', error);
            res.status(500).json({ error: 'Failed to calculate revenue' });
        }
    }
}
