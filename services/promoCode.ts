import { query } from '../db-config';

export interface PromoCode {
    id: string;
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    maxUses: number;
    usedCount: number;
    minFare: number;
    maxDiscount: number;
    validFrom: Date;
    validUntil: Date;
    active: boolean;
}

export class PromoCodeService {
    static async create(data: Omit<PromoCode, 'id' | 'usedCount'>): Promise<PromoCode> {
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        
        await query(
            `INSERT INTO promo_codes (id, code, type, value, max_uses, used_count, min_fare, max_discount, valid_from, valid_until, active)
             VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
            [id, data.code.toUpperCase(), data.type, data.value, data.maxUses, data.minFare, data.maxDiscount, data.validFrom, data.validUntil, data.active]
        );

        return { ...data, id, usedCount: 0 };
    }

    static async validate(code: string, fare: number, userId: string): Promise<{ valid: boolean; discount: number; message?: string }> {
        const result = await query(
            `SELECT * FROM promo_codes WHERE UPPER(code) = UPPER(?) AND active = 1`,
            [code]
        );

        if (result.rows.length === 0) {
            return { valid: false, discount: 0, message: 'Invalid promo code' };
        }

        const promo = result.rows[0];
        const now = new Date();

        if (new Date(promo.valid_from) > now) {
            return { valid: false, discount: 0, message: 'Promo code not yet valid' };
        }

        if (new Date(promo.valid_until) < now) {
            return { valid: false, discount: 0, message: 'Promo code expired' };
        }

        if (promo.used_count >= promo.max_uses) {
            return { valid: false, discount: 0, message: 'Promo code usage limit reached' };
        }

        if (fare < promo.min_fare) {
            return { valid: false, discount: 0, message: `Minimum fare ؋${promo.min_fare} required` };
        }

        // Check if user already used this code
        const usageResult = await query(
            `SELECT COUNT(*) as count FROM promo_code_usage WHERE promo_code_id = ? AND user_id = ?`,
            [promo.id, userId]
        );

        if (usageResult.rows[0].count > 0) {
            return { valid: false, discount: 0, message: 'You have already used this promo code' };
        }

        let discount = 0;
        if (promo.type === 'percentage') {
            discount = Math.round((fare * promo.value) / 100);
            if (promo.max_discount > 0) {
                discount = Math.min(discount, promo.max_discount);
            }
        } else {
            discount = promo.value;
        }

        return { valid: true, discount };
    }

    static async apply(code: string, userId: string, rideId: string, discount: number): Promise<void> {
        const result = await query(
            `SELECT id FROM promo_codes WHERE UPPER(code) = UPPER(?)`,
            [code]
        );

        if (result.rows.length > 0) {
            const promoId = result.rows[0].id;

            await query(
                `INSERT INTO promo_code_usage (id, promo_code_id, user_id, ride_id, discount_amount, used_at)
                 VALUES (?, ?, ?, ?, ?, datetime('now'))`,
                [Date.now().toString(36), promoId, userId, rideId, discount]
            );

            await query(
                `UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?`,
                [promoId]
            );
        }
    }

    static async getAll(): Promise<PromoCode[]> {
        const result = await query(
            `SELECT * FROM promo_codes ORDER BY created_at DESC`
        );
        return result.rows;
    }

    static async deactivate(id: string): Promise<void> {
        await query(`UPDATE promo_codes SET active = 0 WHERE id = ?`, [id]);
    }
}
