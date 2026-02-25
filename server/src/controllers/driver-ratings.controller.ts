import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth';

export class DriverRatingsController {
    async getDriverRatings(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.id;

            // Get driver record
            const driver = await prisma.driver.findUnique({
                where: { userId },
            });

            if (!driver) {
                return res.status(404).json({ success: false, message: 'Driver not found' });
            }

            // Fetch all ratings for this driver
            const ratings = await prisma.tripRating.findMany({
                where: {
                    toUserId: driver.userId,
                    toRole: 'DRIVER',
                },
                include: {
                    trip: {
                        select: {
                            id: true,
                            pickupLat: true,
                            pickupLng: true,
                            dropLat: true,
                            dropLng: true,
                            fare: true,
                            createdAt: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
                take: 100,
            });

            // Calculate statistics
            const totalRatings = ratings.length;
            const averageRating = totalRatings > 0
                ? ratings.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / totalRatings
                : 0;

            const ratingDistribution = {
                5: ratings.filter((r: any) => r.score === 5).length,
                4: ratings.filter((r: any) => r.score === 4).length,
                3: ratings.filter((r: any) => r.score === 3).length,
                2: ratings.filter((r: any) => r.score === 2).length,
                1: ratings.filter((r: any) => r.score === 1).length,
            };

            // Calculate recent trend (last 10 vs previous 10)
            const recent10 = ratings.slice(0, 10);
            const previous10 = ratings.slice(10, 20);
            const recentAvg = recent10.length > 0
                ? recent10.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / recent10.length
                : 0;
            const previousAvg = previous10.length > 0
                ? previous10.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / previous10.length
                : 0;

            let recentTrend: 'up' | 'down' | 'stable' = 'stable';
            if (recentAvg > previousAvg + 0.2) recentTrend = 'up';
            else if (recentAvg < previousAvg - 0.2) recentTrend = 'down';

            return res.json({
                success: true,
                data: {
                    ratings,
                    stats: {
                        averageRating,
                        totalRatings,
                        ratingDistribution,
                        recentTrend,
                    },
                },
            });
        } catch (error) {
            console.error('Get driver ratings error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch ratings',
            });
        }
    }
}
