import { Request, Response } from 'express';
import { prisma } from '../prisma.js';
import { WebSocketService } from '../services/websocket.js';

export class RidesController {

    // Requirement 3: Passenger can request a ride
    // Requirement 10: Passenger selects taxi type
    static async requestRide(req: Request, res: Response): Promise<any> {
        try {
            const { rider_id, pickup, dropoff, service_type, base_fare, proposed_fare } = req.body;

            const ride = await prisma.ride.create({
                data: {
                    rider_id,
                    pickup_address: pickup.address,
                    pickup_lat: pickup.lat,
                    pickup_lng: pickup.lng,
                    dropoff_address: dropoff.address,
                    dropoff_lat: dropoff.lat,
                    dropoff_lng: dropoff.lng,
                    service_type: service_type || 'eco', // Default to simple taxi
                    fare: Number(base_fare),
                    proposed_fare: Number(proposed_fare || base_fare), // Requirement 5: Fare Bidding
                    status: 'searching'
                }
            });

            // Native Websocket Emitting
            const io = WebSocketService.getIO();
            io.emit('newRideRequest', ride);

            res.status(201).json(ride);
        } catch (error) {
            console.error('Ride Request Error:', error);
            res.status(500).json({ error: 'Internal server error while requesting ride' });
        }
    }

    // Requirement 5: Passenger/Driver placing a counter-bid
    static async placeBid(req: Request, res: Response): Promise<any> {
        try {
            const { id } = req.params;
            const rideId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
            const { new_fare, bidder_id } = req.body;

            const updatedRide = await prisma.ride.update({
                where: { id: rideId },
                data: { proposed_fare: Number(new_fare), status: 'negotiating' }
            });

            // Notify over websocket that bidding in progress
            const io = WebSocketService.getIO();
            io.to(`ride_${id}`).emit('fareBidUpdated', { ride_id: id, proposed_fare: new_fare, bidder_id });

            res.json(updatedRide);
        } catch (error) {
            console.error('Bidding Error:', error);
            res.status(500).json({ error: 'Internal server error processing bid' });
        }
    }

    static async acceptRide(req: Request, res: Response): Promise<any> {
        try {
            const { id } = req.params;
            const rideId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
            const { driver_id } = req.body;

            // Update ride and driver status
            const [ride] = await prisma.$transaction([
                prisma.ride.update({
                    where: { id: rideId },
                    data: { driver_id, status: 'accepted' }
                }),
                prisma.driver.update({
                    where: { id: driver_id },
                    data: { status: 'busy' }
                })
            ]);

            // Notify Rider
            const io = WebSocketService.getIO();
            io.to(`user_${ride.rider_id}`).emit('rideAccepted', ride);

            res.json(ride);
        } catch (error) {
            console.error('Accept Ride Error:', error);
            res.status(500).json({ error: 'Failed to accept ride' });
        }
    }

    static async updateStatus(req: Request, res: Response): Promise<any> {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const rideId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';

            const ride = await prisma.ride.findUnique({
                where: { id: rideId }
            });

            if (!ride) return res.status(404).json({ error: 'Ride not found' });

            const updatedRide = await prisma.ride.update({
                where: { id: rideId },
                data: { status, updated_at: new Date() }
            });

            const io = WebSocketService.getIO();
            io.to(`user_${ride.rider_id}`).emit('rideStatusUpdate', updatedRide);
            if (ride.driver_id) io.to(`user_${ride.driver_id}`).emit('rideStatusUpdate', updatedRide);

            // SPECIAL LOGIC: Requirement #6 & #7 - 20% Commission on Completion
            if (status === 'completed' && ride.driver_id) {
                const fare = Number(ride.proposed_fare || ride.fare);
                const commission = fare * 0.20;

                // 1. Mark Driver as Available again
                // 2. Deduct Commission from Driver Wallet
                // 3. Record System Transaction
                await prisma.$transaction([
                    prisma.driver.update({
                        where: { id: ride.driver_id },
                        data: { status: 'available' }
                    }),
                    prisma.user.update({
                        where: { id: ride.driver_id },
                        data: { balance: { decrement: commission } }
                    }),
                    prisma.transaction.create({
                        data: {
                            user_id: ride.driver_id,
                            amount: commission,
                            type: 'debit',
                            status: 'completed',
                            description: `System Commission (20%) for Ride ${ride.id}`
                        }
                    })
                ]);
            }

            res.json(updatedRide);
        } catch (error) {
            console.error('Update Status Error:', error);
            res.status(500).json({ error: 'Failed to update ride status' });
        }
    }
}
