import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiConfigService } from '../services/apiConfig.service';

const whatsappSchema = z.object({
  phoneNumberId: z.string().min(1),
  accessToken: z.string().min(1),
  appSecret: z.string().optional(),
  verifyToken: z.string().optional(),
});

const orsSchema = z.object({
  apiKey: z.string().min(1),
});

export class AdminConfigController {
  async getWhatsApp(req: Request, res: Response, next: NextFunction) {
    try {
      const config = await apiConfigService.getWhatsAppConfig();
      if (!config) {
        return res.json({ success: true, data: null });
      }

      // Mask sensitive values when returning to UI
      const mask = (value?: string) =>
        value && value.length > 6 ? `${value.slice(0, 3)}***${value.slice(-3)}` : value || '';

      res.json({
        success: true,
        data: {
          phoneNumberId: config.phoneNumberId,
          appSecret: config.appSecret ? '********' : '',
          verifyToken: config.verifyToken ? '********' : '',
          accessTokenMasked: mask(config.accessToken),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateWhatsApp(req: Request, res: Response, next: NextFunction) {
    try {
      const body = whatsappSchema.parse(req.body);
      await apiConfigService.upsertConfig('WHATSAPP', body);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async getOrs(req: Request, res: Response, next: NextFunction) {
    try {
      const config = await apiConfigService.getOrsConfig();
      if (!config) {
        return res.json({ success: true, data: null });
      }
      res.json({
        success: true,
        data: {
          apiKeyMasked:
            config.apiKey.length > 6
              ? `${config.apiKey.slice(0, 3)}***${config.apiKey.slice(-3)}`
              : config.apiKey,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateOrs(req: Request, res: Response, next: NextFunction) {
    try {
      const body = orsSchema.parse(req.body);
      await apiConfigService.upsertConfig('ORS', body);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export const adminConfigController = new AdminConfigController();

