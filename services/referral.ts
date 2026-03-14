import { query } from '../db-config';

export class ReferralService {
    static async generateCode(userId: string): Promise<string> {
        const result = await query(
            `SELECT referral_code FROM users WHERE id = ?`,
            [userId]
        );

        if (result.rows[0]?.referral_code) {
            return result.rows[0].referral_code;
        }

        const code = this.generateUniqueCode();
        await query(
            `UPDATE users SET referral_code = ? WHERE id = ?`,
            [code, userId]
        );

        return code;
    }

    private static generateUniqueCode(): string {
        return 'ITAXI' + Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    static async applyReferral(newUserId: string, referralCode: string): Promise<{ success: boolean; message: string }> {
        // Find referrer
        const referrerResult = await query(
            `SELECT id, name FROM users WHERE referral_code = ?`,
            [referralCode]
        );

        if (referrerResult.rows.length === 0) {
            return { success: false, message: 'Invalid referral code' };
        }

        const referrerId = referrerResult.rows[0].id;

        // Check if new user already used a referral
        const existingResult = await query(
            `SELECT * FROM referrals WHERE referred_user_id = ?`,
            [newUserId]
        );

        if (existingResult.rows.length > 0) {
            return { success: false, message: 'You have already used a referral code' };
        }

        // Create referral record
        await query(
            `INSERT INTO referrals (id, referrer_id, referred_user_id, status, created_at)
             VALUES (?, ?, ?, 'pending', datetime('now'))`,
            [Date.now().toString(36), referrerId, newUserId]
        );

        // Give bonus to new user (50 AFN)
        await query(
            `UPDATE users SET balance = balance + 50 WHERE id = ?`,
            [newUserId]
        );

        await query(
            `INSERT INTO transactions (id, user_id, amount, type, description, created_at)
             VALUES (?, ?, 50, 'credit', 'Referral bonus', datetime('now'))`,
            [Date.now().toString(36), newUserId]
        );

        return { success: true, message: '؋50 bonus added to your wallet!' };
    }

    static async completeReferral(referredUserId: string): Promise<void> {
        // Check if referred user completed first ride
        const rideResult = await query(
            `SELECT COUNT(*) as count FROM rides WHERE rider_id = ? AND status = 'completed'`,
            [referredUserId]
        );

        if (rideResult.rows[0].count >= 1) {
            // Get referral
            const referralResult = await query(
                `SELECT * FROM referrals WHERE referred_user_id = ? AND status = 'pending'`,
                [referredUserId]
            );

            if (referralResult.rows.length > 0) {
                const referral = referralResult.rows[0];

                // Give bonus to referrer (100 AFN)
                await query(
                    `UPDATE users SET balance = balance + 100 WHERE id = ?`,
                    [referral.referrer_id]
                );

                await query(
                    `INSERT INTO transactions (id, user_id, amount, type, description, created_at)
                     VALUES (?, ?, 100, 'credit', 'Referral reward', datetime('now'))`,
                    [Date.now().toString(36), referral.referrer_id]
                );

                // Mark referral as completed
                await query(
                    `UPDATE referrals SET status = 'completed', completed_at = datetime('now') WHERE id = ?`,
                    [referral.id]
                );
            }
        }
    }

    static async getStats(userId: string): Promise<{ total: number; completed: number; pending: number; earnings: number }> {
        const result = await query(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
             FROM referrals WHERE referrer_id = ?`,
            [userId]
        );

        const stats = result.rows[0];
        const earnings = (stats.completed || 0) * 100;

        return {
            total: stats.total || 0,
            completed: stats.completed || 0,
            pending: stats.pending || 0,
            earnings
        };
    }
}
