-- اسکریپت کامل هماهنگسازی دیتابیس iTaxi
-- تبدیل از SQLite به MySQL و حل تمام مشکلات یکپارچگی

-- حذف جداول موجود (اختیاری - فقط در صورت نیاز)
-- DROP DATABASE IF EXISTS itaxi;
-- CREATE DATABASE itaxi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE itaxi;

-- 1. جدول کاربران با فیلدهای کامل
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('rider', 'driver', 'admin') NOT NULL,
    avatar TEXT,
    rating DECIMAL(3,2) DEFAULT 5.0,
    balance DECIMAL(12,2) DEFAULT 0.0,
    total_trips INT DEFAULT 0,
    loyalty_points INT DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0.0,
    two_factor_secret VARCHAR(255),
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    referral_code VARCHAR(50),
    status ENUM('active', 'suspended', 'banned') DEFAULT 'active',
    public_key TEXT,
    key_generated_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_phone (phone),
    INDEX idx_users_role (role),
    INDEX idx_users_status (status)
);

-- 2. جدول انواع تاکسی (مفقود بود)
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
    features JSON,
    min_rating DECIMAL(3,2) DEFAULT NULL,
    min_rides INT DEFAULT NULL,
    icon_size JSON DEFAULT ('{"width": 40, "height": 40}'),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_taxi_types_active (is_active)
);

-- 3. جدول رانندگان با فیلدهای کامل
CREATE TABLE IF NOT EXISTS drivers (
    id VARCHAR(255) PRIMARY KEY,
    vehicle_make VARCHAR(100),
    vehicle_model VARCHAR(100),
    vehicle_plate VARCHAR(20),
    vehicle_type ENUM('eco', 'plus', 'lux') DEFAULT 'eco',
    taxi_type_id VARCHAR(50) DEFAULT 'eco',
    status ENUM('available', 'busy', 'offline', 'suspended') DEFAULT 'offline',
    current_lat DECIMAL(10,8),
    current_lng DECIMAL(11,8),
    h3_index VARCHAR(20),
    bearing DECIMAL(5,2) DEFAULT 0,
    base_fare DECIMAL(10,2) DEFAULT 50.0,
    per_km_rate DECIMAL(10,2) DEFAULT 20.0,
    is_active BOOLEAN DEFAULT TRUE,
    earnings DECIMAL(12,2) DEFAULT 0.0,
    service_types JSON DEFAULT ('["city", "airport"]'),
    background_check_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    background_check_date TIMESTAMP NULL,
    stripe_account_id VARCHAR(255),
    join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (taxi_type_id) REFERENCES taxi_types(id) ON UPDATE CASCADE ON DELETE SET NULL,
    INDEX idx_drivers_status (status),
    INDEX idx_drivers_location (current_lat, current_lng),
    INDEX idx_drivers_h3 (h3_index),
    INDEX idx_drivers_taxi_type (taxi_type_id),
    INDEX idx_drivers_earnings (earnings)
);

