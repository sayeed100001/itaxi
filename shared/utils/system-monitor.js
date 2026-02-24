const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class SystemMonitor {
  constructor(options = {}) {
    this.checkInterval = options.checkInterval || 30000; // 30 seconds
    this.thresholds = {
      cpu: options.cpuThreshold || 80,      // 80% CPU usage
      memory: options.memoryThreshold || 85, // 85% memory usage
      disk: options.diskThreshold || 90,    // 90% disk usage
      load: options.loadThreshold || 2.0    // Load average threshold
    };
    this.monitoring = false;
    this.callbacks = {
      cpuWarning: options.onCPUWarning || (() => {}),
      memoryWarning: options.onMemoryWarning || (() => {}),
      diskWarning: options.onDiskWarning || (() => {}),
      systemMetrics: options.onSystemMetrics || (() => {})
    };
  }

  // Get system metrics
  async getSystemMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      cpu: this.getCPUUsage(),
      memory: this.getMemoryUsage(),
      disk: await this.getDiskUsage(),
      load: os.loadavg(),
      uptime: os.uptime(),
      totalMem: os.totalmem(),
      freeMem: os.freemem(),
      networkInterfaces: os.networkInterfaces(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release()
    };

    return metrics;
  }

  // Get CPU usage
  getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }

    const avgTick = totalTick / cpus.length;
    const avgIdle = totalIdle / cpus.length;

    // Calculate usage percentage
    const usage = 100 - (avgIdle / avgTick) * 100;
    return {
      usage: Math.round(usage * 100) / 100,
      count: cpus.length,
      model: cpus[0].model
    };
  }

  // Get memory usage
  getMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usage = (usedMem / totalMem) * 100;

    return {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      usage: Math.round(usage * 100) / 100
    };
  }

  // Get disk usage
  async getDiskUsage() {
    try {
      if (os.platform() === 'win32') {
        // Windows implementation
        const drive = process.cwd().split(':')[0]; // Get current drive
        const { stdout } = await execAsync(`wmic logicaldisk where "caption='${drive}:'" get size,freespace /format:csv`);
        
        const lines = stdout.trim().split('\n');
        if (lines.length > 1) {
          const values = lines[1].trim().split(',');
          if (values.length >= 3) {
            const total = parseInt(values[2]) || 0;
            const free = parseInt(values[1]) || 0;
            const used = total - free;
            const usage = total > 0 ? (used / total) * 100 : 0;
            
            return {
              total,
              used,
              free,
              usage: Math.round(usage * 100) / 100
            };
          }
        }
      } else {
        // Unix-like systems implementation
        const { stdout } = await execAsync('df -k .');
        const lines = stdout.trim().split('\n');
        if (lines.length > 1) {
          const parts = lines[1].replace(/\s+/g, ' ').split(' ');
          if (parts.length >= 5) {
            const usagePercent = parseInt(parts[4].replace('%', '')) || 0;
            // We only have percentage from df, approximate sizes
            return {
              total: 0, // Would need additional command to get actual bytes
              used: 0,
              free: 0,
              usage: usagePercent
            };
          }
        }
      }
    } catch (error) {
      console.error('Error getting disk usage:', error);
    }

    // Fallback to OS total if we can't get disk usage
    return {
      total: os.totalmem(),
      used: os.totalmem() - os.freemem(),
      free: os.freemem(),
      usage: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
    };
  }

  // Check for threshold violations
  checkThresholds(metrics) {
    const alerts = [];

    if (metrics.cpu.usage > this.thresholds.cpu) {
      alerts.push({
        type: 'cpu',
        level: 'warning',
        message: `CPU usage is high: ${metrics.cpu.usage}%`,
        value: metrics.cpu.usage,
        threshold: this.thresholds.cpu
      });
      this.callbacks.cpuWarning(metrics);
    }

    if (metrics.memory.usage > this.thresholds.memory) {
      alerts.push({
        type: 'memory',
        level: 'warning',
        message: `Memory usage is high: ${metrics.memory.usage}%`,
        value: metrics.memory.usage,
        threshold: this.thresholds.memory
      });
      this.callbacks.memoryWarning(metrics);
    }

    if (metrics.disk.usage > this.thresholds.disk) {
      alerts.push({
        type: 'disk',
        level: 'warning',
        message: `Disk usage is high: ${metrics.disk.usage}%`,
        value: metrics.disk.usage,
        threshold: this.thresholds.disk
      });
      this.callbacks.diskWarning(metrics);
    }

    // Check load average (1-minute average)
    if (metrics.load[0] > this.thresholds.load) {
      alerts.push({
        type: 'load',
        level: 'warning',
        message: `Load average is high: ${metrics.load[0]}`,
        value: metrics.load[0],
        threshold: this.thresholds.load
      });
    }

    return alerts;
  }

  // Start monitoring
  startMonitoring() {
    if (this.monitoring) {
      console.log('System monitoring already running');
      return;
    }

    this.monitoring = true;
    console.log('Starting system monitoring...');

    const monitorLoop = async () => {
      if (!this.monitoring) return;

      try {
        const metrics = await this.getSystemMetrics();
        const alerts = this.checkThresholds(metrics);

        // Call metrics callback
        this.callbacks.systemMetrics(metrics, alerts);

        // Log alerts if any
        if (alerts.length > 0) {
          console.warn('System monitoring alerts:', alerts);
        }
      } catch (error) {
        console.error('Error in system monitoring:', error);
      }

      // Schedule next check
      setTimeout(monitorLoop, this.checkInterval);
    };

    // Start the monitoring loop
    monitorLoop();
  }

  // Stop monitoring
  stopMonitoring() {
    this.monitoring = false;
    console.log('System monitoring stopped');
  }

  // Get current process metrics
  getProcessMetrics() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers
      },
      cpu: cpuUsage,
      pid: process.pid,
      uptime: process.uptime(),
      argv: process.argv,
      execPath: process.execPath,
      version: process.version,
      versions: process.versions
    };
  }

  // Health check endpoint format
  async getHealthStatus() {
    const metrics = await this.getSystemMetrics();
    const alerts = this.checkThresholds(metrics);

    const status = alerts.length === 0 ? 'healthy' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      metrics,
      alerts,
      details: {
        healthy: alerts.length === 0,
        warningCount: alerts.length,
        criticalAlerts: alerts.filter(alert => alert.level === 'critical').length
      }
    };
  }
}

// Export a singleton instance for easy use
const systemMonitor = new SystemMonitor();

module.exports = {
  SystemMonitor,
  systemMonitor
};