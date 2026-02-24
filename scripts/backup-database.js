#!/usr/bin/env node
/**
 * iTaxi Database Backup Script
 * Requires: mysqldump in PATH (or full path in MYSQLDUMP_PATH)
 * Usage: node scripts/backup-database.js [output-dir]
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;
const OUTPUT_DIR = process.argv[2] || path.join(process.cwd(), 'backups');
const MYSQLDUMP_PATH = process.env.MYSQLDUMP_PATH || 'mysqldump';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in .env');
  process.exit(1);
}

// Parse MySQL URL: mysql://user:pass@host:port/dbname
const match = DATABASE_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
if (!match) {
  console.error('❌ Invalid DATABASE_URL format. Expected: mysql://user:pass@host:port/dbname');
  process.exit(1);
}

const [, user, password, host, port, database] = match;
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const filename = `itaxi-backup-${timestamp}.sql`;
const filepath = path.join(OUTPUT_DIR, filename);

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

try {
  const cmd = `"${MYSQLDUMP_PATH}" -h "${host}" -P ${port} -u "${user}" -p"${password.replace(/"/g, '\\"')}" "${database}" --single-transaction --routines --triggers > "${filepath}"`;
  execSync(cmd, { stdio: 'inherit', shell: true });
  console.log(`✅ Backup saved: ${filepath}`);
} catch (err) {
  console.error('❌ Backup failed:', err.message);
  process.exit(1);
}
