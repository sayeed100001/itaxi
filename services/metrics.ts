import { Request, Response, NextFunction } from 'express';

class MetricsService {
  private metrics: Map<string, any> = new Map();
  private histograms: Map<string, number[]> = new Map();

  constructor() {
    this.initializeMetrics();
  }

  private initializeMetrics() {
    this.metrics.set('http_requests_total', { count: 0, by_status: {} });
    this.metrics.set('http_request_duration_seconds', { sum: 0, count: 0 });
    this.metrics.set('active_rides_total', 0);
    this.metrics.set('available_drivers_total', 0);
    this.metrics.set('websocket_connections_total', 0);
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        this.recordRequest(req.method, req.path, res.statusCode, duration);
      });

      next();
    };
  }

  private recordRequest(method: string, path: string, status: number, duration: number) {
    const requests = this.metrics.get('http_requests_total');
    requests.count++;
    requests.by_status[status] = (requests.by_status[status] || 0) + 1;

    const durations = this.metrics.get('http_request_duration_seconds');
    durations.sum += duration;
    durations.count++;

    const key = `${method}_${path}`;
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    this.histograms.get(key)!.push(duration);
  }

  setGauge(name: string, value: number) {
    this.metrics.set(name, value);
  }

  incrementCounter(name: string, value: number = 1) {
    const current = this.metrics.get(name) || 0;
    this.metrics.set(name, current + value);
  }

  getMetrics(): string {
    let output = '';

    output += '# HELP http_requests_total Total HTTP requests\n';
    output += '# TYPE http_requests_total counter\n';
    const requests = this.metrics.get('http_requests_total');
    output += `http_requests_total ${requests.count}\n`;
    
    for (const [status, count] of Object.entries(requests.by_status)) {
      output += `http_requests_total{status="${status}"} ${count}\n`;
    }

    output += '\n# HELP http_request_duration_seconds HTTP request duration\n';
    output += '# TYPE http_request_duration_seconds summary\n';
    const durations = this.metrics.get('http_request_duration_seconds');
    if (durations.count > 0) {
      output += `http_request_duration_seconds_sum ${durations.sum.toFixed(3)}\n`;
      output += `http_request_duration_seconds_count ${durations.count}\n`;
    }

    output += '\n# HELP active_rides_total Number of active rides\n';
    output += '# TYPE active_rides_total gauge\n';
    output += `active_rides_total ${this.metrics.get('active_rides_total')}\n`;

    output += '\n# HELP available_drivers_total Number of available drivers\n';
    output += '# TYPE available_drivers_total gauge\n';
    output += `available_drivers_total ${this.metrics.get('available_drivers_total')}\n`;

    output += '\n# HELP websocket_connections_total Number of WebSocket connections\n';
    output += '# TYPE websocket_connections_total gauge\n';
    output += `websocket_connections_total ${this.metrics.get('websocket_connections_total')}\n`;

    output += '\n# HELP nodejs_memory_usage_bytes Node.js memory usage\n';
    output += '# TYPE nodejs_memory_usage_bytes gauge\n';
    const mem = process.memoryUsage();
    output += `nodejs_memory_usage_bytes{type="rss"} ${mem.rss}\n`;
    output += `nodejs_memory_usage_bytes{type="heapTotal"} ${mem.heapTotal}\n`;
    output += `nodejs_memory_usage_bytes{type="heapUsed"} ${mem.heapUsed}\n`;

    return output;
  }
}

export const metricsService = new MetricsService();
