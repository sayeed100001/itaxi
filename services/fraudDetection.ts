import { query } from '../db-config.js';

export class FraudDetectionService {
  static async checkRide(rideId: string, userId: string): Promise<{ isFraud: boolean; reasons: string[] }> {
    const reasons: string[] = [];
    let score = 0;

    const checks = [
      this.checkMultipleRidesShortTime(userId),
      this.checkUnusualDistance(rideId),
      this.checkCancelPattern(userId),
      this.checkLocationJumps(userId),
      this.checkPaymentPattern(userId),
    ];

    const results = await Promise.all(checks);
    
    results.forEach(result => {
      score += result.score;
      if (result.reason) reasons.push(result.reason);
    });

    const isFraud = score >= 50;

    if (isFraud) {
      await query(
        `INSERT INTO fraud_logs (id, user_id, ride_id, type, severity, description, data, created_at)
         VALUES (?, ?, ?, 'ride_fraud', ?, ?, ?, datetime('now'))`,
        [Date.now().toString(36), userId, rideId, 
         score >= 80 ? 'critical' : score >= 60 ? 'high' : 'medium',
         reasons.join('; '),
         JSON.stringify({ score, reasons })]
      );
    }

    return { isFraud, reasons };
  }

  private static async checkMultipleRidesShortTime(userId: string): Promise<{ score: number; reason?: string }> {
    const result = await query(
      `SELECT COUNT(*) as count FROM rides 
       WHERE rider_id = ? AND created_at > datetime('now', '-10 minutes')`,
      [userId]
    );

    const count = result.rows[0].count;
    if (count > 5) {
      return { score: 30, reason: 'Multiple rides in short time' };
    }
    return { score: 0 };
  }

  private static async checkUnusualDistance(rideId: string): Promise<{ score: number; reason?: string }> {
    const result = await query(
      `SELECT distance FROM rides WHERE id = ?`,
      [rideId]
    );

    const distance = result.rows[0]?.distance || 0;
    if (distance > 200) {
      return { score: 20, reason: 'Unusual distance' };
    }
    return { score: 0 };
  }

  private static async checkCancelPattern(userId: string): Promise<{ score: number; reason?: string }> {
    const result = await query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
       FROM rides 
       WHERE rider_id = ? AND created_at > datetime('now', '-7 days')`,
      [userId]
    );

    const { total, cancelled } = result.rows[0];
    if (total > 0 && (cancelled / total) > 0.5) {
      return { score: 25, reason: 'High cancellation rate' };
    }
    return { score: 0 };
  }

  private static async checkLocationJumps(userId: string): Promise<{ score: number; reason?: string }> {
    const result = await query(
      `SELECT pickup_lat, pickup_lng, created_at 
       FROM rides 
       WHERE rider_id = ? 
       ORDER BY created_at DESC 
       LIMIT 2`,
      [userId]
    );

    if (result.rows.length === 2) {
      const [current, previous] = result.rows;
      const distance = Math.sqrt(
        Math.pow(current.pickup_lat - previous.pickup_lat, 2) +
        Math.pow(current.pickup_lng - previous.pickup_lng, 2)
      ) * 111;

      const timeDiff = (new Date(current.created_at).getTime() - new Date(previous.created_at).getTime()) / 1000 / 60;

      if (distance > 50 && timeDiff < 30) {
        return { score: 35, reason: 'Impossible location jump' };
      }
    }
    return { score: 0 };
  }

  private static async checkPaymentPattern(userId: string): Promise<{ score: number; reason?: string }> {
    const result = await query(
      `SELECT COUNT(*) as failed_count 
       FROM transactions 
       WHERE user_id = ? AND status = 'failed' AND created_at > datetime('now', '-24 hours')`,
      [userId]
    );

    const failedCount = result.rows[0].failed_count;
    if (failedCount > 3) {
      return { score: 20, reason: 'Multiple failed payments' };
    }
    return { score: 0 };
  }

  static async getFraudStats(): Promise<any> {
    const result = await query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
         SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
         SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium
       FROM fraud_logs 
       WHERE created_at > datetime('now', '-7 days')`
    );

    return result.rows[0];
  }
}
