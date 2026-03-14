// Quick Start Script for SQLite
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 iTaxi Quick Start with SQLite\n');

// Step 1: Check if database exists
const dbPath = join(__dirname, 'itaxi.db');
if (!fs.existsSync(dbPath)) {
    console.log('📦 Installing dependencies...');
    try {
        execSync('npm install', { stdio: 'inherit', cwd: __dirname });
    } catch (e) {
        console.error('❌ Failed to install dependencies');
        process.exit(1);
    }
    
    console.log('\n🗄️  Initializing SQLite database...');
    try {
        execSync('node --loader tsx init-db.ts', { stdio: 'inherit', cwd: __dirname });
    } catch (e) {
        console.error('❌ Failed to initialize database');
        process.exit(1);
    }
}

console.log('\n✅ Database ready!');
console.log('\n🌐 Starting server...\n');

try {
    execSync('npm run dev', { stdio: 'inherit', cwd: __dirname });
} catch (e) {
    console.error('\n❌ Server failed to start');
    process.exit(1);
}
