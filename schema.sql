-- iTaxi Database Schema

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('rider', 'driver', 'admin')),
    avatar TEXT,
    rating DECIMAL(3,2) DEFAULT 5.0,
    balance DECIMAL(12,2) DEFAULT 0.0,
    total_trips INTEGER DEFAULT 0,
    loyalty_points INTEGER DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Drivers Table (Extends user for driver-specific info)
CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    vehicle_make TEXT,
    vehicle_model TEXT,
    vehicle_plate TEXT,
    vehicle_type TEXT CHECK (vehicle_type IN ('eco', 'plus', 'lux')),
    status TEXT DEFAULT 'offline' CHECK (status IN ('available', 'busy', 'offline', 'suspended')),
    current_lat DECIMAL(10,8),
    current_lng DECIMAL(11,8),
    h3_index TEXT,
    bearing DECIMAL(5,2) DEFAULT 0,
    base_fare DECIMAL(10,2) DEFAULT 50.0,
    per_km_rate DECIMAL(10,2) DEFAULT 20.0,
    is_active BOOLEAN DEFAULT true,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_location ON drivers(current_lat, current_lng);
CREATE INDEX IF NOT EXISTS idx_drivers_h3 ON drivers(h3_index);

-- Rides Table
CREATE TABLE IF NOT EXISTS rides (
    id TEXT PRIMARY KEY,
    rider_id TEXT REFERENCES users(id),
    driver_id TEXT REFERENCES users(id),
    pickup_address TEXT NOT NULL,
    pickup_lat DECIMAL(10,8) NOT NULL,
    pickup_lng DECIMAL(11,8) NOT NULL,
    dropoff_address TEXT NOT NULL,
    dropoff_lat DECIMAL(10,8) NOT NULL,
    dropoff_lng DECIMAL(11,8) NOT NULL,
    fare DECIMAL(10,2) NOT NULL,
    proposed_fare DECIMAL(10,2),
    status TEXT DEFAULT 'searching' CHECK (status IN ('searching', 'negotiating', 'requested', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled')),
    service_type TEXT NOT NULL,
    distance DECIMAL(10,2),
    duration INTEGER,
    scheduled_time TIMESTAMP,
    notes TEXT,
    rider_rating INTEGER CHECK (rider_rating >= 1 AND rider_rating <= 5),
    driver_rating INTEGER CHECK (driver_rating >= 1 AND driver_rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rides_rider_id ON rides(rider_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);

-- Hotels Table
CREATE TABLE IF NOT EXISTS hotels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    rating DECIMAL(3,2) DEFAULT 0.0,
    price_range TEXT,
    lat DECIMAL(10,8) NOT NULL,
    lng DECIMAL(11,8) NOT NULL,
    image TEXT,
    commission DECIMAL(5,2) DEFAULT 5.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    amount DECIMAL(12,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed')),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

-- Withdrawal Requests
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id TEXT PRIMARY KEY,
    driver_id TEXT REFERENCES users(id),
    amount DECIMAL(12,2) NOT NULL,
    method TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    account_details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Credit Requests
CREATE TABLE IF NOT EXISTS credit_requests (
    id TEXT PRIMARY KEY,
    driver_id TEXT REFERENCES users(id),
    amount DECIMAL(12,2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    ride_id TEXT,
    sender_id TEXT,
    recipient_id TEXT,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_ride_id ON chat_messages(ride_id);
CREATE INDEX IF NOT EXISTS idx_chat_sender_recipient ON chat_messages(sender_id, recipient_id);

-- Admin Settings Table
CREATE TABLE IF NOT EXISTS admin_settings (
    id INTEGER PRIMARY KEY DEFAULT 1, -- Singleton row
    settings TEXT NOT NULL, -- JSON as TEXT for SQLite compatibility
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Taxi Types Table (مفقود بود)
CREATE TABLE IF NOT EXISTS taxi_types (
    id VARCHAR(50) PRIMARY KEY,
    name_fa VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    description_fa TEXT,
    description_en TEXT,
    base_fare DECIMAL(10,2) NOT NULL DEFAULT 30000,
    per_km_rate DECIMAL(10,2) NOT NULL DEFAULT 5000,
    color VARCHAR(7) NOT NULL DEFAULT '#10B981',
    image_path VARCHAR(255),
    features TEXT, -- JSON as TEXT for SQLite compatibility
    min_rating DECIMAL(3,2) DEFAULT NULL,
    min_rides INTEGER DEFAULT NULL,
    icon_size TEXT DEFAULT '{"width": 40, "height": 40}', -- JSON as TEXT
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_taxi_types_active ON taxi_types(is_active);

-- اضافه کردن فیلدهای مفقود به جدول drivers
ALTER TABLE drivers ADD COLUMN taxi_type_id VARCHAR(50) DEFAULT 'eco';
ALTER TABLE drivers ADD COLUMN service_types TEXT DEFAULT '["city", "airport"]'; -- JSON as TEXT
ALTER TABLE drivers ADD COLUMN earnings DECIMAL(12,2) DEFAULT 0.0;
ALTER TABLE drivers ADD COLUMN join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_drivers_taxi_type ON drivers(taxi_type_id);
CREATE INDEX IF NOT EXISTS idx_drivers_earnings ON drivers(earnings);

-- Initial Data Seeds

-- Seed Demo Users with bcrypt hashed passwords
-- Admin (Password: admin123)
INSERT INTO users (id, name, phone, password_hash, role, balance, rating)
VALUES ('u0', 'Admin User', '+10000000000', '$2b$10$8K1p/a0dqaillc9ZisYjem4KJnaRLRE9WAy2m5L3nEcCqQyyhQBJG', 'admin', 1000000, 5.0)
ON CONFLICT (phone) DO NOTHING;

-- Driver (Password: driver123)
INSERT INTO users (id, name, phone, password_hash, role, balance, rating, total_trips)
VALUES ('u1', 'Ahmad Khan', '+10000000001', '$2b$10$8K1p/a0dqaillc9ZisYjem4KJnaRLRE9WAy2m5L3nEcCqQyyhQBJG', 'driver', 5000, 4.8, 150)
ON CONFLICT (phone) DO NOTHING;

-- Rider (Password: rider123)
INSERT INTO users (id, name, phone, password_hash, role, balance, rating, total_trips, loyalty_points)
VALUES ('u2', 'Sara Ahmadi', '+10000000002', '$2b$10$8K1p/a0dqaillc9ZisYjem4KJnaRLRE9WAy2m5L3nEcCqQyyhQBJG', 'rider', 2000, 4.9, 75, 25)
ON CONFLICT (phone) DO NOTHING;

-- Additional Demo Drivers
INSERT INTO users (id, name, phone, password_hash, role, balance, rating, total_trips)
VALUES 
('u3', 'Mohammad Ali', '+10000000003', '$2b$10$8K1p/a0dqaillc9ZisYjem4KJnaRLRE9WAy2m5L3nEcCqQyyhQBJG', 'driver', 3500, 4.7, 120),
('u4', 'Hassan Ahmadi', '+10000000004', '$2b$10$8K1p/a0dqaillc9ZisYjem4KJnaRLRE9WAy2m5L3nEcCqQyyhQBJG', 'driver', 4200, 4.9, 200),
('u5', 'Omar Karimi', '+10000000005', '$2b$10$8K1p/a0dqaillc9ZisYjem4KJnaRLRE9WAy2m5L3nEcCqQyyhQBJG', 'driver', 2800, 4.6, 95)
ON CONFLICT (phone) DO NOTHING;

-- Seed Driver Records
INSERT INTO drivers (id, vehicle_make, vehicle_model, vehicle_plate, vehicle_type, status, current_lat, current_lng, base_fare, per_km_rate)
VALUES 
('u1', 'Toyota', 'Corolla', 'KBL-1234', 'eco', 'available', 34.5333, 69.1667, 50, 20),
('u3', 'Honda', 'Civic', 'HRT-5678', 'plus', 'available', 34.5400, 69.1700, 60, 25),
('u4', 'Hyundai', 'Elantra', 'KDH-9012', 'eco', 'available', 34.5280, 69.1620, 50, 20),
('u5', 'Toyota', 'Camry', 'BLK-3456', 'plus', 'busy', 34.5380, 69.1750, 60, 25)
ON CONFLICT (id) DO NOTHING;

-- Demo Hotels in Kabul
INSERT INTO hotels (id, name, address, rating, price_range, lat, lng, image)
VALUES 
('h1', 'Kabul Serena Hotel', 'Froshgah Street, Kabul', 4.5, '$$$', 34.5167, 69.1833, 'https://images.unsplash.com/photo-1566073771259-6a8506099945'),
('h2', 'InterContinental Kabul', 'Bagh-e Bala, Kabul', 4.2, '$$$$', 34.5333, 69.1667, 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa'),
('h3', 'Safi Landmark Hotel', 'Shaheed Square, Kabul', 4.0, '$$', 34.5280, 69.1720, 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4'),
('h4', 'Kabul Star Hotel', 'Wazir Akbar Khan, Kabul', 3.8, '$$', 34.5400, 69.1800, 'https://images.unsplash.com/photo-1571896349842-33c89424de2d')
ON CONFLICT (id) DO NOTHING;

-- Seed Default Settings
INSERT INTO admin_settings (id, settings)
VALUES (1, '{
    "routingProvider": "ors",
    "mapProvider": "osm",
    "apiKeys": { "ors": "", "mapbox": "", "google": "" },
    "pricing": { "minFare": 50, "commissionRate": 20, "cancellationFee": 20, "intercityMultiplier": 1.5 },
    "services": [
        { "id": "city", "name": "iTaxi City", "baseFare": 40, "perKm": 15, "perMin": 2, "minFare": 50, "commission": 20, "icon": "Car" },
        { "id": "intercity", "name": "iTaxi Intercity", "baseFare": 80, "perKm": 30, "perMin": 5, "minFare": 100, "commission": 20, "icon": "Car" },
        { "id": "airport", "name": "iTaxi Airport", "baseFare": 100, "perKm": 35, "perMin": 6, "minFare": 150, "commission": 20, "icon": "Plane" }
    ],
    "system": { "defaultCenter": { "lat": 34.5333, "lng": 69.1667 }, "driverUpdateInterval": 1000, "enableManualFare": true, "radiusLimit": 10, "dispatchTimeout": 20 },
    "hotelsModule": { "enabled": true, "commission": 5 }
}')
ON CONFLICT (id) DO NOTHING;

-- Seed Default Taxi Types
INSERT INTO taxi_types (id, name_fa, name_en, description_fa, description_en, base_fare, per_km_rate, color, image_path, features) VALUES
('eco', 'اقتصادی', 'Economy', 'سفرهای مقرون به صرفه برای روزمره', 'Affordable rides for everyday trips', 30000, 5000, '#10B981', '/img/map-icons/eco.svg', '["خودروی استاندارد", "تهویه مطبوع", "سفر امن"]'),
('plus', 'پلاس', 'Plus', 'راحتی بیشتر با خودروهای بهتر', 'More comfort with better vehicles', 45000, 7000, '#3B82F6', '/img/map-icons/plus.svg', '["خودروی جدیدتر", "تهویه پریمیوم", "شارژر موبایل"]'),
('lux', 'لوکس', 'Luxury', 'خودروهای پریمیوم برای مناسبات خاص', 'Premium vehicles for special occasions', 70000, 10000, '#8B5CF6', '/img/map-icons/lux.svg', '["خودروی لوکس", "صندلی چرمی", "وای فای", "آب"]'),
('premium', 'پریمیوم', 'Premium', 'سرویس درجه یک با رانندگان باتجربه', 'Top-tier service with experienced drivers', 100000, 15000, '#F59E0B', '/img/map-icons/premium.svg', '["خودروی پریمیوم", "سرویس VIP", "نوشیدنی", "پشتیبانی اولویت"]')
ON CONFLICT (id) DO NOTHING;
