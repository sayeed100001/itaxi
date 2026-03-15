import { query } from '../db-config.js';

export class EarningsDashboardService {
  static async getDetailedEarnings(driverId: string, period: 'today' | 'week' | 'month' | 'year'): Promise<any> {
    const timeFilter = {
      today: "datetime('now', 'start of day')",
      week: "datetime('now', '-7 days')",
      month: "datetime('now', '-30 days')",
      year: "datetime('now', '-365 days')"
    }[period];

    const result = await query(
      `SELECT 
         COUNT(*) as total_rides,
         SUM(fare) as gross_earnings,
         SUM(fare * 0.8) as net_earnings,
         SUM(fare * 0.2) as commission,
         AVG(fare) as avg_fare,
         AVG(distance) as avg_distance,
         AVG(duration) as avg_duration,
         SUM(CASE WHEN rider_rating >= 4 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as satisfaction_rate
       FROM rides
       WHERE driver_id = ? 
         AND status = 'completed'
         AND created_at > ${timeFilter}`,
      [driverId]
    );

    const hourlyResult = await query(
      `SELECT 
         HOUR(created_at) as hour,
         COUNT(*) as rides,
         SUM(fare * 0.8) as earnings
       FROM rides
       WHERE driver_id = ? 
         AND status = 'completed'
         AND created_at > ${timeFilter}
       GROUP BY HOUR(created_at)
       ORDER BY hour`,
      [driverId]
    );

    const serviceTypeResult = await query(
      `SELECT 
         service_type,
         COUNT(*) as rides,
         SUM(fare * 0.8) as earnings,
         AVG(fare) as avg_fare
       FROM rides
       WHERE driver_id = ? 
         AND status = 'completed'
         AND created_at > ${timeFilter}
       GROUP BY service_type`,
      [driverId]
    );

    return {
      summary: result.rows[0],
      hourlyBreakdown: hourlyResult.rows,
      serviceTypeBreakdown: serviceTypeResult.rows
    };
  }

  static async getTopEarningZones(driverId: string, limit: number = 10): Promise<any[]> {
    const result = await query(
      `SELECT 
         ROUND(pickup_lat, 2) as lat,
         ROUND(pickup_lng, 2) as lng,
         COUNT(*) as rides,
         SUM(fare * 0.8) as earnings,
         AVG(fare) as avg_fare
       FROM rides
       WHERE driver_id = ? 
         AND status = 'completed'
         AND created_at > datetime('now', '-30 days')
       GROUP BY ROUND(pickup_lat, 2), ROUND(pickup_lng, 2)
       HAVING rides > 2
       ORDER BY earnings DESC
       LIMIT ?`,
      [driverId, limit]
    );

    return result.rows;
  }

  static async getPeakHours(driverId: string): Promise<any[]> {
    const result = await query(
      `SELECT 
         HOUR(created_at) as hour,
         COUNT(*) as rides,
         SUM(fare * 0.8) as earnings,
         AVG(fare) as avg_fare
       FROM rides
       WHERE driver_id = ? 
         AND status = 'completed'
         AND created_at > datetime('now', '-30 days')
       GROUP BY HOUR(created_at)
       ORDER BY earnings DESC
       LIMIT 5`,
      [driverId]
    );

    return result.rows;
  }

  static async getWeeklyComparison(driverId: string): Promise<any> {
    const thisWeek = await query(
      `SELECT 
         COUNT(*) as rides,
         SUM(fare * 0.8) as earnings
       FROM rides
       WHERE driver_id = ? 
         AND status = 'completed'
         AND created_at > datetime('now', '-7 days')`,
      [driverId]
    );

    const lastWeek = await query(
      `SELECT 
         COUNT(*) as rides,
         SUM(fare * 0.8) as earnings
       FROM rides
       WHERE driver_id = ? 
         AND status = 'completed'
         AND created_at BETWEEN datetime('now', '-14 days') AND datetime('now', '-7 days')`,
      [driverId]
    );

    const thisWeekData = thisWeek.rows[0];
    const lastWeekData = lastWeek.rows[0];

    return {
      thisWeek: thisWeekData,
      lastWeek: lastWeekData,
      ridesChange: lastWeekData.rides > 0 
        ? ((thisWeekData.rides - lastWeekData.rides) / lastWeekData.rides * 100).toFixed(1)
        : 0,
      earningsChange: lastWeekData.earnings > 0
        ? ((thisWeekData.earnings - lastWeekData.earnings) / lastWeekData.earnings * 100).toFixed(1)
        : 0
    };
  }

  static async getGoalProgress(driverId: string): Promise<any> {
    const result = await query(
      `SELECT daily_goal, weekly_goal, monthly_goal FROM driver_goals WHERE driver_id = ?`,
      [driverId]
    );

    if (result.rows.length === 0) {
      return { daily: 0, weekly: 0, monthly: 0 };
    }

    const goals = result.rows[0];

    const daily = await query(
      `SELECT SUM(fare * 0.8) as earnings FROM rides 
       WHERE driver_id = ? AND status = 'completed' AND created_at > datetime('now', 'start of day')`,
      [driverId]
    );

    const weekly = await query(
      `SELECT SUM(fare * 0.8) as earnings FROM rides 
       WHERE driver_id = ? AND status = 'completed' AND created_at > datetime('now', '-7 days')`,
      [driverId]
    );

    const monthly = await query(
      `SELECT SUM(fare * 0.8) as earnings FROM rides 
       WHERE driver_id = ? AND status = 'completed' AND created_at > datetime('now', 'start of month')`,
      [driverId]
    );

    return {
      daily: {
        goal: goals.daily_goal,
        current: daily.rows[0].earnings || 0,
        progress: goals.daily_goal > 0 ? ((daily.rows[0].earnings || 0) / goals.daily_goal * 100).toFixed(1) : 0
      },
      weekly: {
        goal: goals.weekly_goal,
        current: weekly.rows[0].earnings || 0,
        progress: goals.weekly_goal > 0 ? ((weekly.rows[0].earnings || 0) / goals.weekly_goal * 100).toFixed(1) : 0
      },
      monthly: {
        goal: goals.monthly_goal,
        current: monthly.rows[0].earnings || 0,
        progress: goals.monthly_goal > 0 ? ((monthly.rows[0].earnings || 0) / goals.monthly_goal * 100).toFixed(1) : 0
      }
    };
  }
}
