import { query } from '../db-config';

export class PackageDeliveryService {
    static async create(data: any) {
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const distance = Math.sqrt(
            Math.pow(data.dropoffLat - data.pickupLat, 2) + 
            Math.pow(data.dropoffLng - data.pickupLng, 2)
        ) * 111;
        
        let fare = 50;
        if (data.packageType === 'document') fare = 30;
        else if (data.packageType === 'small') fare = 50;
        else if (data.packageType === 'medium') fare = 80;
        else if (data.packageType === 'large') fare = 120;
        
        fare += Math.round(distance * 15);
        
        await query(
            `INSERT INTO package_deliveries (id, sender_id, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, sender_name, sender_phone, recipient_name, recipient_phone, package_type, weight, description, declared_value, fare, distance, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`,
            [id, data.senderId, data.pickupAddress, data.pickupLat, data.pickupLng, data.dropoffAddress, data.dropoffLat, data.dropoffLng, data.senderName, data.senderPhone, data.recipientName, data.recipientPhone, data.packageType, data.weight, data.description, data.declaredValue, fare, distance]
        );
        
        return { id, fare, distance };
    }
    
    static async assign(deliveryId: string, driverId: string) {
        await query(
            `UPDATE package_deliveries SET driver_id = ?, status = 'assigned', assigned_at = datetime('now') WHERE id = ?`,
            [driverId, deliveryId]
        );
    }
    
    static async updateStatus(deliveryId: string, status: string, proofPhoto?: string) {
        if (status === 'delivered') {
            await query(
                `UPDATE package_deliveries SET status = ?, delivered_at = datetime('now'), proof_photo = ? WHERE id = ?`,
                [status, proofPhoto || null, deliveryId]
            );
        } else {
            await query(`UPDATE package_deliveries SET status = ? WHERE id = ?`, [status, deliveryId]);
        }
    }
}
