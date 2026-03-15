import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { db, query } from './db-config.js';

dotenv.config();

const log = (...args: any[]) => console.log('[init-db-postgres]', ...args);

async function exec(sql: string, params: any[] = []) {
    await query(sql, params);
}

async function createSchema() {
    // Core tables
    const statements: string[] = [
        `CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT NOT NULL UNIQUE,
            email TEXT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('rider','driver','admin')),
            avatar TEXT NULL,
            rating NUMERIC(3,2) NOT NULL DEFAULT 5.0,
            balance NUMERIC(12,2) NOT NULL DEFAULT 0.0,
            total_trips INTEGER NOT NULL DEFAULT 0,
            loyalty_points INTEGER NOT NULL DEFAULT 0,
            discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0.0,
            two_factor_secret TEXT NULL,
            two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            referral_code TEXT NULL,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','banned')),
            public_key TEXT NULL,
            key_generated_at TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        // Unique email where present (Postgres treats NULLs as distinct; this matches intended behavior).
        `CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_email ON users (email)`,

        `CREATE TABLE IF NOT EXISTS taxi_types (
            id TEXT PRIMARY KEY,
            name_fa TEXT NOT NULL,
            name_en TEXT NOT NULL,
            description_fa TEXT NULL,
            description_en TEXT NULL,
            base_fare NUMERIC(10,2) NOT NULL DEFAULT 30000,
            per_km_rate NUMERIC(10,2) NOT NULL DEFAULT 5000,
            color TEXT NOT NULL DEFAULT '#10B981',
            image_path TEXT NULL,
            features TEXT NULL,
            min_rating NUMERIC(3,2) NULL,
            min_rides INTEGER NULL,
            icon_size TEXT NOT NULL DEFAULT '{\"width\": 40, \"height\": 40}',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_taxi_types_active ON taxi_types (is_active)`,

        `CREATE TABLE IF NOT EXISTS drivers (
            id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            vehicle_make TEXT NULL,
            vehicle_model TEXT NULL,
            vehicle_plate TEXT NULL,
            vehicle_type TEXT NOT NULL DEFAULT 'eco' CHECK (vehicle_type IN ('eco','plus','lux')),
            taxi_type_id TEXT NULL DEFAULT 'eco' REFERENCES taxi_types(id) ON UPDATE CASCADE ON DELETE SET NULL,
            status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('available','busy','offline','suspended')),
            current_lat NUMERIC(10,8) NULL,
            current_lng NUMERIC(11,8) NULL,
            h3_index TEXT NULL,
            bearing NUMERIC(5,2) NOT NULL DEFAULT 0,
            base_fare NUMERIC(10,2) NOT NULL DEFAULT 50.0,
            per_km_rate NUMERIC(10,2) NOT NULL DEFAULT 20.0,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            earnings NUMERIC(12,2) NOT NULL DEFAULT 0.0,
            service_types TEXT NULL DEFAULT '[\"city\",\"airport\"]',
            background_check_status TEXT NOT NULL DEFAULT 'pending' CHECK (background_check_status IN ('pending','approved','rejected')),
            background_check_date TIMESTAMPTZ NULL,
            kyc_status TEXT NOT NULL DEFAULT 'unverified' CHECK (kyc_status IN ('unverified','pending','approved','rejected')),
            kyc_updated_at TIMESTAMPTZ NULL,
            driver_level TEXT NOT NULL DEFAULT 'basic',
            stripe_account_id TEXT NULL,
            join_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers (status)`,
        `CREATE INDEX IF NOT EXISTS idx_drivers_location ON drivers (current_lat, current_lng)`,
        `CREATE INDEX IF NOT EXISTS idx_drivers_h3 ON drivers (h3_index)`,
        `CREATE INDEX IF NOT EXISTS idx_drivers_taxi_type ON drivers (taxi_type_id)`,
        `CREATE INDEX IF NOT EXISTS idx_drivers_earnings ON drivers (earnings)`,
        `CREATE INDEX IF NOT EXISTS idx_drivers_kyc_status ON drivers (kyc_status)`,

        `CREATE TABLE IF NOT EXISTS rides (
            id TEXT PRIMARY KEY,
            rider_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
            driver_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
            pickup_address TEXT NOT NULL,
            pickup_lat NUMERIC(10,8) NOT NULL,
            pickup_lng NUMERIC(11,8) NOT NULL,
            dropoff_address TEXT NOT NULL,
            dropoff_lat NUMERIC(10,8) NOT NULL,
            dropoff_lng NUMERIC(11,8) NOT NULL,
            fare NUMERIC(10,2) NOT NULL,
            proposed_fare NUMERIC(10,2) NULL,
            base_fare NUMERIC(10,2) NULL,
            surge_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.0,
            promo_discount NUMERIC(10,2) NOT NULL DEFAULT 0,
            final_fare NUMERIC(10,2) NULL,
            status TEXT NOT NULL DEFAULT 'searching' CHECK (status IN ('searching','negotiating','requested','accepted','arrived','in_progress','completed','cancelled')),
            service_type TEXT NOT NULL,
            taxi_type_id TEXT NULL,
            distance NUMERIC(10,2) NULL,
            duration INTEGER NULL,
            scheduled_time TIMESTAMPTZ NULL,
            notes TEXT NULL,
            rider_rating INTEGER NULL CHECK (rider_rating >= 1 AND rider_rating <= 5),
            driver_rating INTEGER NULL CHECK (driver_rating >= 1 AND driver_rating <= 5),
            pool_id TEXT NULL,
            recording_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            recording_url TEXT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_rides_rider_id ON rides (rider_id)`,
        `CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides (driver_id)`,
        `CREATE INDEX IF NOT EXISTS idx_rides_status ON rides (status)`,
        `CREATE INDEX IF NOT EXISTS idx_rides_created_at ON rides (created_at)`,

        `CREATE TABLE IF NOT EXISTS system_settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            map_provider TEXT NOT NULL DEFAULT 'osm',
            default_zoom INTEGER NOT NULL DEFAULT 15,
            default_center_lat NUMERIC(10,8) NOT NULL DEFAULT 34.5553,
            default_center_lng NUMERIC(11,8) NOT NULL DEFAULT 69.2075,
            primary_color TEXT NOT NULL DEFAULT '#3B82F6',
            secondary_color TEXT NOT NULL DEFAULT '#10B981',
            features TEXT NOT NULL DEFAULT '{\"realTimeTracking\": true, \"chatSystem\": true, \"paymentGateway\": false, \"notifications\": true, \"analytics\": true}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,

        `CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
            amount NUMERIC(12,2) NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('credit','debit')),
            status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','pending','failed')),
            description TEXT NULL,
            reference_id TEXT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at)`,

        `CREATE TABLE IF NOT EXISTS credit_requests (
            id TEXT PRIMARY KEY,
            driver_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
            amount NUMERIC(12,2) NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            processed_at TIMESTAMPTZ NULL
        )`,
        `CREATE INDEX IF NOT EXISTS idx_credit_requests_driver_id ON credit_requests (driver_id)`,
        `CREATE INDEX IF NOT EXISTS idx_credit_requests_status ON credit_requests (status)`,

        `CREATE TABLE IF NOT EXISTS withdrawal_requests (
            id TEXT PRIMARY KEY,
            driver_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
            amount NUMERIC(12,2) NOT NULL,
            method TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
            account_details TEXT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            processed_at TIMESTAMPTZ NULL
        )`,
        `CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_driver_id ON withdrawal_requests (driver_id)`,
        `CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests (status)`,

        `CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            ride_id TEXT NULL,
            sender_id TEXT NULL,
            recipient_id TEXT NULL,
            message TEXT NOT NULL,
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_chat_ride_id ON chat_messages (ride_id)`,
        `CREATE INDEX IF NOT EXISTS idx_chat_sender_recipient ON chat_messages (sender_id, recipient_id)`,

        `CREATE TABLE IF NOT EXISTS admin_settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            settings TEXT NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,

        `CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id)`,

        `CREATE TABLE IF NOT EXISTS admin_logs (
            id BIGSERIAL PRIMARY KEY,
            admin_id TEXT NOT NULL,
            action TEXT NOT NULL,
            target_type TEXT NULL,
            target_id TEXT NULL,
            old_values TEXT NULL,
            new_values TEXT NULL,
            ip_address TEXT NULL,
            user_agent TEXT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs (admin_id)`,
        `CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs (action)`,
        `CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs (created_at)`,

        `CREATE TABLE IF NOT EXISTS hotels (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            address TEXT NOT NULL,
            rating NUMERIC(3,2) NOT NULL DEFAULT 0.0,
            price_range TEXT NULL,
            lat NUMERIC(10,8) NOT NULL,
            lng NUMERIC(11,8) NOT NULL,
            image TEXT NULL,
            commission NUMERIC(5,2) NOT NULL DEFAULT 5.0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,

        `CREATE TABLE IF NOT EXISTS promo_codes (
            id TEXT PRIMARY KEY,
            code TEXT NOT NULL UNIQUE,
            type TEXT NOT NULL CHECK (type IN ('percentage','fixed')),
            value NUMERIC(10,2) NOT NULL,
            max_uses INTEGER NOT NULL DEFAULT 0,
            used_count INTEGER NOT NULL DEFAULT 0,
            min_fare NUMERIC(10,2) NOT NULL DEFAULT 0,
            max_discount NUMERIC(10,2) NOT NULL DEFAULT 0,
            valid_from TIMESTAMPTZ NOT NULL,
            valid_until TIMESTAMPTZ NOT NULL,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_promo_code ON promo_codes (code)`,

        `CREATE TABLE IF NOT EXISTS referrals (
            id TEXT PRIMARY KEY,
            referrer_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
            referred_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMPTZ NULL
        )`,

        // OTP for login (WhatsApp/Email)
        `CREATE TABLE IF NOT EXISTS login_otp_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            channel TEXT NOT NULL CHECK (channel IN ('whatsapp','email')),
            code_hash TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            max_attempts INTEGER NOT NULL DEFAULT 5,
            expires_at TIMESTAMPTZ NOT NULL,
            consumed_at TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_login_otp_user_id ON login_otp_sessions (user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_login_otp_expires_at ON login_otp_sessions (expires_at)`,
        `CREATE INDEX IF NOT EXISTS idx_login_otp_consumed_at ON login_otp_sessions (consumed_at)`,

        // Enterprise tables
        `CREATE TABLE IF NOT EXISTS driver_credit_accounts (
            driver_id TEXT PRIMARY KEY,
            balance NUMERIC(12,2) NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE TABLE IF NOT EXISTS driver_credit_ledger (
            id TEXT PRIMARY KEY,
            driver_id TEXT NOT NULL,
            ride_id TEXT NULL,
            amount NUMERIC(12,2) NOT NULL,
            entry_type TEXT NOT NULL CHECK (entry_type IN ('admin_credit','ride_commission','ride_fee','adjustment','refund')),
            description TEXT NULL,
            created_by TEXT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_driver_credit_ledger_driver_id ON driver_credit_ledger (driver_id)`,
        `CREATE INDEX IF NOT EXISTS idx_driver_credit_ledger_ride_id ON driver_credit_ledger (ride_id)`,
        `CREATE INDEX IF NOT EXISTS idx_driver_credit_ledger_created_at ON driver_credit_ledger (created_at)`,

        `CREATE TABLE IF NOT EXISTS system_revenue_ledger (
            id TEXT PRIMARY KEY,
            ride_id TEXT NULL,
            driver_id TEXT NULL,
            amount NUMERIC(12,2) NOT NULL,
            revenue_type TEXT NOT NULL CHECK (revenue_type IN ('commission','fee','other')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_system_revenue_created_at ON system_revenue_ledger (created_at)`,
        `CREATE INDEX IF NOT EXISTS idx_system_revenue_ride_id ON system_revenue_ledger (ride_id)`,
        `CREATE INDEX IF NOT EXISTS idx_system_revenue_driver_id ON system_revenue_ledger (driver_id)`,

        `CREATE TABLE IF NOT EXISTS promo_code_usage (
            id TEXT PRIMARY KEY,
            promo_code_id TEXT NULL,
            user_id TEXT NULL,
            ride_id TEXT NULL,
            discount_amount NUMERIC(10,2) NULL,
            used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,

        `CREATE TABLE IF NOT EXISTS emergency_contacts (
            id TEXT PRIMARY KEY,
            user_id TEXT NULL,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            relationship TEXT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,

        `CREATE TABLE IF NOT EXISTS sos_alerts (
            id TEXT PRIMARY KEY,
            ride_id TEXT NULL,
            user_id TEXT NULL,
            lat NUMERIC(10,8) NULL,
            lng NUMERIC(11,8) NULL,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved','false_alarm')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            resolved_at TIMESTAMPTZ NULL
        )`,

        `CREATE TABLE IF NOT EXISTS surge_zones (
            id TEXT PRIMARY KEY,
            h3_index TEXT NOT NULL UNIQUE,
            lat NUMERIC(10,8) NULL,
            lng NUMERIC(11,8) NULL,
            multiplier NUMERIC(5,2) NULL,
            active_rides INTEGER NOT NULL DEFAULT 0,
            available_drivers INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,

        `CREATE TABLE IF NOT EXISTS fraud_logs (
            id TEXT PRIMARY KEY,
            user_id TEXT NULL,
            ride_id TEXT NULL,
            type TEXT NULL,
            severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
            description TEXT NULL,
            data TEXT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,

        `CREATE TABLE IF NOT EXISTS pool_rides (
            id TEXT PRIMARY KEY,
            driver_id TEXT NULL,
            ride_ids TEXT NULL,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,

        `CREATE TABLE IF NOT EXISTS ride_stops (
            id TEXT PRIMARY KEY,
            ride_id TEXT NULL,
            address TEXT NULL,
            lat NUMERIC(10,8) NULL,
            lng NUMERIC(11,8) NULL,
            stop_order INTEGER NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','skipped')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMPTZ NULL
        )`,

        `CREATE TABLE IF NOT EXISTS background_checks (
            id TEXT PRIMARY KEY,
            driver_id TEXT NULL,
            national_id TEXT NULL,
            driving_license TEXT NULL,
            criminal_record TEXT NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
            submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            reviewed_at TIMESTAMPTZ NULL,
            reviewed_by TEXT NULL,
            rejection_reason TEXT NULL
        )`,

        `CREATE TABLE IF NOT EXISTS instant_payouts (
            id TEXT PRIMARY KEY,
            driver_id TEXT NULL,
            amount NUMERIC(12,2) NULL,
            fee NUMERIC(12,2) NULL,
            status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed','failed')),
            requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMPTZ NULL
        )`,

        `CREATE TABLE IF NOT EXISTS ab_experiments (
            id TEXT PRIMARY KEY,
            name TEXT NULL,
            variants TEXT NULL,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE TABLE IF NOT EXISTS ab_assignments (
            id TEXT PRIMARY KEY,
            experiment_id TEXT NULL,
            user_id TEXT NULL,
            variant TEXT NULL,
            assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE TABLE IF NOT EXISTS ab_events (
            id TEXT PRIMARY KEY,
            experiment_id TEXT NULL,
            user_id TEXT NULL,
            variant TEXT NULL,
            event_name TEXT NULL,
            value NUMERIC(12,2) NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,

        `CREATE TABLE IF NOT EXISTS package_deliveries (
            id TEXT PRIMARY KEY,
            sender_id TEXT NULL,
            sender_name TEXT NULL,
            sender_phone TEXT NULL,
            recipient_name TEXT NULL,
            recipient_phone TEXT NULL,
            receiver_name TEXT NULL,
            receiver_phone TEXT NULL,
            pickup_address TEXT NULL,
            pickup_lat NUMERIC(10,8) NULL,
            pickup_lng NUMERIC(11,8) NULL,
            dropoff_address TEXT NULL,
            dropoff_lat NUMERIC(10,8) NULL,
            dropoff_lng NUMERIC(11,8) NULL,
            package_type TEXT NULL CHECK (package_type IN ('document','small','medium','large')),
            weight NUMERIC(10,2) NULL,
            description TEXT NULL,
            declared_value NUMERIC(12,2) NULL,
            fare NUMERIC(12,2) NULL,
            distance NUMERIC(10,2) NULL,
            driver_id TEXT NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','assigned','picked_up','in_transit','delivered','cancelled')),
            proof_photo TEXT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            assigned_at TIMESTAMPTZ NULL,
            delivered_at TIMESTAMPTZ NULL
        )`,

        `CREATE TABLE IF NOT EXISTS trip_recordings (
            id TEXT PRIMARY KEY,
            ride_id TEXT NULL,
            user_id TEXT NULL,
            file_path TEXT NULL,
            file_size BIGINT NULL,
            status TEXT NOT NULL DEFAULT 'recording' CHECK (status IN ('recording','completed','stopped','deleted')),
            started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            stopped_at TIMESTAMPTZ NULL,
            deleted_at TIMESTAMPTZ NULL,
            deletion_reason TEXT NULL
        )`,

        // Optional driver goals (used by earnings dashboard)
        `CREATE TABLE IF NOT EXISTS driver_goals (
            driver_id TEXT PRIMARY KEY,
            daily_goal NUMERIC(12,2) NOT NULL DEFAULT 0,
            weekly_goal NUMERIC(12,2) NOT NULL DEFAULT 0,
            monthly_goal NUMERIC(12,2) NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`
    ];

    for (const stmt of statements) {
        await exec(stmt);
    }
}

async function applySchemaFixups() {
    // Keep init idempotent even if an older schema exists.
    await exec(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_id TEXT NULL`);

    await exec(`ALTER TABLE pool_rides ADD COLUMN IF NOT EXISTS driver_id TEXT NULL`);

    await exec(`ALTER TABLE package_deliveries ADD COLUMN IF NOT EXISTS sender_name TEXT NULL`);
    await exec(`ALTER TABLE package_deliveries ADD COLUMN IF NOT EXISTS sender_phone TEXT NULL`);
    await exec(`ALTER TABLE package_deliveries ADD COLUMN IF NOT EXISTS recipient_name TEXT NULL`);
    await exec(`ALTER TABLE package_deliveries ADD COLUMN IF NOT EXISTS recipient_phone TEXT NULL`);
    await exec(`ALTER TABLE package_deliveries ADD COLUMN IF NOT EXISTS weight NUMERIC(10,2) NULL`);
}

async function seedDefaults() {
    // Taxi types (minimal defaults)
    const taxiTypes = [
        {
            id: 'eco',
            name_fa: 'اقتصادی',
            name_en: 'Economy',
            description_fa: 'سفرهای مقرون به صرفه برای روزمره',
            description_en: 'Affordable rides for everyday trips',
            base_fare: 30000,
            per_km_rate: 5000,
            color: '#10B981',
            image_path: '/img/map-icons/eco.svg',
            features: JSON.stringify(['Standard car', 'Air conditioning', 'Safe ride'])
        },
        {
            id: 'plus',
            name_fa: 'پلاس',
            name_en: 'Plus',
            description_fa: 'راحتی بیشتر با خودروهای بهتر',
            description_en: 'More comfort with better vehicles',
            base_fare: 45000,
            per_km_rate: 7000,
            color: '#3B82F6',
            image_path: '/img/map-icons/plus.svg',
            features: JSON.stringify(['Newer car', 'Premium AC', 'Phone charger'])
        },
        {
            id: 'lux',
            name_fa: 'لوکس',
            name_en: 'Luxury',
            description_fa: 'خودروهای پریمیوم برای مناسبت های خاص',
            description_en: 'Premium vehicles for special occasions',
            base_fare: 70000,
            per_km_rate: 10000,
            color: '#8B5CF6',
            image_path: '/img/map-icons/lux.svg',
            features: JSON.stringify(['Luxury car', 'Leather seats', 'WiFi', 'Water'])
        },
        {
            id: 'premium',
            name_fa: 'پریمیوم',
            name_en: 'Premium',
            description_fa: 'سرویس VIP با رانندگان باتجربه',
            description_en: 'Top-tier service with experienced drivers',
            base_fare: 100000,
            per_km_rate: 15000,
            color: '#F59E0B',
            image_path: '/img/map-icons/premium.svg',
            features: JSON.stringify(['Premium car', 'VIP', 'Drinks', 'Priority support'])
        }
    ];

    for (const tt of taxiTypes) {
        await exec(
            `INSERT INTO taxi_types (id, name_fa, name_en, description_fa, description_en, base_fare, per_km_rate, color, image_path, features, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW(), NOW())
             ON CONFLICT (id) DO UPDATE SET
               name_fa = EXCLUDED.name_fa,
               name_en = EXCLUDED.name_en,
               description_fa = EXCLUDED.description_fa,
               description_en = EXCLUDED.description_en,
               base_fare = EXCLUDED.base_fare,
               per_km_rate = EXCLUDED.per_km_rate,
               color = EXCLUDED.color,
               image_path = EXCLUDED.image_path,
               features = EXCLUDED.features,
               updated_at = NOW()`,
            [
                tt.id,
                tt.name_fa,
                tt.name_en,
                tt.description_fa,
                tt.description_en,
                tt.base_fare,
                tt.per_km_rate,
                tt.color,
                tt.image_path,
                tt.features
            ]
        );
    }

    // Ensure a row exists (do not overwrite existing settings).
    await exec(`INSERT INTO system_settings (id, updated_at) VALUES (1, NOW()) ON CONFLICT (id) DO NOTHING`);

    // Admin settings default JSON (stored as TEXT)
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
        system: {
            defaultCenter: { lat: 34.5333, lng: 69.1667 },
            driverUpdateInterval: 1000,
            enableManualFare: true,
            radiusLimit: 10,
            dispatchTimeout: 20
        },
        hotelsModule: { enabled: true, commission: 5 },
        auth: authDefaults
    };

    const defaultSettings = JSON.stringify(defaultSettingsObj);
    await exec(`INSERT INTO admin_settings (id, settings, updated_at) VALUES (1, ?, NOW()) ON CONFLICT (id) DO NOTHING`, [
        defaultSettings
    ]);

    // Backfill missing keys for existing settings (no overwrite).
    try {
        const settingsRows = await query(`SELECT settings FROM admin_settings WHERE id = 1 LIMIT 1`);
        const raw = settingsRows.rows?.[0]?.settings;
        if (raw) {
            const current = typeof raw === 'string' ? JSON.parse(raw) : raw;
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
                await exec(`UPDATE admin_settings SET settings = ?, updated_at = NOW() WHERE id = 1`, [JSON.stringify(current)]);
            }
        }
    } catch {
        // ignore
    }

    // Ensure credit account row exists for every driver.
    await exec(
        `INSERT INTO driver_credit_accounts (driver_id, balance, updated_at)
         SELECT u.id, 0, NOW()
         FROM users u
         WHERE u.role = 'driver'
         ON CONFLICT (driver_id) DO NOTHING`
    );
}

async function seedDemoIfNeeded() {
    const countRows = await query('SELECT COUNT(*) as count FROM users');
    const userCount = Number(countRows.rows?.[0]?.count || 0);
    const shouldSeedDemo = process.env.SEED_DEMO_DATA === '1' || userCount === 0;
    if (!shouldSeedDemo) return;

    const adminHash = await bcrypt.hash('admin123', 10);
    const driverHash = await bcrypt.hash('driver123', 10);
    const riderHash = await bcrypt.hash('rider123', 10);

    // Users
    await exec(
        `INSERT INTO users (id, name, phone, password_hash, role, balance, rating, total_trips, created_at, updated_at)
         VALUES
           ('admin-id', 'Admin User', '+10000000000', ?, 'admin', 1000000, 5.0, 0, NOW(), NOW()),
           ('driver-id', 'Driver User', '+10000000001', ?, 'driver', 5000, 4.8, 120, NOW(), NOW()),
           ('rider-id', 'Rider User', '+10000000002', ?, 'rider', 2000, 4.9, 75, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [adminHash, driverHash, riderHash]
    );

    // Driver profile
    await exec(
        `INSERT INTO drivers (id, vehicle_make, vehicle_model, vehicle_plate, vehicle_type, taxi_type_id, status, current_lat, current_lng, base_fare, per_km_rate, is_active, kyc_status, driver_level, last_updated)
         VALUES
           ('driver-id', 'Toyota', 'Corolla', 'KBL-0001', 'eco', 'eco', 'available', 34.5333, 69.1667, 50, 20, TRUE, 'approved', 'basic', NOW())
         ON CONFLICT (id) DO NOTHING`
    );

    // Credit account
    await exec(
        `INSERT INTO driver_credit_accounts (driver_id, balance, updated_at)
         VALUES ('driver-id', 0, NOW())
         ON CONFLICT (driver_id) DO NOTHING`
    );
}


async function main() {
    if (db.provider !== 'postgres') {
        throw new Error(`DB_PROVIDER must be 'postgres' for init-db-postgres (current: ${db.provider})`);
    }

    log('Creating schema...');
    await createSchema();
    log('Applying schema fixups...');
    await applySchemaFixups();

    log('Seeding defaults...');
    await seedDefaults();

    log('Seeding demo (if needed)...');
    await seedDemoIfNeeded();

    log('Done');
    await db.close();
}

// Export for use when imported as module (Vercel serverless)
export async function initDbIfNeeded(): Promise<void> {
    if (db.provider !== 'postgres') return;
    try {
        await createSchema();
        await applySchemaFixups();
        await seedDefaults();
        await seedDemoIfNeeded();
        log('DB init complete');
    } catch (e: any) {
        log('DB init error (non-fatal):', e?.message || e);
    }
}

// Only run directly when executed as a script (not imported)
const isMain = process.argv[1] && (process.argv[1].includes('init-db-postgres') || process.argv[1].includes('tsx'));
if (isMain) {
    main().catch(async (e) => {
        console.error('[init-db-postgres] Failed:', e?.message || e);
        try { await db.close(); } catch {}
        process.exit(1);
    });
}
