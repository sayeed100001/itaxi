-- Migration: Add background_checks table and KYC fields to drivers

-- Background Checks Table (KYC Documents)
CREATE TABLE IF NOT EXISTS background_checks (
    id VARCHAR(36) PRIMARY KEY,
    driver_id VARCHAR(36) NOT NULL,
    national_id TEXT,
    driving_license TEXT,
    criminal_record TEXT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    reviewed_by VARCHAR(36),
    rejection_reason TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL,
    FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_driver (driver_id),
    INDEX idx_status (status),
    INDEX idx_submitted (submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add KYC fields to drivers table if they don't exist
ALTER TABLE drivers 
ADD COLUMN IF NOT EXISTS kyc_status ENUM('unverified', 'pending', 'approved', 'rejected') DEFAULT 'unverified',
ADD COLUMN IF NOT EXISTS kyc_updated_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS background_check_status ENUM('pending', 'approved', 'rejected') DEFAULT NULL,
ADD COLUMN IF NOT EXISTS background_check_date TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS driver_level ENUM('basic', 'standard', 'special', 'premium', 'vip') DEFAULT 'basic',
ADD COLUMN IF NOT EXISTS taxi_type_id VARCHAR(50) DEFAULT 'eco',
ADD COLUMN IF NOT EXISTS service_types JSON DEFAULT NULL,
ADD COLUMN IF NOT EXISTS earnings DECIMAL(12,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_drivers_kyc_status ON drivers(kyc_status);
CREATE INDEX IF NOT EXISTS idx_drivers_taxi_type ON drivers(taxi_type_id);
CREATE INDEX IF NOT EXISTS idx_drivers_level ON drivers(driver_level);

-- Taxi Types Table
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
    icon_size JSON DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Default Taxi Types
INSERT INTO taxi_types (id, name_fa, name_en, description_fa, description_en, base_fare, per_km_rate, color, image_path, features) VALUES
('eco', 'اقتصادی', 'Economy', 'سفرهای مقرون به صرفه برای روزمره', 'Affordable rides for everyday trips', 30000, 5000, '#10B981', '/img/map-icons/eco.svg', '["خودروی استاندارد", "تهویه مطبوع", "سفر امن"]'),
('plus', 'پلاس', 'Plus', 'راحتی بیشتر با خودروهای بهتر', 'More comfort with better vehicles', 45000, 7000, '#3B82F6', '/img/map-icons/plus.svg', '["خودروی جدیدتر", "تهویه پریمیوم", "شارژر موبایل"]'),
('lux', 'لوکس', 'Luxury', 'خودروهای پریمیوم برای مناسبات خاص', 'Premium vehicles for special occasions', 70000, 10000, '#8B5CF6', '/img/map-icons/lux.svg', '["خودروی لوکس", "صندلی چرمی", "وای فای", "آب"]'),
('premium', 'پریمیوم', 'Premium', 'سرویس درجه یک با رانندگان باتجربه', 'Top-tier service with experienced drivers', 100000, 15000, '#F59E0B', '/img/map-icons/premium.svg', '["خودروی پریمیوم", "سرویس VIP", "نوشیدنی", "پشتیبانی اولویت"]')
ON DUPLICATE KEY UPDATE name_fa=VALUES(name_fa);

-- Driver Credit System Tables
CREATE TABLE IF NOT EXISTS driver_credit_accounts (
    driver_id VARCHAR(36) PRIMARY KEY,
    balance DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_balance (balance)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS driver_credit_ledger (
    id VARCHAR(36) PRIMARY KEY,
    driver_id VARCHAR(36) NOT NULL,
    ride_id VARCHAR(36),
    amount DECIMAL(12,2) NOT NULL,
    entry_type ENUM('admin_credit', 'adjustment', 'refund', 'ride_commission', 'ride_fee') NOT NULL,
    description TEXT,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_driver (driver_id),
    INDEX idx_ride (ride_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS system_revenue_ledger (
    id VARCHAR(36) PRIMARY KEY,
    ride_id VARCHAR(36),
    driver_id VARCHAR(36),
    amount DECIMAL(12,2) NOT NULL,
    revenue_type ENUM('commission', 'fee', 'other') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_ride (ride_id),
    INDEX idx_driver (driver_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Admin Logs Table
CREATE TABLE IF NOT EXISTS admin_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id VARCHAR(36) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(36),
    old_values TEXT,
    new_values TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_admin (admin_id),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    id INT PRIMARY KEY DEFAULT 1,
    map_provider VARCHAR(20) DEFAULT 'osm',
    default_zoom INT DEFAULT 15,
    default_center_lat DECIMAL(10,8) DEFAULT 34.5553,
    default_center_lng DECIMAL(11,8) DEFAULT 69.2075,
    primary_color VARCHAR(7) DEFAULT '#3B82F6',
    secondary_color VARCHAR(7) DEFAULT '#10B981',
    features JSON,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add status column to users if not exists
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS status ENUM('active', 'suspended', 'banned') DEFAULT 'active',
ADD COLUMN IF NOT EXISTS email VARCHAR(255) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Add taxi_type_id to rides table
ALTER TABLE rides 
ADD COLUMN IF NOT EXISTS taxi_type_id VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_rides_taxi_type ON rides(taxi_type_id);
