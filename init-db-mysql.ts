import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { getMysqlConnectionStringFromEnv, parseMysqlUrl } from './db-url.js';

dotenv.config();

async function runSchemaBootstrap(connection: mysql.Connection, phase: 'ddl' | 'rest' | 'all' = 'all') {
    // 'ddl': only CREATE TABLE statements
    // 'rest': everything else (views/inserts/updates/etc)
    // 'all': original behavior
    // This avoids running seed statements before schema fixups.
    const schemaPath = path.join(process.cwd(), 'DATABASE-SYNC.sql');
    if (!fs.existsSync(schemaPath)) {
        console.warn('DATABASE-SYNC.sql not found, skipping schema bootstrap');
        return;
    }

    let sql = fs.readFileSync(schemaPath, 'utf8');

    // Skip trigger/delimiter section to keep execution simple and portable.
    const delimiterIndex = sql.indexOf('DELIMITER //');
    if (delimiterIndex >= 0) {
        sql = sql.substring(0, delimiterIndex);
    }

    // Drop comment lines.
    sql = sql
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n');

    const statements = sql
        .split(/;\s*\n/g)
        .map(s => s.trim())
        .filter(Boolean);

    const ddlStatements = statements.filter(s => /^CREATE\s+TABLE/i.test(s));
    const restStatements = statements.filter(s => !/^CREATE\s+TABLE/i.test(s));
    const selected = phase === 'ddl' ? ddlStatements : phase === 'rest' ? restStatements : statements;

    for (const stmt of selected) {
        try {
            await connection.query(stmt);
        } catch (e: any) {
            // Continue bootstrap even if one statement fails (idempotent migrations).
            console.warn('Schema statement warning:', e.message);
        }
    }
}

