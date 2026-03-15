import crypto from 'crypto';
import { query } from '../db-config.js';

export class EncryptionService {
    static generateKeyPair() {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        return { publicKey, privateKey };
    }
    
    static async storePublicKey(userId: string, publicKey: string) {
        await query(
            `UPDATE users SET public_key = ?, key_generated_at = datetime('now') WHERE id = ?`,
            [publicKey, userId]
        );
    }
    
    static async getPublicKey(userId: string): Promise<string | null> {
        const result = await query(`SELECT public_key FROM users WHERE id = ?`, [userId]);
        return result.rows[0]?.public_key || null;
    }
    
    static encrypt(message: string, publicKey: string): string {
        const buffer = Buffer.from(message, 'utf8');
        const encrypted = crypto.publicEncrypt(
            { key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
            buffer
        );
        return encrypted.toString('base64');
    }
    
    static decrypt(encryptedMessage: string, privateKey: string): string {
        const buffer = Buffer.from(encryptedMessage, 'base64');
        const decrypted = crypto.privateDecrypt(
            { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
            buffer
        );
        return decrypted.toString('utf8');
    }
    
    static encryptAES(message: string, key: string): { encrypted: string; iv: string } {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
        let encrypted = cipher.update(message, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return {
            encrypted: encrypted + authTag.toString('hex'),
            iv: iv.toString('hex')
        };
    }
    
    static decryptAES(encrypted: string, key: string, iv: string): string {
        const authTag = Buffer.from(encrypted.slice(-32), 'hex');
        const encryptedText = encrypted.slice(0, -32);
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
}