-- 4. جدول سفرها با فیلدهای کامل
CREATE TABLE IF NOT EXISTS rides (
    id VARCHAR(255) PRIMARY KEY,
    rider_id VARCHAR(255),
    driver_id VARCHAR(255),
    pickup_address TEXT NOT NULL,
    pickup_lat DECIMAL(10,8) NOT NULL,
    pickup_lng DECIMAL(11,8) NOT NULL,
    dropoff_address TEXT NOT NULL,
    dropoff_lat DECIMAL(10,8) NOT NULL,
    dropoff_lng DECIMAL(11,8) NOT NULL,
    fare DECIMAL(10,2) NOT NULL,
    proposed_fare DECIMAL(10,2),
    base_fare DECIMAL(10,2),
    surge_multiplier DECIMAL(3,2) DEFAULT 1.0,
    promo_discount DECIMAL(10,2) DEFAULT 0,
    final_fare DECIMAL(10,2),
    status ENUM('searching', 'negotiating', 'requested', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled') DEFAULT 'searching',
    service_type VARCHAR(50) NOT NULL,
    distance DECIMAL(10,2),
    duration INT,
    scheduled_time TIMESTAMP NULL,
    notes TEXT,
    rider_rating INT CHECK (rider_rating >= 1 AND rider_rating <= 5),
    driver_rating INT CHECK (driver_rating >= 1 AND driver_rating <= 5),
    pool_id VARCHAR(255),
    recording_enabled BOOLEAN DEFAULT FALSE,
    recording_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (rider_id) REFERENCES users(id),
    FOREIGN KEY (driver_id) REFERENCES users(id),
    INDEX idx_rides_rider_id (rider_id),
    INDEX idx_rides_driver_id (driver_id),
    INDEX idx_rides_status (status),
    INDEX idx_rides_created_at (created_at)
);

-- 5. جدول تنظیمات سیستم
CREATE TABLE IF NOT EXISTS system_settings (
    id INT PRIMARY KEY DEFAULT 1,
    map_provider VARCHAR(50) DEFAULT 'osm',
    default_zoom INT DEFAULT 15,
    default_center_lat DECIMAL(10,8) DEFAULT 34.5553,
    default_center_lng DECIMAL(11,8) DEFAULT 69.2075,
    primary_color VARCHAR(7) DEFAULT '#3B82F6',
    secondary_color VARCHAR(7) DEFAULT '#10B981',
    features JSON DEFAULT ('{"realTimeTracking": true, "chatSystem": true, "paymentGateway": false, "notifications": true, "analytics": true}'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 6. جدول تراکنشها
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255),
    amount DECIMAL(12,2) NOT NULL,
    type ENUM('credit', 'debit') NOT NULL,
    status ENUM('completed', 'pending', 'failed') DEFAULT 'completed',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_transactions_user_id (user_id),
    INDEX idx_transactions_created_at (created_at)
);

-- 7. جدول درخواست اعتبار
CREATE TABLE IF NOT EXISTS credit_requests (
    id VARCHAR(255) PRIMARY KEY,
    driver_id VARCHAR(255),
    amount DECIMAL(12,2) NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    FOREIGN KEY (driver_id) REFERENCES users(id),
    INDEX idx_credit_requests_driver_id (driver_id),
    INDEX idx_credit_requests_status (status)
);

-- 8. جدول درخواست برداشت
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id VARCHAR(255) PRIMARY KEY,
    driver_id VARCHAR(255),
    amount DECIMAL(12,2) NOT NULL,
    method VARCHAR(100) NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    account_details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    FOREIGN KEY (driver_id) REFERENCES users(id),
    INDEX idx_withdrawal_requests_driver_id (driver_id),
    INDEX idx_withdrawal_requests_status (status)
);

-- 9. جدول پیامها
CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(255) PRIMARY KEY,
    ride_id VARCHAR(255),
    sender_id VARCHAR(255),
    recipient_id VARCHAR(255),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_chat_ride_id (ride_id),
    INDEX idx_chat_sender_recipient (sender_id, recipient_id)
);

-- 10. جدول تنظیمات ادمین
CREATE TABLE IF NOT EXISTS admin_settings (
    id INT PRIMARY KEY DEFAULT 1,
    settings JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 11. جدول اعلانات
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_notifications_user_id (user_id)
);

-- 12. جدول لاگ ادمین
CREATE TABLE IF NOT EXISTS admin_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(255),
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_admin_logs_admin_id (admin_id),
    INDEX idx_admin_logs_action (action),
    INDEX idx_admin_logs_created_at (created_at)
);

