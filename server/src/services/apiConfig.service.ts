import prisma from '../config/database';
import logger from '../config/logger';

export type ApiProvider = 'WHATSAPP' | 'ORS' | 'STRIPE';

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  appSecret?: string;
  verifyToken?: string;
}

export interface OrsConfig {
  apiKey: string;
}

export class ApiConfigService {
  async getConfig(provider: ApiProvider): Promise<any | null> {
    try {
      const row = await (prisma as any).apiConfig.findUnique({
        where: { provider },
      });
      return row?.config ?? null;
    } catch (error) {
      logger.error('Failed to load ApiConfig', { provider, error });
      return null;
    }
  }

  async upsertConfig(provider: ApiProvider, config: any): Promise<void> {
    try {
      await (prisma as any).apiConfig.upsert({
        where: { provider },
        create: { provider, config },
        update: { config },
      });
    } catch (error) {
      logger.error('Failed to upsert ApiConfig', { provider, error });
      throw error;
    }
  }

  async getWhatsAppConfig(): Promise<WhatsAppConfig | null> {
    const cfg = await this.getConfig('WHATSAPP');
    if (!cfg) return null;
    return {
      phoneNumberId: cfg.phoneNumberId ?? '',
      accessToken: cfg.accessToken ?? '',
      appSecret: cfg.appSecret ?? '',
      verifyToken: cfg.verifyToken ?? '',
    };
  }

  async getOrsConfig(): Promise<OrsConfig | null> {
    const cfg = await this.getConfig('ORS');
    if (!cfg) return null;
    return { apiKey: cfg.apiKey ?? '' };
  }
}

export const apiConfigService = new ApiConfigService();