async function createEnterpriseTables(connection: mysql.Connection) {
    const statements = [
        `CREATE TABLE IF NOT EXISTS driver_credit_accounts (
            driver_id VARCHAR(255) PRIMARY KEY,
            balance DECIMAL(12,2) NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS driver_credit_ledger (
            id VARCHAR(255) PRIMARY KEY,
            driver_id VARCHAR(255) NOT NULL,
            ride_id VARCHAR(255) NULL,
            amount DECIMAL(12,2) NOT NULL,
            entry_type ENUM('admin_credit','ride_commission','ride_fee','adjustment','refund') NOT NULL,
            description TEXT NULL,
            created_by VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_driver_credit_ledger_driver_id (driver_id),
            INDEX idx_driver_credit_ledger_ride_id (ride_id),
            INDEX idx_driver_credit_ledger_created_at (created_at)
        )`,
        `CREATE TABLE IF NOT EXISTS system_revenue_ledger (
            id VARCHAR(255) PRIMARY KEY,
            ride_id VARCHAR(255) NULL,
            driver_id VARCHAR(255) NULL,
            amount DECIMAL(12,2) NOT NULL,
            revenue_type ENUM('commission','fee','other') NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_system_revenue_created_at (created_at),
            INDEX idx_system_revenue_ride_id (ride_id),
            INDEX idx_system_revenue_driver_id (driver_id)
        )`,
        `CREATE TABLE IF NOT EXISTS promo_code_usage (
            id VARCHAR(255) PRIMARY KEY,
            promo_code_id VARCHAR(255),
            user_id VARCHAR(255),
            ride_id VARCHAR(255),
            discount_amount DECIMAL(10,2),
            used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS emergency_contacts (
            id VARCHAR(255) PRIMARY KEY,
            user_id VARCHAR(255),
            name VARCHAR(255) NOT NULL,
            phone VARCHAR(20) NOT NULL,
            relationship VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS sos_alerts (
            id VARCHAR(255) PRIMARY KEY,
            ride_id VARCHAR(255),
            user_id VARCHAR(255),
            lat DECIMAL(10,8),
            lng DECIMAL(11,8),
            status ENUM('active', 'resolved', 'false_alarm') DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP NULL
        )`,
        `CREATE TABLE IF NOT EXISTS surge_zones (
            id VARCHAR(255) PRIMARY KEY,
            h3_index VARCHAR(32),
            lat DECIMAL(10,8),
            lng DECIMAL(11,8),
            multiplier DECIMAL(5,2),
            active_rides INT DEFAULT 0,
            available_drivers INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_surge_zone_h3 (h3_index)
        )`,
        `CREATE TABLE IF NOT EXISTS fraud_logs (
            id VARCHAR(255) PRIMARY KEY,
            user_id VARCHAR(255),
            ride_id VARCHAR(255),
            type VARCHAR(100),
            severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
            description TEXT,
            data JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS pool_rides (
            id VARCHAR(255) PRIMARY KEY,
            ride_ids JSON,
            status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS ride_stops (
            id VARCHAR(255) PRIMARY KEY,
            ride_id VARCHAR(255),
            address TEXT,
            lat DECIMAL(10,8),
            lng DECIMAL(11,8),
            stop_order INT,
            status ENUM('pending', 'completed', 'skipped') DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP NULL
        )`,
        `CREATE TABLE IF NOT EXISTS background_checks (
            id VARCHAR(255) PRIMARY KEY,
            driver_id VARCHAR(255),
            national_id TEXT,
            driving_license TEXT,
            criminal_record TEXT,
            status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reviewed_at TIMESTAMP NULL,
            reviewed_by VARCHAR(255),
            rejection_reason TEXT,
            INDEX idx_driver_id (driver_id),
            INDEX idx_status (status)
        )`,
        `CREATE TABLE IF NOT EXISTS kyc_audit_log (
            id VARCHAR(255) PRIMARY KEY,
            driver_id VARCHAR(255) NOT NULL,
            admin_id VARCHAR(255) NOT NULL,
            action VARCHAR(50) NOT NULL,
            old_status VARCHAR(50),
            new_status VARCHAR(50),
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_driver_id (driver_id),
            INDEX idx_created_at (created_at)
        )`,
        `CREATE TABLE IF NOT EXISTS driver_ban_log (
            id VARCHAR(255) PRIMARY KEY,
            driver_id VARCHAR(255) NOT NULL,
            admin_id VARCHAR(255) NOT NULL,
            reason TEXT,
            duration_days INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_driver_id (driver_id),
            INDEX idx_created_at (created_at)
        )`,
        `CREATE TABLE IF NOT EXISTS instant_payouts (
            id VARCHAR(255) PRIMARY KEY,
            driver_id VARCHAR(255),
            amount DECIMAL(12,2),
            fee DECIMAL(12,2),
            status ENUM('processing', 'completed', 'failed') DEFAULT 'processing',
            requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP NULL
        )`,
        `CREATE TABLE IF NOT EXISTS ab_experiments (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255),
            variants JSON,
            active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS ab_assignments (
            id VARCHAR(255) PRIMARY KEY,
            experiment_id VARCHAR(255),
            user_id VARCHAR(255),
            variant VARCHAR(255),
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS ab_events (
            id VARCHAR(255) PRIMARY KEY,
            experiment_id VARCHAR(255),
            user_id VARCHAR(255),
            variant VARCHAR(255),
            event_name VARCHAR(255),
            value DECIMAL(12,2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS package_deliveries (
            id VARCHAR(255) PRIMARY KEY,
            sender_id VARCHAR(255),
            receiver_name VARCHAR(255),
            receiver_phone VARCHAR(20),
            pickup_address TEXT,
            pickup_lat DECIMAL(10,8),
            pickup_lng DECIMAL(11,8),
            dropoff_address TEXT,
            dropoff_lat DECIMAL(10,8),
            dropoff_lng DECIMAL(11,8),
            package_type ENUM('document', 'small', 'medium', 'large'),
            description TEXT,
            declared_value DECIMAL(12,2),
            fare DECIMAL(12,2),
            distance DECIMAL(10,2),
            driver_id VARCHAR(255),
            status ENUM('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled') DEFAULT 'pending',
            proof_photo TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            assigned_at TIMESTAMP NULL,
            delivered_at TIMESTAMP NULL
        )`,
        `CREATE TABLE IF NOT EXISTS trip_recordings (
            id VARCHAR(255) PRIMARY KEY,
            ride_id VARCHAR(255),
            user_id VARCHAR(255),
            file_path TEXT,
            file_size BIGINT,
            status ENUM('recording', 'completed', 'stopped', 'deleted') DEFAULT 'recording',
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            stopped_at TIMESTAMP NULL,
            deleted_at TIMESTAMP NULL,
            deletion_reason TEXT
        )`
    ];

    for (const stmt of statements) {
        await connection.query(stmt);
    }
}

