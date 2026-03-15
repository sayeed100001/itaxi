import { query } from '../db-config.js';
import fs from 'fs';
import path from 'path';

export class TripRecordingService {
    static async start(rideId: string, userId: string) {
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const filePath = `recordings/${rideId}_${id}.webm`;
        
        await query(
            `INSERT INTO trip_recordings (id, ride_id, user_id, file_path, status, started_at)
             VALUES (?, ?, ?, ?, 'recording', datetime('now'))`,
            [id, rideId, userId, filePath]
        );
        
        await query(`UPDATE rides SET recording_enabled = 1, recording_url = ? WHERE id = ?`, [filePath, rideId]);
        
        return { id, filePath };
    }
    
    static async stop(recordingId: string) {
        const result = await query(`SELECT file_path FROM trip_recordings WHERE id = ?`, [recordingId]);
        if (result.rows.length === 0) return;
        
        const filePath = result.rows[0].file_path;
        const fullPath = path.join(process.cwd(), filePath);
        
        let fileSize = 0;
        if (fs.existsSync(fullPath)) {
            fileSize = fs.statSync(fullPath).size;
        }
        
        await query(
            `UPDATE trip_recordings SET status = 'completed', stopped_at = datetime('now'), file_size = ? WHERE id = ?`,
            [fileSize, recordingId]
        );
    }
    
    static async deleteOld() {
        const result = await query(
            `SELECT id, file_path FROM trip_recordings 
             WHERE status = 'completed' 
             AND stopped_at < datetime('now', '-30 days')
             AND status != 'deleted'`
        );
        
        for (const record of result.rows) {
            const fullPath = path.join(process.cwd(), record.file_path);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
            
            await query(
                `UPDATE trip_recordings SET status = 'deleted', deleted_at = datetime('now'), deletion_reason = 'auto_cleanup' WHERE id = ?`,
                [record.id]
            );
        }
    }
}
