import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { z } from 'zod';
import axios from 'axios';
import { logAudit } from '../utils/audit';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import bcrypt from 'bcryptjs';

const authService = new AuthService();

const requestOTPSchema = z.object({
  phone: z.string().min(10),
  name: z.string().min(2).optional(),
  role: z.enum(['RIDER', 'DRIVER', 'ADMIN']).optional(),
  captchaToken: z.string().optional(),
});

const verifyOTPSchema = z.object({
  phone: z.string().min(10),
  code: z.string().length(6),
  name: z.string().min(2).optional(),
  role: z.enum(['RIDER', 'DRIVER', 'ADMIN']).optional(),
});

export class AuthController {
  async requestOTP(req: Request, res: Response, next: NextFunction) {
    try {
      const data = requestOTPSchema.parse(req.body);

      // reCAPTCHA verification if enabled
      if (process.env.ENABLE_RECAPTCHA === 'true') {
        if (!data.captchaToken) {
          return res.status(400).json({ success: false, message: 'CAPTCHA required' });
        }

        const recaptchaResponse = await axios.post(
          'https://www.google.com/recaptcha/api/siteverify',
          null,
          {
            params: {
              secret: process.env.RECAPTCHA_SECRET,
              response: data.captchaToken,
            },
          }
        );

        if (!recaptchaResponse.data.success) {
          return res.status(400).json({ success: false, message: 'CAPTCHA verification failed' });
        }
      }

      const result = await authService.requestOTP(data.phone, data.name, data.role);
      
      await logAudit(null, 'OTP_REQUESTED', { phone: data.phone, role: data.role }, req.ip, req.get('user-agent'));
      
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async verifyOTP(req: Request, res: Response, next: NextFunction) {
    try {
      const data = verifyOTPSchema.parse(req.body);
      const result = await authService.verifyOTP(data.phone, data.code, data.name, data.role);
      
      await logAudit(result.user.id, 'OTP_VERIFIED', { phone: data.phone }, req.ip, req.get('user-agent'));
      
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, email, city, province } = req.body;
      const userId = req.user!.id;

      const user = await prisma.user.update({
        where: { id: userId },
        data: { name, email, city, province },
      });

      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user!.id;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.password) {
        return res.status(400).json({ success: false, message: 'Password not set' });
      }

      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  }

  async changePhone(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { newPhone, otp } = req.body;
      const userId = req.user!.id;

      // Verify OTP for new phone
      const otpRecord = await prisma.oTP.findFirst({
        where: {
          phone: newPhone,
          code: otp,
          verified: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!otpRecord) {
        return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
      }

      // Check if phone already exists
      const existing = await prisma.user.findUnique({ where: { phone: newPhone } });
      if (existing && existing.id !== userId) {
        return res.status(400).json({ success: false, message: 'Phone number already in use' });
      }

      // Update phone
      await prisma.user.update({
        where: { id: userId },
        data: { phone: newPhone },
      });

      // Mark OTP as verified
      await prisma.oTP.update({
        where: { id: otpRecord.id },
        data: { verified: true },
      });

      res.json({ success: true, message: 'Phone number changed successfully' });
    } catch (error) {
      next(error);
    }
  }
}
