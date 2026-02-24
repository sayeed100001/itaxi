const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Database backup configuration
const BACKUP_CONFIG = {
  retentionDays: 7, // Keep backups for 7 days
  backupDir: './backups',
  backupPrefix: 'itaxi_backup_',
  compression: true // Compress backups
};

class DatabaseBackup {
  constructor(config = {}) {
    this.config = { ...BACKUP_CONFIG, ...config };
    this.ensureBackupDir();
  }

  // Ensure backup directory exists
  ensureBackupDir() {
    if (!fs.existsSync(this.config.backupDir)) {
      fs.mkdirSync(this.config.backupDir, { recursive: true });
    }
  }

  // Create database backup
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${this.config.backupPrefix}${timestamp}.sql`;
    const backupPath = path.join(this.config.backupDir, backupFileName);

    try {
      console.log(`Starting database backup to: ${backupPath}`);

      // Use mysqldump to create backup (adjust for your database)
      const dbUrl = process.env.DATABASE_URL;
      
      // Parse database URL to extract connection details
      const url = new URL(dbUrl);
      const host = url.hostname;
      const port = url.port || '3306';
      const user = url.username;
      const password = url.password;
      const database = url.pathname.slice(1); // Remove leading '/'

      const dumpCommand = `mysqldump -h${host} -P${port} -u${user} -p${password} ${database} > ${backupPath}`;

      await execAsync(dumpCommand);
      
      console.log(`Database backup completed: ${backupPath}`);
      
      // Compress if enabled
      if (this.config.compression) {
        await this.compressBackup(backupPath);
      }

      // Cleanup old backups
      await this.cleanupOldBackups();

      return {
        success: true,
        path: this.config.compression ? `${backupPath}.gz` : backupPath,
        timestamp
      };
    } catch (error) {
      console.error('Database backup failed:', error);
      throw error;
    }
  }

  // Compress backup file
  async compressBackup(backupPath) {
    try {
      const gzipCommand = `gzip ${backupPath}`;
      await execAsync(gzipCommand);
      console.log(`Backup compressed: ${backupPath}.gz`);
    } catch (error) {
      console.error('Backup compression failed:', error);
      // Continue even if compression fails
    }
  }

  // Get list of existing backups
  getExistingBackups() {
    try {
      const files = fs.readdirSync(this.config.backupDir);
      return files
        .filter(file => file.startsWith(this.config.backupPrefix))
        .map(file => ({
          name: file,
          path: path.join(this.config.backupDir, file),
          createdAt: fs.statSync(path.join(this.config.backupDir, file)).mtime
        }))
        .sort((a, b) => b.createdAt - a.createdAt); // Sort by newest first
    } catch (error) {
      console.error('Error reading backup directory:', error);
      return [];
    }
  }

  // Cleanup old backups
  async cleanupOldBackups() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      const oldBackups = this.getExistingBackups()
        .filter(backup => backup.createdAt < cutoffDate);

      for (const backup of oldBackups) {
        try {
          fs.unlinkSync(backup.path);
          console.log(`Removed old backup: ${backup.name}`);
        } catch (error) {
          console.error(`Failed to remove old backup ${backup.name}:`, error);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old backups:', error);
    }
  }

  // Restore database from backup
  async restoreFromBackup(backupPath) {
    try {
      console.log(`Starting database restore from: ${backupPath}`);

      // Decompress if needed
      let restorePath = backupPath;
      if (backupPath.endsWith('.gz')) {
        restorePath = backupPath.slice(0, -3); // Remove .gz extension
        const gunzipCommand = `gunzip -k ${backupPath}`; // Keep original
        await execAsync(gunzipCommand);
      }

      const dbUrl = process.env.DATABASE_URL;
      const url = new URL(dbUrl);
      const host = url.hostname;
      const port = url.port || '3306';
      const user = url.username;
      const password = url.password;
      const database = url.pathname.slice(1);

      const restoreCommand = `mysql -h${host} -P${port} -u${user} -p${password} ${database} < ${restorePath}`;
      await execAsync(restoreCommand);

      console.log('Database restore completed successfully');

      // Clean up decompressed file if we created one
      if (backupPath.endsWith('.gz')) {
        try {
          fs.unlinkSync(restorePath);
        } catch (error) {
          console.warn('Could not clean up temporary decompressed file:', error);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Database restore failed:', error);
      throw error;
    }
  }

  // Schedule automatic backups
  scheduleAutomaticBackups(cronExpression = '0 2 * * *') { // Daily at 2 AM
    const cron = require('node-cron');
    
    cron.schedule(cronExpression, async () => {
      try {
        console.log('Running scheduled database backup...');
        await this.createBackup();
      } catch (error) {
        console.error('Scheduled backup failed:', error);
      }
    });

    console.log(`Scheduled automatic backups with cron: ${cronExpression}`);
  }
}

// File backup utility for other important files
class FileBackup {
  constructor(sourceDirs, config = {}) {
    this.sourceDirs = Array.isArray(sourceDirs) ? sourceDirs : [sourceDirs];
    this.config = { ...BACKUP_CONFIG, ...config };
    this.ensureBackupDir();
  }

  async createFileBackup(tag = '') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${this.config.backupPrefix}${tag ? `${tag}_` : ''}${timestamp}.tar.gz`;
    const backupPath = path.join(this.config.backupDir, backupFileName);

    try {
      console.log(`Starting file backup to: ${backupPath}`);

      // Create tar archive of source directories
      const sourcePaths = this.sourceDirs.map(dir => `"${dir}"`).join(' ');
      const tarCommand = `tar -czf ${backupPath} ${sourcePaths}`;

      await execAsync(tarCommand);

      console.log(`File backup completed: ${backupPath}`);

      // Cleanup old backups
      await this.cleanupOldBackups();

      return {
        success: true,
        path: backupPath,
        timestamp
      };
    } catch (error) {
      console.error('File backup failed:', error);
      throw error;
    }
  }

  // Get list of existing file backups
  getExistingBackups() {
    try {
      const files = fs.readdirSync(this.config.backupDir);
      return files
        .filter(file => file.startsWith(this.config.backupPrefix) && file.includes('_'))
        .map(file => ({
          name: file,
          path: path.join(this.config.backupDir, file),
          createdAt: fs.statSync(path.join(this.config.backupDir, file)).mtime
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('Error reading backup directory:', error);
      return [];
    }
  }

  // Cleanup old file backups
  async cleanupOldBackups() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      const oldBackups = this.getExistingBackups()
        .filter(backup => backup.createdAt < cutoffDate);

      for (const backup of oldBackups) {
        try {
          fs.unlinkSync(backup.path);
          console.log(`Removed old file backup: ${backup.name}`);
        } catch (error) {
          console.error(`Failed to remove old file backup ${backup.name}:`, error);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old file backups:', error);
    }
  }
}

module.exports = {
  DatabaseBackup,
  FileBackup
};