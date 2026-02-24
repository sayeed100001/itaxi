#!/usr/bin/env node
/**
 * iTaxi Database Restore Script
 * Usage: node scripts/restore-database.js <backup-file.sql>
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;
const MYSQL_PATH = process.env.MYSQL_PATH || 'mysql';
const backupFile = process.argv[2];

if (!backupFile || !fs.existsSync(backupFile)) {
  console.error('❌ Usage: node scripts/restore-database.js <backup-file.sql>');
  console.error('   Backup file not found:', backupFile);
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in .env');
  process.exit(1);
}

const match = DATABASE_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
if (!match) {
  console.error('❌ Invalid DATABASE_URL format');
  process.exit(1);
}

const [, user, password, host, port, database] = match;

try {
  const cmd = `"${MYSQL_PATH}" -h "${host}" -P ${port} -u "${user}" -p"${password.replace(/"/g, '\\"')}" "${database}" < "${path.resolve(backupFile)}"`;
  execSync(cmd, { stdio: 'inherit', shell: true });
  console.log(`✅ Restore completed from ${backupFile}`);
} catch (err) {
  console.error('❌ Restore failed:', err.message);
  process.exit(1);
}
