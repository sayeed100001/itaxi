import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as adminAuthService from '../services/admin-auth.service';

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const adminLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = adminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid admin login payload',
        errors: parsed.error.flatten()
      });
    }

    const { email, password } = parsed.data;
    const result = await adminAuthService.adminLogin(email, password);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