async function tableExists(connection: mysql.Connection, tableName: string): Promise<boolean> {
    const [rows] = await connection.query(
        `SELECT 1
         FROM information_schema.tables
         WHERE table_schema = DATABASE()
           AND table_name = ?
         LIMIT 1`,
        [tableName]
    );
    return Array.isArray(rows) && rows.length > 0;
}

async function columnExists(connection: mysql.Connection, tableName: string, columnName: string): Promise<boolean> {
    const [rows] = await connection.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = ?
           AND column_name = ?
         LIMIT 1`,
        [tableName, columnName]
    );
    return Array.isArray(rows) && rows.length > 0;
}

async function addColumnIfMissing(connection: mysql.Connection, tableName: string, columnName: string, definition: string) {
    if (await columnExists(connection, tableName, columnName)) return;
    await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
}

async function applySchemaFixups(connection: mysql.Connection) {
    // promo_codes is required by PromoCodeService. Some MySQL/MariaDB builds reject TIMESTAMP NOT NULL without defaults.
    if (!(await tableExists(connection, 'promo_codes'))) {
        await connection.query(`CREATE TABLE IF NOT EXISTS promo_codes (
            id VARCHAR(255) PRIMARY KEY,
            code VARCHAR(50) UNIQUE NOT NULL,
            type ENUM('percentage', 'fixed') NOT NULL,
            value DECIMAL(10,2) NOT NULL,
            max_uses INT DEFAULT 0,
            used_count INT DEFAULT 0,
            min_fare DECIMAL(10,2) DEFAULT 0,
            max_discount DECIMAL(10,2) DEFAULT 0,
            valid_from DATETIME NOT NULL,
            valid_until DATETIME NOT NULL,
            active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_promo_code (code)
        )`);
    }

    await addColumnIfMissing(connection, 'users', 'two_factor_secret', 'VARCHAR(255) NULL');
    await addColumnIfMissing(connection, 'users', 'two_factor_enabled', 'TINYINT(1) NOT NULL DEFAULT 0');
    await addColumnIfMissing(connection, 'users', 'referral_code', 'VARCHAR(50) NULL');
    // Optional email for OTP delivery and receipts.
    await addColumnIfMissing(connection, 'users', 'email', 'VARCHAR(255) NULL');
    await addColumnIfMissing(connection, 'users', 'status', "ENUM('active', 'suspended', 'banned') NOT NULL DEFAULT 'active'");
    await addColumnIfMissing(connection, 'users', 'public_key', 'TEXT NULL');
    await addColumnIfMissing(connection, 'users', 'key_generated_at', 'TIMESTAMP NULL');
    await addColumnIfMissing(connection, 'users', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

    // Email uniqueness (NULLs allowed) - best-effort idempotent.
    try {
        await connection.query("CREATE UNIQUE INDEX uniq_users_email ON users (email)");
    } catch { /* ignore - index may already exist */ }

    // Login OTP sessions (WhatsApp/Email OTP verification for login).
    try {
        await connection.query(`CREATE TABLE IF NOT EXISTS login_otp_sessions (
            id VARCHAR(255) PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            channel ENUM('whatsapp','email') NOT NULL,
            code_hash VARCHAR(255) NOT NULL,
            attempts INT NOT NULL DEFAULT 0,
            max_attempts INT NOT NULL DEFAULT 5,
            expires_at TIMESTAMP NOT NULL,
            consumed_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_login_otp_user_id (user_id),
            INDEX idx_login_otp_expires_at (expires_at),
            INDEX idx_login_otp_consumed_at (consumed_at)
        )`);
    } catch (e: any) {
        console.warn('OTP sessions table creation skipped:', e?.message || e);
    }

    await addColumnIfMissing(connection, 'drivers', 'taxi_type_id', "VARCHAR(50) NULL DEFAULT 'eco'");
    await addColumnIfMissing(connection, 'drivers', 'earnings', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
    await addColumnIfMissing(connection, 'drivers', 'service_types', 'LONGTEXT NULL');
    await addColumnIfMissing(connection, 'drivers', 'background_check_status', "ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending'");
    await addColumnIfMissing(connection, 'drivers', 'background_check_date', 'TIMESTAMP NULL');
    await addColumnIfMissing(connection, 'drivers', 'kyc_status', "ENUM('unverified','pending','approved','rejected') NOT NULL DEFAULT 'unverified'");
    await addColumnIfMissing(connection, 'drivers', 'kyc_updated_at', 'TIMESTAMP NULL');
    await addColumnIfMissing(connection, 'drivers', 'driver_level', "VARCHAR(50) NOT NULL DEFAULT 'basic'");
    await addColumnIfMissing(connection, 'drivers', 'stripe_account_id', 'VARCHAR(255) NULL');
    await addColumnIfMissing(connection, 'drivers', 'join_date', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');

    // Rider-selected taxi category (Req #10). Kept nullable for backward compatibility.
    await addColumnIfMissing(connection, 'rides', 'taxi_type_id', 'VARCHAR(50) NULL');

    // Backfill taxi type and service types for existing drivers.
    await connection.query(
        "UPDATE drivers SET taxi_type_id = COALESCE(NULLIF(taxi_type_id, ''), vehicle_type, 'eco') WHERE taxi_type_id IS NULL OR taxi_type_id = ''"
    );
    await connection.query(
        "UPDATE drivers SET service_types = COALESCE(service_types, '[\"city\",\"airport\"]') WHERE service_types IS NULL"
    );

    // Ensure credit account row exists for every driver.
    try {
        await connection.query(
            `INSERT IGNORE INTO driver_credit_accounts (driver_id, balance)
             SELECT u.id, 0
             FROM users u
             WHERE u.role = 'driver'`
        );
    } catch (e: any) {
        console.warn('Driver credit account backfill skipped:', e?.message || e);
    }
}

async function seedData(connection: mysql.Connection): Promise<boolean> {
    const authDefaults = {
        loginOtp: {
            enabled: false,
            roles: ['rider', 'driver'],
            channels: ['whatsapp', 'email'],
            defaultChannel: 'whatsapp',
            ttlSeconds: 300,
            maxAttempts: 5
        }
    };

    const defaultSettingsObj = {
        routingProvider: 'ors',
        mapProvider: 'osm',
        apiKeys: { ors: '', mapbox: '', google: '' },
        pricing: { minFare: 50, commissionRate: 20, cancellationFee: 20, intercityMultiplier: 1.5 },
        services: [
            { id: 'city', name: 'iTaxi City', baseFare: 40, perKm: 15, perMin: 2, minFare: 50, commission: 20, icon: 'Car' },
            { id: 'intercity', name: 'iTaxi Intercity', baseFare: 80, perKm: 30, perMin: 5, minFare: 100, commission: 20, icon: 'Car' },
            { id: 'airport', name: 'iTaxi Airport', baseFare: 100, perKm: 35, perMin: 6, minFare: 150, commission: 20, icon: 'Plane' }
        ],
        system: { defaultCenter: { lat: 34.5333, lng: 69.1667 }, driverUpdateInterval: 1000, enableManualFare: true, radiusLimit: 10, dispatchTimeout: 20 },
        hotelsModule: { enabled: true, commission: 5 },
        auth: authDefaults
    };

    const defaultSettings = JSON.stringify(defaultSettingsObj);

    await connection.execute(
        // Never overwrite existing settings on init; only create defaults if missing.
        `INSERT INTO admin_settings (id, settings) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE id = id`,
        [1, defaultSettings]
    );

    // Backfill new default keys for existing settings (no overwrite).
    try {
        const [settingsRows]: any = await connection.execute("SELECT settings FROM admin_settings WHERE id = 1 LIMIT 1");
        const raw = settingsRows?.[0]?.settings;
        if (raw) {
            const current = JSON.parse(raw);
            let changed = false;
            if (!current.auth) {
                current.auth = authDefaults;
                changed = true;
            } else if (!current.auth.loginOtp) {
                current.auth.loginOtp = authDefaults.loginOtp;
                changed = true;
            } else {
                const lo = current.auth.loginOtp || {};
                for (const [k, v] of Object.entries(authDefaults.loginOtp)) {
                    if (lo[k] === undefined || lo[k] === null) {
                        lo[k] = v;
                        changed = true;
                    }
                }
                current.auth.loginOtp = lo;
            }
            if (changed) {
                await connection.execute(
                    "UPDATE admin_settings SET settings = ? WHERE id = 1",
                    [JSON.stringify(current)]
                );
            }
        }
    } catch { /* ignore */ }

    // Demo accounts: seed only when DB is empty OR explicitly requested.
    const [countRows]: any = await connection.execute("SELECT COUNT(*) as count FROM users");
    const userCount = Number(countRows?.[0]?.count || 0);
    const shouldSeedDemo = process.env.SEED_DEMO_DATA === '1' || userCount === 0;
    if (!shouldSeedDemo) {
        return false;
    }

    const adminHash = await bcrypt.hash('admin123', 10);
    const driverHash = await bcrypt.hash('driver123', 10);
    const riderHash = await bcrypt.hash('rider123', 10);

    await connection.execute(
        `INSERT IGNORE INTO users (id, name, phone, password_hash, role, balance)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['admin-id', 'Admin User', '+10000000000', adminHash, 'admin', 1000000]
    );

    const driverId = 'driver-id';
    await connection.execute(
        `INSERT IGNORE INTO users (id, name, phone, password_hash, role, balance)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [driverId, 'Driver Demo', '+10000000001', driverHash, 'driver', 500]
    );

    await connection.execute(
        `INSERT IGNORE INTO drivers (
            id,
            vehicle_model,
            vehicle_plate,
            vehicle_type,
            taxi_type_id,
            status,
            current_lat,
            current_lng,
            base_fare,
            per_km_rate,
            is_active,
            kyc_status,
            driver_level,
            service_types,
            last_updated
        )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
            driverId,
            'Toyota Corolla',
            'KBL-1234',
            'plus',
            'plus',
            'available',
            34.5333,
            69.1667,
            50,
            20,
            true,
            'approved',
            'pro',
            JSON.stringify(['city', 'airport'])
        ]
    );

    // Ensure demo driver remains visible/dispatchable even if the demo user already existed (idempotent).
    try {
        await connection.execute(
            "UPDATE drivers SET kyc_status = 'approved', driver_level = COALESCE(driver_level, 'pro'), taxi_type_id = COALESCE(NULLIF(taxi_type_id, ''), vehicle_type, 'eco'), is_active = 1, status = COALESCE(status, 'available'), last_updated = NOW() WHERE id = ?",
            [driverId]
        );
    } catch { /* non-fatal */ }

    // Seed operational credit so the demo driver can accept rides (credit-based model).
    try {
        const initialCredit = 1000; // AFN operational credit for demo flows
        await connection.execute(
            `INSERT INTO driver_credit_accounts (driver_id, balance)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE balance = GREATEST(balance, VALUES(balance))`,
            [driverId, initialCredit]
        );
        await connection.execute(
            `INSERT IGNORE INTO driver_credit_ledger (id, driver_id, amount, entry_type, description, created_by)
             VALUES (?, ?, ?, 'admin_credit', ?, ?)`,
            [`demo-credit-${driverId}`, driverId, initialCredit, 'Initial demo credit', 'admin-id']
        );
    } catch (e: any) {
        console.warn('Demo driver credit seed skipped:', e?.message || e);
    }

    await connection.execute(
        `INSERT IGNORE INTO users (id, name, phone, password_hash, role, balance)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['rider-id', 'Rider Demo', '+10000000002', riderHash, 'rider', 200]
    );

    return true;
}

async function ensureDemoDriverOperational(connection: mysql.Connection) {
    // Keep the default demo driver usable for QA in existing DBs as well.
    // This is intentionally scoped to fixed demo identities to avoid affecting real drivers.
    const demoCandidates: Array<{
        phone: string;
        fallbackId: string;
        defaultLat: number;
        defaultLng: number;
        taxiTypeId: string;
        driverLevel: string;
        serviceTypes: string[];
    }> = [
        { phone: '+10000000001', fallbackId: 'driver-id', defaultLat: 34.5333, defaultLng: 69.1667, taxiTypeId: 'eco', driverLevel: 'premium', serviceTypes: ['city', 'airport'] },
    ];

    for (const demo of demoCandidates) {
        try {
            let driverId: string | null = null;

            // Prefer lookup by phone (covers older demo seeds u0/u1/u2).
            try {
                const [rows]: any = await connection.execute(
                    "SELECT id, role FROM users WHERE phone = ? LIMIT 1",
                    [demo.phone]
                );
                if (rows?.[0]?.role === 'driver') {
                    driverId = rows[0].id;
                }
            } catch { /* ignore */ }

            // Fallback to fixed id (covers fresh DB seeds from this script).
            if (!driverId) {
                const [rows]: any = await connection.execute(
                    "SELECT id, role FROM users WHERE id = ? LIMIT 1",
                    [demo.fallbackId]
                );
                if (rows?.[0]?.role === 'driver') {
                    driverId = rows[0].id;
                }
            }

            if (!driverId) continue;

            // Ensure a drivers row exists.
            try {
                await connection.execute(
                    `INSERT IGNORE INTO drivers (id, status, current_lat, current_lng, is_active, kyc_status, driver_level, taxi_type_id, service_types, last_updated)
                     VALUES (?, 'available', ?, ?, 1, 'approved', ?, ?, ?, NOW())`,
                    [driverId, demo.defaultLat, demo.defaultLng, demo.driverLevel, demo.taxiTypeId, JSON.stringify(demo.serviceTypes)]
                );
            } catch { /* ignore */ }

            // Refresh visibility for rider discovery: last_updated + location + active status.
            // Do not override an actively busy driver unless it looks stale.
            try {
                await connection.execute(
                    `UPDATE drivers
                     SET
                       kyc_status = 'approved',
                       driver_level = COALESCE(NULLIF(driver_level, ''), ?),
                       taxi_type_id = COALESCE(NULLIF(taxi_type_id, ''), vehicle_type, ?),
                       service_types = COALESCE(service_types, ?),
                       is_active = 1,
                       current_lat = COALESCE(current_lat, ?),
                       current_lng = COALESCE(current_lng, ?),
                       status = CASE
                         WHEN status = 'suspended' THEN 'suspended'
                         WHEN status = 'busy' AND last_updated > DATE_SUB(NOW(), INTERVAL 30 MINUTE) THEN 'busy'
                         ELSE 'available'
                       END,
                       last_updated = NOW()
                     WHERE id = ?`,
                    [
                        demo.driverLevel,
                        demo.taxiTypeId,
                        JSON.stringify(demo.serviceTypes),
                        demo.defaultLat,
                        demo.defaultLng,
                        driverId
                    ]
                );
            } catch { /* ignore */ }

            // Seed operational credit so the demo driver can accept rides (credit-based model).
            try {
                const initialCredit = 1000;
                await connection.execute(
                    `INSERT INTO driver_credit_accounts (driver_id, balance)
                     VALUES (?, ?)
                     ON DUPLICATE KEY UPDATE balance = GREATEST(balance, VALUES(balance))`,
                    [driverId, initialCredit]
                );
                await connection.execute(
                    `INSERT IGNORE INTO driver_credit_ledger (id, driver_id, amount, entry_type, description, created_by)
                     VALUES (?, ?, ?, 'admin_credit', ?, ?)`,
                    [`demo-credit-${driverId}`, driverId, initialCredit, 'Initial demo credit', 'admin-id']
                );
            } catch { /* ignore */ }
        } catch {
            // Ignore; init should remain idempotent.
        }
    }
}

async function normalizeStaticAssetPaths(connection: mysql.Connection) {
    // In production the SPA is served from `/` and routes like `/rider` exist,
    // so relative paths like `./img/...` break. Normalize to absolute `/img/...`.
    try {
        await connection.execute(
            "UPDATE taxi_types SET image_path = CONCAT('/', SUBSTRING(image_path, 3)) WHERE image_path LIKE './%';"
        );
    } catch (e) {
        // Non-fatal; keep going.
        console.warn('Static asset path normalization skipped:', (e as any)?.message || e);
    }
}

async function initDatabase() {
    const mysqlUrl = getMysqlConnectionStringFromEnv();
    const parsedMysqlUrl = mysqlUrl ? parseMysqlUrl(mysqlUrl) : null;

    const host =
        (process.env.MYSQL_HOST ?? process.env.MYSQLHOST ?? parsedMysqlUrl?.host ?? 'localhost').toString().trim() ||
        'localhost';
    const port =
        Number.parseInt((process.env.MYSQL_PORT ?? process.env.MYSQLPORT ?? parsedMysqlUrl?.port ?? '3306').toString(), 10) ||
        3306;
    const user = (process.env.MYSQL_USER ?? process.env.MYSQLUSER ?? parsedMysqlUrl?.user ?? 'root').toString() || 'root';
    const password = (process.env.MYSQL_PASSWORD ?? process.env.MYSQLPASSWORD ?? parsedMysqlUrl?.password ?? '').toString();
    const database =
        (process.env.MYSQL_DATABASE ?? process.env.MYSQLDATABASE ?? parsedMysqlUrl?.database ?? 'itaxi').toString().trim() ||
        'itaxi';

    const baseConfig: mysql.ConnectionOptions = { host, port, user, password, multipleStatements: true };
    let connection = await mysql.createConnection(baseConfig);

    // Managed MySQL providers (Railway, etc.) may not grant CREATE DATABASE privileges.
    // We attempt it for local/dev, but gracefully continue if denied.
    try {
        await connection.query(
            `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
    } catch (e: any) {
        console.warn('CREATE DATABASE skipped:', e?.message || e);
    }

    let hasDb = false;
    try {
        await connection.query(`USE \`${database}\``);
        hasDb = true;
    } catch (e: any) {
        console.warn('USE database failed (will retry with direct db connection):', e?.message || e);
    }

    if (!hasDb) {
        try {
            const [rows]: any = await connection.query("SELECT DATABASE() as db");
            if (rows?.[0]?.db && String(rows[0].db) === database) {
                hasDb = true;
            }
        } catch {
            // ignore
        }
    }

    if (!hasDb) {
        await connection.end();
        connection = await mysql.createConnection({ ...baseConfig, database });
    }

    console.log('Connected to MySQL');

    await runSchemaBootstrap(connection, 'ddl');
    await createEnterpriseTables(connection);
    await applySchemaFixups(connection);
    await runSchemaBootstrap(connection, 'rest');
    await normalizeStaticAssetPaths(connection);
    const seededDemo = await seedData(connection);
    await ensureDemoDriverOperational(connection);

    console.log('MySQL database initialized successfully');
    console.log('Database:', database);
    if (seededDemo) {
        console.log('Demo Accounts:');
        console.log('  Admin:  +10000000000 / admin123');
        console.log('  Driver: +10000000001 / driver123');
        console.log('  Rider:  +10000000002 / rider123');
    } else {
        console.log('Demo seed skipped (existing users detected).');
    }

    await connection.end();
}

initDatabase().catch((error) => {
    console.error('MySQL init failed:', error);
    process.exit(1);
});
