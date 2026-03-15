import { query } from '../db-config.js';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY 
    ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-01-27.acacia' as any })
    : null;

export class InstantPayoutService {
    static async request(driverId: string, amount: number) {
        const fee = Math.round(amount * 0.02);
        const netAmount = amount - fee;
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        
        await query(
            `INSERT INTO instant_payouts (id, driver_id, amount, fee, status, requested_at)
             VALUES (?, ?, ?, ?, 'processing', datetime('now'))`,
            [id, driverId, netAmount, fee]
        );
        
        try {
            if (stripe) {
                const driverResult = await query(`SELECT stripe_account_id FROM drivers WHERE id = ?`, [driverId]);
                if (driverResult.rows[0]?.stripe_account_id) {
                    await stripe.transfers.create({
                        amount: Math.round(netAmount * 100),
                        currency: 'usd',
                        destination: driverResult.rows[0].stripe_account_id,
                    });
                }
            }
            
            await query(
                `UPDATE instant_payouts SET status = 'completed', completed_at = datetime('now') WHERE id = ?`,
                [id]
            );
            
            await query(`UPDATE users SET balance = balance - ? WHERE id = ?`, [amount, driverId]);
            
            return { success: true, amount: netAmount, fee };
        } catch (error) {
            await query(`UPDATE instant_payouts SET status = 'failed' WHERE id = ?`, [id]);
            throw error;
        }
    }
}
