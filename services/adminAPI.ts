import { apiFetch } from './api';

export interface TaxiTypeAPI {
    id: string;
    name_fa: string;
    name_en: string;
    description_fa?: string;
    description_en?: string;
    base_fare: number;
    per_km_rate: number;
    color: string;
    image_path?: string;
    features?: string[];
    min_rating?: number;
    min_rides?: number;
    icon_size?: [number, number];
    is_active?: boolean;
}

export interface SystemMetrics {
    server: {
        cpu: number;
        memory: number;
        disk: number;
        uptime: number;
        status: 'healthy' | 'warning' | 'critical';
    };
    database: {
        connections: number;
        queries: number;
        responseTime: number;
        status: 'healthy' | 'warning' | 'critical';
    };
    realtime: {
        activeUsers: number;
        activeDrivers: number;
        activeRides: number;
        socketConnections: number;
    };
    performance: {
        avgResponseTime: number;
        errorRate: number;
        throughput: number;
        availability: number;
    };
}

export class AdminAPI {
    // Taxi Types Management
    static async getTaxiTypes(): Promise<TaxiTypeAPI[]> {
        try {
            const response = await apiFetch('/api/admin/taxi-types');
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || 'Failed to fetch taxi types');
            }
            return response.json();
        } catch (error) {
            console.error('AdminAPI.getTaxiTypes error:', error);
            throw error;
        }
    }

    static async createTaxiType(taxiType: Omit<TaxiTypeAPI, 'id'>): Promise<{ id: string }> {
        try {
            const response = await apiFetch('/api/admin/taxi-types', {
                method: 'POST',
                body: JSON.stringify(taxiType)
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || 'Failed to create taxi type');
            }
            return response.json();
        } catch (error) {
            console.error('AdminAPI.createTaxiType error:', error);
            throw error;
        }
    }

    static async updateTaxiType(id: string, taxiType: Partial<TaxiTypeAPI>): Promise<void> {
        try {
            const response = await apiFetch(`/api/admin/taxi-types/${id}`, {
                method: 'PUT',
                body: JSON.stringify(taxiType)
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || 'Failed to update taxi type');
            }
        } catch (error) {
            console.error('AdminAPI.updateTaxiType error:', error);
            throw error;
        }
    }

    static async deleteTaxiType(id: string): Promise<void> {
        try {
            const response = await apiFetch(`/api/admin/taxi-types/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || 'Failed to delete taxi type');
            }
        } catch (error) {
            console.error('AdminAPI.deleteTaxiType error:', error);
            throw error;
        }
    }

    // System Monitoring
    static async getSystemMetrics(): Promise<SystemMetrics> {
        try {
            const response = await apiFetch('/api/admin/system-metrics');
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || 'Failed to fetch system metrics');
            }
            return response.json();
        } catch (error) {
            console.error('AdminAPI.getSystemMetrics error:', error);
            // Return mock data on error
            return {
                server: { cpu: 0, memory: 0, disk: 0, uptime: 0, status: 'critical' },
                database: { connections: 0, queries: 0, responseTime: 0, status: 'critical' },
                realtime: { activeUsers: 0, activeDrivers: 0, activeRides: 0, socketConnections: 0 },
                performance: { avgResponseTime: 0, errorRate: 1, throughput: 0, availability: 0 }
            };
        }
    }

    // File Upload
    static async uploadImage(file: File, type: 'taxi-icon' | 'logo'): Promise<{ url: string }> {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);

            const response = await apiFetch('/api/admin/upload', {
                method: 'POST',
                body: formData,
                headers: {} // Remove Content-Type to let browser set it for FormData
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || 'Failed to upload image');
            }
            return response.json();
        } catch (error) {
            console.error('AdminAPI.uploadImage error:', error);
            throw error;
        }
    }

    // System Settings
    static async getSystemSettings(): Promise<any> {
        try {
            const response = await apiFetch('/api/admin/system-settings');
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || 'Failed to fetch system settings');
            }
            return response.json();
        } catch (error) {
            console.error('AdminAPI.getSystemSettings error:', error);
            throw error;
        }
    }

    static async updateSystemSettings(settings: any): Promise<void> {
        try {
            const response = await apiFetch('/api/admin/system-settings', {
                method: 'PUT',
                body: JSON.stringify(settings)
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || 'Failed to update system settings');
            }
        } catch (error) {
            console.error('AdminAPI.updateSystemSettings error:', error);
            throw error;
        }
    }

    // Admin Logs
    static async logAdminAction(action: string, targetType?: string, targetId?: string, oldValues?: any, newValues?: any): Promise<void> {
        try {
            const response = await apiFetch('/api/admin/log', {
                method: 'POST',
                body: JSON.stringify({
                    action,
                    targetType,
                    targetId,
                    oldValues: oldValues ? JSON.stringify(oldValues) : null,
                    newValues: newValues ? JSON.stringify(newValues) : null
                })
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.warn('Failed to log admin action:', error.error);
            }
        } catch (error) {
            console.warn('AdminAPI.logAdminAction error:', error);
            // Don't throw error for logging failures
        }
    }

    // Database Health Check
    static async checkDatabaseHealth(): Promise<{ status: string; message: string }> {
        try {
            const response = await apiFetch('/api/admin/health/database');
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || 'Database health check failed');
            }
            return response.json();
        } catch (error) {
            console.error('AdminAPI.checkDatabaseHealth error:', error);
            return { status: 'error', message: 'Database connection failed' };
        }
    }

    // Integration Test
    static async runIntegrationTest(): Promise<{ status: string; results: any[] }> {
        try {
            const response = await apiFetch('/api/admin/test/integration');
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || 'Integration test failed');
            }
            return response.json();
        } catch (error) {
            console.error('AdminAPI.runIntegrationTest error:', error);
            return { status: 'error', results: [] };
        }
    }
}