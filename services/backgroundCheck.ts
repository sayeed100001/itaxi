import { query } from '../db-config';

export class BackgroundCheckService {
    static async submit(driverId: string, documents: { nationalId: string; drivingLicense: string; criminalRecord: string }) {
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        
        await query(
            `INSERT INTO background_checks (id, driver_id, national_id, driving_license, criminal_record, status, submitted_at)
             VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))`,
            [id, driverId, documents.nationalId, documents.drivingLicense, documents.criminalRecord]
        );
        
        await query(
            `UPDATE drivers SET background_check_status = 'pending' WHERE id = ?`,
            [driverId]
        );
        
        return { id, status: 'pending' };
    }
    
    static async review(checkId: string, reviewerId: string, status: 'approved' | 'rejected', reason?: string) {
        await query(
            `UPDATE background_checks SET status = ?, reviewed_by = ?, rejection_reason = ?, reviewed_at = datetime('now') WHERE id = ?`,
            [status, reviewerId, reason || null, checkId]
        );
        
        const result = await query(`SELECT driver_id FROM background_checks WHERE id = ?`, [checkId]);
        if (result.rows.length > 0) {
            await query(
                `UPDATE drivers SET background_check_status = ?, background_check_date = datetime('now') WHERE id = ?`,
                [status, result.rows[0].driver_id]
            );
        }
    }
    
    static async getPending() {
        const result = await query(
            `SELECT bc.*, u.name as driver_name, u.phone as driver_phone
             FROM background_checks bc
             JOIN users u ON bc.driver_id = u.id
             WHERE bc.status = 'pending'
             ORDER BY bc.submitted_at ASC`
        );
        return result.rows;
    }
}
