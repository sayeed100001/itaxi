import { createClient } from 'redis';

class CacheService {
    private client: any = null;
    private isConnected: boolean = false;

    async connect() {
        if (this.isConnected) return;

        if (!process.env.REDIS_URL) {
            console.warn('⚠️ Redis not configured - caching disabled');
            return;
        }

        try {
            this.client = createClient({ url: process.env.REDIS_URL });
            await this.client.connect();
            this.isConnected = true;
            console.log('✅ Redis connected');
        } catch (error) {
            console.error('❌ Redis connection failed:', error);
        }
    }

    async get(key: string): Promise<any> {
        if (!this.isConnected) return null;
        try {
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }

    async set(key: string, value: any, ttl: number = 300): Promise<void> {
        if (!this.isConnected) return;
        try {
            await this.client.setEx(key, ttl, JSON.stringify(value));
        } catch (error) {
            console.error('Cache set error:', error);
        }
    }

    async del(key: string): Promise<void> {
        if (!this.isConnected) return;
        try {
            await this.client.del(key);
        } catch (error) {
            console.error('Cache delete error:', error);
        }
    }

    async invalidatePattern(pattern: string): Promise<void> {
        if (!this.isConnected) return;
        try {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(keys);
            }
        } catch (error) {
            console.error('Cache invalidate error:', error);
        }
    }
}

export const cache = new CacheService();
