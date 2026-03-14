import bcrypt from 'bcrypt';
import twilio from 'twilio';

import { query } from '../db-config.js';

export type LoginOtpChannel = 'whatsapp' | 'email';

export type LoginOtpStartResult = {
    sessionId: string;
    channel: LoginOtpChannel;
    maskedTo: string;
    expiresAtIso: string;
};

const generateCode = (digits = 6) => {
    const len = Math.max(4, Math.min(8, Math.floor(digits)));
    const max = 10 ** len;
    const n = Math.floor(Math.random() * max);
    return n.toString().padStart(len, '0');
};

const maskPhone = (phone: string) => {
    const p = String(phone || '').trim();
    if (!p) return '';
    const last = p.slice(-2);
    return `${p.slice(0, 2)}***${last}`;
};

const maskEmail = (email: string) => {
    const e = String(email || '').trim();
    const at = e.indexOf('@');
    if (at <= 1) return e ? '***' : '';
    const user = e.slice(0, at);
    const domain = e.slice(at + 1);
    const userMasked = `${user[0]}***${user.slice(-1)}`;
    const domainParts = domain.split('.');
    const domainRoot = domainParts[0] || '';
    const domainMasked = domainRoot ? `${domainRoot[0]}***` : '***';
    return `${userMasked}@${domainMasked}.${domainParts.slice(1).join('.') || ''}`.replace(/\.$/, '');
};

const getTwilioClient = () => {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
    try {
        return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    } catch {
        return null;
    }
};

const isWhatsAppFrom = (v: string) => /^whatsapp:/i.test(v.trim());
const ensureWhatsAppPrefix = (v: string) => {
    const s = String(v || '').trim();
    if (!s) return s;
    return isWhatsAppFrom(s) ? s : `whatsapp:${s}`;
};

async function sendWhatsAppOtp(toPhone: string, code: string) {
    const client = getTwilioClient();
    const from = String(process.env.TWILIO_WHATSAPP_FROM || '').trim();
    if (!client || !from) {
        throw new Error('TWILIO_WHATSAPP_NOT_CONFIGURED');
    }

    const to = ensureWhatsAppPrefix(toPhone);
    const fromWhatsApp = ensureWhatsAppPrefix(from);

    const body = `iTaxi verification code: ${code}\n\nIf you did not request this, ignore this message.`;
    await client.messages.create({ to, from: fromWhatsApp, body });
}

async function sendEmailOtp(toEmail: string, code: string) {
    const host = String(process.env.SMTP_HOST || '').trim();
    const user = String(process.env.SMTP_USER || '').trim();
    const pass = String(process.env.SMTP_PASS || '').trim();

    if (!host || !user || !pass) {
        throw new Error('SMTP_NOT_CONFIGURED');
    }

    const port = Number.parseInt(process.env.SMTP_PORT || '', 10) || 587;
    const secure = String(process.env.SMTP_SECURE || '').trim() === '1' || port === 465;
    const from = String(process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
    if (!from) {
        throw new Error('SMTP_FROM_MISSING');
    }

    // Lazy import to keep startup fast and allow optional dependency checks.
    const nodemailer: any = await import('nodemailer');
    const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass }
    });

    const subject = 'Your iTaxi verification code';
    const text = `Your iTaxi verification code is: ${code}\n\nThis code expires soon. If you did not request this, you can ignore this email.`;

    await transporter.sendMail({
        from,
        to: toEmail,
        subject,
        text
    });
}

export class LoginOtpService {
    static generateCode(digits = 6) {
        return generateCode(digits);
    }

    static async start(params: {
        userId: string;
        phone: string;
        email?: string | null;
        channel: LoginOtpChannel;
        ttlSeconds: number;
        maxAttempts: number;
    }): Promise<LoginOtpStartResult> {
        const ttlSeconds = Math.max(60, Math.min(15 * 60, Number(params.ttlSeconds) || 300));
        const maxAttempts = Math.max(3, Math.min(10, Number(params.maxAttempts) || 5));
        const channel: LoginOtpChannel = params.channel === 'email' ? 'email' : 'whatsapp';

        const destination =
            channel === 'email'
                ? String(params.email || '').trim()
                : String(params.phone || '').trim();

        if (!destination) {
            throw new Error(channel === 'email' ? 'EMAIL_MISSING' : 'PHONE_MISSING');
        }

        const sessionId = `otp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
        const code = generateCode(6);
        const codeHash = await bcrypt.hash(code, 10);
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

        await query(
            `INSERT INTO login_otp_sessions (id, user_id, channel, code_hash, attempts, max_attempts, expires_at)
             VALUES (?, ?, ?, ?, 0, ?, ?)`,
            [sessionId, params.userId, channel, codeHash, maxAttempts, expiresAt]
        );

        const maskedTo = channel === 'whatsapp' ? maskPhone(destination) : maskEmail(destination);

        // Optional dev-only bypass for local QA (never enable in production).
        // This allows testing OTP flows without real delivery providers.
        const devBypass = process.env.NODE_ENV !== 'production' && process.env.OTP_DEV_BYPASS === '1';
        if (devBypass) {
            // eslint-disable-next-line no-console
            console.log(`[DEV OTP] user=${params.userId} channel=${channel} to=${destination} code=${code}`);
        } else {
            // Deliver code (fail hard if delivery isn't configured; admin can disable OTP).
            if (channel === 'whatsapp') {
                await sendWhatsAppOtp(destination, code);
            } else {
                await sendEmailOtp(destination, code);
            }
        }

        return {
            sessionId,
            channel,
            maskedTo,
            expiresAtIso: expiresAt.toISOString()
        };
    }

    static async verifyAndConsume(params: { sessionId: string; userId: string; code: string }): Promise<boolean> {
        const sessionId = String(params.sessionId || '').trim();
        const userId = String(params.userId || '').trim();
        const code = String(params.code || '').trim();
        if (!sessionId || !userId || !code) return false;

        const res = await query(
            `SELECT id, user_id, code_hash, attempts, max_attempts, expires_at, consumed_at
             FROM login_otp_sessions
             WHERE id = ? LIMIT 1`,
            [sessionId]
        );
        const row = res.rows?.[0];
        if (!row) return false;
        if (String(row.user_id) !== userId) return false;
        if (row.consumed_at) return false;

        const expiresAt = new Date(row.expires_at);
        if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) return false;

        const attempts = Number(row.attempts) || 0;
        const maxAttempts = Number(row.max_attempts) || 5;
        if (attempts >= maxAttempts) return false;

        const ok = await bcrypt.compare(code, String(row.code_hash || ''));
        if (!ok) {
            await query("UPDATE login_otp_sessions SET attempts = attempts + 1 WHERE id = ?", [sessionId]);
            return false;
        }

        await query("UPDATE login_otp_sessions SET consumed_at = NOW() WHERE id = ?", [sessionId]);
        return true;
    }
}
