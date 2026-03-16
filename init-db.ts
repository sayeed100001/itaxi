import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'itaxi.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('rider', 'driver', 'admin')),
    avatar TEXT,
    rating REAL DEFAULT 5.0,
    balance REAL DEFAULT 0.0,
    total_trips INTEGER DEFAULT 0,
    loyalty_points INTEGER DEFAULT 0,
    discount_percent REAL DEFAULT 0.0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Drivers Table
CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY,
    vehicle_make TEXT,
    vehicle_model TEXT,
    vehicle_plate TEXT,
    vehicle_type TEXT CHECK (vehicle_type IN ('eco', 'plus', 'lux')),
    status TEXT DEFAULT 'offline' CHECK (status IN ('available', 'busy', 'offline', 'suspended')),
    current_lat REAL,
    current_lng REAL,
    h3_index TEXT,
    bearing REAL DEFAULT 0,
    base_fare REAL DEFAULT 50.0,
    per_km_rate REAL DEFAULT 20.0,
    is_active INTEGER DEFAULT 1,
    last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_h3 ON drivers(h3_index);

-- Rides Table
CREATE TABLE IF NOT EXISTS rides (
    id TEXT PRIMARY KEY,
    rider_id TEXT,
    driver_id TEXT,
    pickup_address TEXT NOT NULL,
    pickup_lat REAL NOT NULL,
    pickup_lng REAL NOT NULL,
    dropoff_address TEXT NOT NULL,
    dropoff_lat REAL NOT NULL,
    dropoff_lng REAL NOT NULL,
    fare REAL NOT NULL,
    proposed_fare REAL,
    status TEXT DEFAULT 'searching' CHECK (status IN ('searching', 'negotiating', 'requested', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled')),
    service_type TEXT NOT NULL,
    distance REAL,
    duration INTEGER,
    scheduled_time TEXT,
    rider_rating INTEGER CHECK (rider_rating >= 1 AND rider_rating <= 5),
    driver_rating INTEGER CHECK (driver_rating >= 1 AND driver_rating <= 5),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rider_id) REFERENCES users(id),
    FOREIGN KEY (driver_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_rides_rider_id ON rides(rider_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed')),
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

-- Credit Requests
CREATE TABLE IF NOT EXISTS credit_requests (
    id TEXT PRIMARY KEY,
    driver_id TEXT,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    processed_at TEXT,
    FOREIGN KEY (driver_id) REFERENCES users(id)
);

-- Withdrawal Requests
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id TEXT PRIMARY KEY,
    driver_id TEXT,
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    account_details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    processed_at TEXT,
    FOREIGN KEY (driver_id) REFERENCES users(id)
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    ride_id TEXT,
    sender_id TEXT,
    recipient_id TEXT,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_ride_id ON chat_messages(ride_id);
CREATE INDEX IF NOT EXISTS idx_chat_sender_recipient ON chat_messages(sender_id, recipient_id);

-- Password Resets
CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);

-- Admin Settings
CREATE TABLE IF NOT EXISTS admin_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    settings TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Promo codes table
CREATE TABLE IF NOT EXISTS promo_codes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
    value REAL NOT NULL,
    max_uses INTEGER DEFAULT 0,
    used_count INTEGER DEFAULT 0,
    min_fare REAL DEFAULT 0,
    max_discount REAL DEFAULT 0,
    valid_from TEXT NOT NULL,
    valid_until TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promo_code ON promo_codes(code);

-- Promo code usage
CREATE TABLE IF NOT EXISTS promo_code_usage (
    id TEXT PRIMARY KEY,
    promo_code_id TEXT,
    user_id TEXT,
    ride_id TEXT,
    discount_amount REAL,
    used_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (ride_id) REFERENCES rides(id)
);

-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    referrer_id TEXT,
    referred_user_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    FOREIGN KEY (referrer_id) REFERENCES users(id),
    FOREIGN KEY (referred_user_id) REFERENCES users(id)
);

-- Emergency contacts
CREATE TABLE IF NOT EXISTS emergency_contacts (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    relationship TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- SOS alerts
CREATE TABLE IF NOT EXISTS sos_alerts (
    id TEXT PRIMARY KEY,
    ride_id TEXT,
    user_id TEXT,
    lat REAL,
    lng REAL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'false_alarm')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    resolved_at TEXT,
    FOREIGN KEY (ride_id) REFERENCES rides(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Surge zones
CREATE TABLE IF NOT EXISTS surge_zones (
    id TEXT PRIMARY KEY,
    h3_index TEXT UNIQUE,
    lat REAL,
    lng REAL,
    multiplier REAL DEFAULT 1.0,
    active_rides INTEGER DEFAULT 0,
    available_drivers INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Fraud logs
CREATE TABLE IF NOT EXISTS fraud_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    ride_id TEXT,
    type TEXT,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT,
    data TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Pool rides
CREATE TABLE IF NOT EXISTS pool_rides (
    id TEXT PRIMARY KEY,
    driver_id TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    FOREIGN KEY (driver_id) REFERENCES users(id)
);

-- Ride stops
CREATE TABLE IF NOT EXISTS ride_stops (
    id TEXT PRIMARY KEY,
    ride_id TEXT,
    address TEXT NOT NULL,
    lat REAL,
    lng REAL,
    stop_order INTEGER,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
);

-- Background checks
CREATE TABLE IF NOT EXISTS background_checks (
    id TEXT PRIMARY KEY,
    driver_id TEXT,
    national_id TEXT,
    driving_license TEXT,
    criminal_record TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by TEXT,
    rejection_reason TEXT,
    submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TEXT,
    FOREIGN KEY (driver_id) REFERENCES users(id)
);

-- Instant payouts
CREATE TABLE IF NOT EXISTS instant_payouts (
    id TEXT PRIMARY KEY,
    driver_id TEXT,
    amount REAL,
    fee REAL,
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    FOREIGN KEY (driver_id) REFERENCES users(id)
);

-- A/B experiments
CREATE TABLE IF NOT EXISTS ab_experiments (
    id TEXT PRIMARY KEY,
    name TEXT,
    variants TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    stopped_at TEXT
);

CREATE TABLE IF NOT EXISTS ab_assignments (
    id TEXT PRIMARY KEY,
    experiment_id TEXT,
    user_id TEXT,
    variant TEXT,
    assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (experiment_id) REFERENCES ab_experiments(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ab_events (
    id TEXT PRIMARY KEY,
    experiment_id TEXT,
    user_id TEXT,
    variant TEXT,
    event_name TEXT,
    value REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (experiment_id) REFERENCES ab_experiments(id)
);

-- Package deliveries
CREATE TABLE IF NOT EXISTS package_deliveries (
    id TEXT PRIMARY KEY,
    sender_id TEXT,
    driver_id TEXT,
    pickup_address TEXT,
    pickup_lat REAL,
    pickup_lng REAL,
    dropoff_address TEXT,
    dropoff_lat REAL,
    dropoff_lng REAL,
    sender_name TEXT,
    sender_phone TEXT,
    recipient_name TEXT,
    recipient_phone TEXT,
    package_type TEXT CHECK (package_type IN ('document', 'small', 'medium', 'large')),
    weight REAL,
    description TEXT,
    declared_value REAL,
    fare REAL,
    distance REAL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled')),
    proof_photo TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    assigned_at TEXT,
    delivered_at TEXT,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (driver_id) REFERENCES users(id)
);

-- Trip recordings
CREATE TABLE IF NOT EXISTS trip_recordings (
    id TEXT PRIMARY KEY,
    ride_id TEXT,
    user_id TEXT,
    file_path TEXT,
    file_size INTEGER,
    status TEXT DEFAULT 'recording' CHECK (status IN ('recording', 'completed', 'stopped', 'deleted')),
    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
    stopped_at TEXT,
    deleted_at TEXT,
    deletion_reason TEXT,
    FOREIGN KEY (ride_id) REFERENCES rides(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Add 2FA and other fields to users
ALTER TABLE users ADD COLUMN two_factor_secret TEXT;
ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN referral_code TEXT;
ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE users ADD COLUMN public_key TEXT;
ALTER TABLE users ADD COLUMN key_generated_at TEXT;

-- Add fields to rides
ALTER TABLE rides ADD COLUMN base_fare REAL;
ALTER TABLE rides ADD COLUMN surge_multiplier REAL DEFAULT 1.0;
ALTER TABLE rides ADD COLUMN promo_discount REAL DEFAULT 0;
ALTER TABLE rides ADD COLUMN final_fare REAL;
ALTER TABLE rides ADD COLUMN pool_id TEXT;
ALTER TABLE rides ADD COLUMN recording_enabled INTEGER DEFAULT 0;
ALTER TABLE rides ADD COLUMN recording_url TEXT;

-- Add fields to drivers
ALTER TABLE drivers ADD COLUMN background_check_status TEXT DEFAULT 'pending';
ALTER TABLE drivers ADD COLUMN background_check_date TEXT;
ALTER TABLE drivers ADD COLUMN stripe_account_id TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
`);

// Generate UUID function
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Seed data
const adminHash = bcrypt.hashSync('admin123', 10);
const driverHash = bcrypt.hashSync('driver123', 10);
const riderHash = bcrypt.hashSync('rider123', 10);

// Insert admin
db.prepare(`INSERT OR IGNORE INTO users (id, name, phone, password_hash, role, balance) 
            VALUES (?, ?, ?, ?, ?, ?)`).run('admin-id', 'Admin User', '+10000000000', adminHash, 'admin', 1000000);

// Insert driver
const driverId = 'driver-id';
db.prepare(`INSERT OR IGNORE INTO users (id, name, phone, password_hash, role, balance) 
            VALUES (?, ?, ?, ?, ?, ?)`).run(driverId, 'Driver Demo', '+10000000001', driverHash, 'driver', 500);

db.prepare(`INSERT OR IGNORE INTO drivers (id, vehicle_model, vehicle_plate, vehicle_type, status, current_lat, current_lng, base_fare, per_km_rate) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(driverId, 'Toyota Corolla', 'KBL-1234', 'plus', 'available', 34.5333, 69.1667, 50, 20);

// Insert rider
db.prepare(`INSERT OR IGNORE INTO users (id, name, phone, password_hash, role, balance) 
            VALUES (?, ?, ?, ?, ?, ?)`).run('rider-id', 'Rider Demo', '+10000000002', riderHash, 'rider', 200);

// Insert default settings
const defaultSettings = JSON.stringify({
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
    hotelsModule: { enabled: true, commission: 5 }
});

db.prepare(`INSERT OR IGNORE INTO admin_settings (id, settings) VALUES (?, ?)`).run(1, defaultSettings);

console.log('✅ SQLite database initialized successfully!');
console.log('📁 Database file: itaxi.db');

db.close();

export default db;
