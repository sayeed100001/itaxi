import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { query } from '../db-config.js';

export interface TwoFactorAuth {
    secret: string;
    qrCode: string;
}

export class TwoFactorService {
    static async generateSecret(userId: string, userEmail: string): Promise<TwoFactorAuth> {
        const secret = speakeasy.generateSecret({
            name: `iTaxi (${userEmail})`,
            issuer: 'iTaxi Afghanistan'
        });

        const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

        await query(
            'UPDATE users SET two_factor_secret = ?, two_factor_enabled = false WHERE id = ?',
            [secret.base32, userId]
        );

        return {
            secret: secret.base32,
            qrCode
        };
    }

    static async verifyToken(userId: string, token: string): Promise<boolean> {
        const result = await query(
            'SELECT two_factor_secret FROM users WHERE id = ?',
            [userId]
        );

        if (result.rows.length === 0 || !result.rows[0].two_factor_secret) {
            return false;
        }

        return speakeasy.totp.verify({
            secret: result.rows[0].two_factor_secret,
            encoding: 'base32',
            token,
            window: 2
        });
    }

    static async enable2FA(userId: string, token: string): Promise<boolean> {
        const isValid = await this.verifyToken(userId, token);
        
        if (isValid) {
            await query(
                'UPDATE users SET two_factor_enabled = true WHERE id = ?',
                [userId]
            );
        }

        return isValid;
    }

    static async disable2FA(userId: string, password: string): Promise<boolean> {
        // Verify password first
        const result = await query(
            'SELECT password_hash FROM users WHERE id = ?',
            [userId]
        );

        if (result.rows.length === 0) {
            return false;
        }

        const bcrypt = await import('bcrypt');
        const isValidPassword = await bcrypt.compare(password, result.rows[0].password_hash);

        if (isValidPassword) {
            await query(
                'UPDATE users SET two_factor_enabled = false, two_factor_secret = NULL WHERE id = ?',
                [userId]
            );
            return true;
        }

        return false;
    }

    static async is2FAEnabled(userId: string): Promise<boolean> {
        const result = await query(
            'SELECT two_factor_enabled FROM users WHERE id = ?',
            [userId]
        );

        if (result.rows.length === 0) return false;
        const v = result.rows[0]?.two_factor_enabled;
        return v === true || v === 1 || v === '1';
    }
}
