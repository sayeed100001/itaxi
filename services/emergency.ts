import { query } from '../db-config.js';
import twilio from 'twilio';

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

export interface SOSAlert {
    id: string;
    rideId: string;
    userId: string;
    location: { lat: number; lng: number };
    timestamp: number;
    status: 'active' | 'resolved' | 'false_alarm';
}

export class EmergencyService {
    static async triggerSOS(rideId: string, userId: string, location: { lat: number; lng: number }): Promise<SOSAlert> {
        const alertId = Date.now().toString(36) + Math.random().toString(36).substr(2);

        // Save to database
        await query(
            `INSERT INTO sos_alerts (id, ride_id, user_id, lat, lng, status, created_at) 
             VALUES (?, ?, ?, ?, ?, 'active', NOW())`,
            [alertId, rideId, userId, location.lat, location.lng]
        );

        // Get ride details
        const rideResult = await query(
            `SELECT r.*, 
                    ru.name as rider_name, ru.phone as rider_phone,
                    du.name as driver_name, du.phone as driver_phone
             FROM rides r
             LEFT JOIN users ru ON r.rider_id = ru.id
             LEFT JOIN users du ON r.driver_id = du.id
             WHERE r.id = ?`,
            [rideId]
        );

        if (rideResult.rows.length > 0) {
            const ride = rideResult.rows[0];

            // Notify admin
            await this.notifyAdmin(alertId, ride, location);

            // Notify emergency contacts
            await this.notifyEmergencyContacts(userId, ride, location);

            // Send SMS to police (if configured)
            if (process.env.EMERGENCY_POLICE_NUMBER) {
                await this.notifyPolice(ride, location);
            }
        }

        return {
            id: alertId,
            rideId,
            userId,
            location,
            timestamp: Date.now(),
            status: 'active'
        };
    }

    private static async notifyAdmin(alertId: string, ride: any, location: { lat: number; lng: number }) {
        // Create admin notification
        await query(
            `INSERT INTO notifications (id, user_id, type, title, message, created_at)
             SELECT ?, id, 'emergency', 'SOS Alert', ?, NOW()
             FROM users WHERE role = 'admin'`,
            [
                Date.now().toString(36),
                `Emergency SOS triggered for ride ${ride.id}. Location: ${location.lat}, ${location.lng}`
            ]
        );
    }

    private static async notifyEmergencyContacts(userId: string, ride: any, location: { lat: number; lng: number }) {
        // Get emergency contacts
        const contacts = await query(
            'SELECT phone FROM emergency_contacts WHERE user_id = ?',
            [userId]
        );

        if (twilioClient && contacts.rows.length > 0) {
            const message = `EMERGENCY: ${ride.rider_name} has triggered SOS. Location: https://maps.google.com/?q=${location.lat},${location.lng}`;

            for (const contact of contacts.rows) {
                try {
                    await twilioClient.messages.create({
                        body: message,
                        from: process.env.TWILIO_PHONE_NUMBER,
                        to: contact.phone
                    });
                } catch (error) {
                    console.error('Failed to send SMS:', error);
                }
            }
        }
    }

    private static async notifyPolice(ride: any, location: { lat: number; lng: number }) {
        if (!twilioClient) return;

        const message = `iTaxi Emergency: Ride ID ${ride.id}, Rider: ${ride.rider_name}, Driver: ${ride.driver_name}. Location: https://maps.google.com/?q=${location.lat},${location.lng}`;

        try {
            await twilioClient.messages.create({
                body: message,
                from: process.env.TWILIO_PHONE_NUMBER!,
                to: process.env.EMERGENCY_POLICE_NUMBER!
            });
        } catch (error) {
            console.error('Failed to notify police:', error);
        }
    }

    static async resolveAlert(alertId: string, status: 'resolved' | 'false_alarm') {
        await query(
            'UPDATE sos_alerts SET status = ?, resolved_at = NOW() WHERE id = ?',
            [status, alertId]
        );
    }

    static async getActiveAlerts() {
        // Try full join first; fall back to alerts-only if rides table join fails
        try {
            const result = await query(
                `SELECT s.*, 
                        r.pickup_address, r.dropoff_address,
                        ru.name as rider_name, ru.phone as rider_phone,
                        du.name as driver_name, du.phone as driver_phone
                 FROM sos_alerts s
                 LEFT JOIN rides r ON s.ride_id = r.id
                 LEFT JOIN users ru ON COALESCE(r.rider_id, s.user_id) = ru.id
                 LEFT JOIN users du ON r.driver_id = du.id
                 WHERE s.status = 'active'
                 ORDER BY s.created_at DESC`
            );
            return result.rows;
        } catch {
            // Fallback: return alerts with user info only (no ride join)
            const result = await query(
                `SELECT s.*,
                        u.name as rider_name, u.phone as rider_phone
                 FROM sos_alerts s
                 LEFT JOIN users u ON s.user_id = u.id
                 WHERE s.status = 'active'
                 ORDER BY s.created_at DESC`
            );
            return result.rows;
        }
    }
}