-- 13. جداول اضافی برای ویژگیهای پیشرفته
CREATE TABLE IF NOT EXISTS hotels (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    rating DECIMAL(3,2) DEFAULT 0.0,
    price_range VARCHAR(50),
    lat DECIMAL(10,8) NOT NULL,
    lng DECIMAL(11,8) NOT NULL,
    image TEXT,
    commission DECIMAL(5,2) DEFAULT 5.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promo_codes (
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
);

CREATE TABLE IF NOT EXISTS referrals (
    id VARCHAR(255) PRIMARY KEY,
    referrer_id VARCHAR(255),
    referred_user_id VARCHAR(255),
    status ENUM('pending', 'completed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (referrer_id) REFERENCES users(id),
    FOREIGN KEY (referred_user_id) REFERENCES users(id)
);

-- درج انواع تاکسی پیشفرض
INSERT INTO taxi_types (id, name_fa, name_en, description_fa, description_en, base_fare, per_km_rate, color, image_path, features) VALUES
('eco', 'اقتصادی', 'Economy', 'سفرهای مقرون به صرفه برای روزمره', 'Affordable rides for everyday trips', 30000, 5000, '#10B981', '/img/map-icons/eco.svg', '["خودروی استاندارد", "تهویه مطبوع", "سفر امن"]'),
('plus', 'پلاس', 'Plus', 'راحتی بیشتر با خودروهای بهتر', 'More comfort with better vehicles', 45000, 7000, '#3B82F6', '/img/map-icons/plus.svg', '["خودروی جدیدتر", "تهویه پریمیوم", "شارژر موبایل"]'),
('lux', 'لوکس', 'Luxury', 'خودروهای پریمیوم برای مناسبات خاص', 'Premium vehicles for special occasions', 70000, 10000, '#8B5CF6', '/img/map-icons/lux.svg', '["خودروی لوکس", "صندلی چرمی", "وای فای", "آب"]'),
('premium', 'پریمیوم', 'Premium', 'سرویس درجه یک با رانندگان باتجربه', 'Top-tier service with experienced drivers', 100000, 15000, '#F59E0B', '/img/map-icons/premium.svg', '["خودروی پریمیوم", "سرویس VIP", "نوشیدنی", "پشتیبانی اولویت"]')
ON DUPLICATE KEY UPDATE
name_fa = VALUES(name_fa),
name_en = VALUES(name_en),
updated_at = CURRENT_TIMESTAMP;

-- درج تنظیمات سیستم پیشفرض
INSERT INTO system_settings (id) VALUES (1) ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- درج کاربران نمونه
INSERT INTO users (id, name, phone, password_hash, role, balance, rating, total_trips) VALUES
('u0', 'Admin User', '+10000000000', '$2b$10$8K1p/a0dqaillc9ZisYjem4KJnaRLRE9WAy2m5L3nEcCqQyyhQBJG', 'admin', 1000000, 5.0, 0),
('u1', 'Ahmad Khan', '+10000000001', '$2b$10$8K1p/a0dqaillc9ZisYjem4KJnaRLRE9WAy2m5L3nEcCqQyyhQBJG', 'driver', 5000, 4.8, 150),
('u2', 'Sara Ahmadi', '+10000000002', '$2b$10$8K1p/a0dqaillc9ZisYjem4KJnaRLRE9WAy2m5L3nEcCqQyyhQBJG', 'rider', 2000, 4.9, 75),
('u3', 'Mohammad Ali', '+10000000003', '$2b$10$8K1p/a0dqaillc9ZisYjem4KJnaRLRE9WAy2m5L3nEcCqQyyhQBJG', 'driver', 3500, 4.7, 120),
('u4', 'Hassan Ahmadi', '+10000000004', '$2b$10$8K1p/a0dqaillc9ZisYjem4KJnaRLRE9WAy2m5L3nEcCqQyyhQBJG', 'driver', 4200, 4.9, 200)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- درج رانندگان نمونه
INSERT INTO drivers (id, vehicle_make, vehicle_model, vehicle_plate, vehicle_type, taxi_type_id, status, current_lat, current_lng, base_fare, per_km_rate, earnings) VALUES
('u1', 'Toyota', 'Corolla', 'KBL-1234', 'eco', 'eco', 'available', 34.5333, 69.1667, 50, 20, 25000),
('u3', 'Honda', 'Civic', 'HRT-5678', 'plus', 'plus', 'available', 34.5400, 69.1700, 60, 25, 18000),
('u4', 'Hyundai', 'Elantra', 'KDH-9012', 'eco', 'eco', 'available', 34.5280, 69.1620, 50, 20, 32000)
ON DUPLICATE KEY UPDATE last_updated = CURRENT_TIMESTAMP;

-- درج تنظیمات ادمین پیشفرض
INSERT INTO admin_settings (id, settings) VALUES (1, '{
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
}') ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- درج هتلهای نمونه
INSERT INTO hotels (id, name, address, rating, price_range, lat, lng, image) VALUES
('h1', 'Kabul Serena Hotel', 'Froshgah Street, Kabul', 4.5, '$$$', 34.5167, 69.1833, 'https://images.unsplash.com/photo-1566073771259-6a8506099945'),
('h2', 'InterContinental Kabul', 'Bagh-e Bala, Kabul', 4.2, '$$$$', 34.5333, 69.1667, 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ایجاد view برای اطلاعات کامل رانندگان
CREATE OR REPLACE VIEW driver_details AS
SELECT 
    d.*,
    u.name,
    u.phone,
    u.rating,
    u.total_trips,
    u.balance,
    u.status as user_status,
    tt.name_fa as taxi_type_name_fa,
    tt.name_en as taxi_type_name_en,
    tt.color as taxi_type_color,
    tt.image_path as taxi_type_image,
    tt.base_fare as taxi_type_base_fare,
    tt.per_km_rate as taxi_type_per_km_rate
FROM drivers d
JOIN users u ON d.id = u.id
LEFT JOIN taxi_types tt ON d.taxi_type_id = tt.id
WHERE u.role = 'driver';

-- تنظیم triggers برای بروزرسانی خودکار
DELIMITER //
CREATE TRIGGER IF NOT EXISTS update_taxi_types_timestamp 
    BEFORE UPDATE ON taxi_types
    FOR EACH ROW 
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END//

CREATE TRIGGER IF NOT EXISTS update_system_settings_timestamp 
    BEFORE UPDATE ON system_settings
    FOR EACH ROW 
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END//

CREATE TRIGGER IF NOT EXISTS update_drivers_earnings
    AFTER UPDATE ON rides
    FOR EACH ROW
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE drivers 
        SET earnings = earnings + (NEW.fare * 0.8)
        WHERE id = NEW.driver_id;
    END IF;
END//
DELIMITER ;

-- بروزرسانی taxi_type_id برای رانندگان موجود
UPDATE drivers d
JOIN users u ON d.id = u.id
SET d.taxi_type_id = CASE 
    WHEN u.rating >= 4.8 AND u.total_trips >= 1000 THEN 'premium'
    WHEN u.rating >= 4.5 AND u.total_trips >= 500 THEN 'lux'
    WHEN u.rating >= 4.0 AND u.total_trips >= 100 THEN 'plus'
    ELSE 'eco'
END
WHERE d.taxi_type_id = 'eco' OR d.taxi_type_id IS NULL;

-- تایید موفقیتآمیز اجرای اسکریپت
SELECT 'Database synchronization completed successfully!' as status,
       COUNT(*) as total_tables
FROM information_schema.tables 
WHERE table_schema = DATABASE();

-- نمایش خلاصه جداول ایجاد شده
SELECT 
    table_name as 'Table Name',
    table_rows as 'Rows',
    ROUND(((data_length + index_length) / 1024 / 1024), 2) as 'Size (MB)'
FROM information_schema.tables 
WHERE table_schema = DATABASE()
ORDER BY table_name;
