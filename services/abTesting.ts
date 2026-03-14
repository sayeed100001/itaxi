import { query } from '../db-config';

export class ABTestingService {
    static async createExperiment(name: string, variants: string[]) {
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        await query(
            `INSERT INTO ab_experiments (id, name, variants, active, created_at)
             VALUES (?, ?, ?, TRUE, datetime('now'))`,
            [id, name, JSON.stringify(variants)]
        );
        return id;
    }
    
    static async assignVariant(experimentId: string, userId: string): Promise<string> {
        const existing = await query(
            `SELECT variant FROM ab_assignments WHERE experiment_id = ? AND user_id = ?`,
            [experimentId, userId]
        );
        
        if (existing.rows.length > 0) {
            return existing.rows[0].variant;
        }
        
        const experiment = await query(`SELECT variants FROM ab_experiments WHERE id = ?`, [experimentId]);
        if (experiment.rows.length === 0) throw new Error('Experiment not found');
        
        const variants = JSON.parse(experiment.rows[0].variants);
        const variant = variants[Math.floor(Math.random() * variants.length)];
        
        await query(
            `INSERT INTO ab_assignments (id, experiment_id, user_id, variant, assigned_at)
             VALUES (?, ?, ?, ?, datetime('now'))`,
            [Date.now().toString(36), experimentId, userId, variant]
        );
        
        return variant;
    }
    
    static async trackEvent(experimentId: string, userId: string, eventName: string, value: number = 0) {
        const assignment = await query(
            `SELECT variant FROM ab_assignments WHERE experiment_id = ? AND user_id = ?`,
            [experimentId, userId]
        );
        
        if (assignment.rows.length === 0) return;
        
        await query(
            `INSERT INTO ab_events (id, experiment_id, user_id, variant, event_name, value, created_at)
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
            [Date.now().toString(36), experimentId, userId, assignment.rows[0].variant, eventName, value]
        );
    }
    
    static async getResults(experimentId: string) {
        const result = await query(
            `SELECT variant, event_name, COUNT(*) as count, AVG(value) as avg_value
             FROM ab_events
             WHERE experiment_id = ?
             GROUP BY variant, event_name`,
            [experimentId]
        );
        return result.rows;
    }
}
