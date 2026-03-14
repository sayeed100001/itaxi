-- حل مشکلات حیاتی دیتابیس iTaxi

-- 1. ایجاد جدول taxi_types مفقود
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
    icon_size JSON DEFAULT '{"width": 40, "height": 40}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. درج انواع تاکسی پیش‌فرض
INSERT INTO taxi_types (id, name_fa, name_en, description_fa, description_en, base_fare, per_km_rate, color, image_path, features) VALUES
('eco', 'اقتصادی', 'Economy', 'سفرهای مقرون به صرفه برای روزمره', 'Affordable rides for everyday trips', 30000, 5000, '#10B981', '/img/map-icons/eco.svg', '["خودروی استاندارد", "تهویه مطبوع", "سفر امن"]'),
('plus', 'پلاس', 'Plus', 'راحتی بیشتر با خودروهای بهتر', 'More comfort with better vehicles', 45000, 7000, '#3B82F6', '/img/map-icons/plus.svg', '["خودروی جدیدتر", "تهویه پریمیوم", "شارژر موبایل"]'),
('lux', 'لوکس', 'Luxury', 'خودروهای پریمیوم برای مناسبات خاص', 'Premium vehicles for special occasions', 70000, 10000, '#8B5CF6', '/img/map-icons/lux.svg', '["خودروی لوکس", "صندلی چرمی", "وای فای", "آب"]'),
('premium', 'پریمیوم', 'Premium', 'سرویس درجه یک با رانندگان باتجربه', 'Top-tier service with experienced drivers', 100000, 15000, '#F59E0B', '/img/map-icons/premium.svg', '["خودروی پریمیوم", "سرویس VIP", "نوشیدنی", "پشتیبانی اولویت"]')
ON DUPLICATE KEY UPDATE
name_fa = VALUES(name_fa),
name_en = VALUES(name_en),
updated_at = CURRENT_TIMESTAMP;

-- 3. ایجاد جدول system_settings برای تنظیمات سیستم
CREATE TABLE IF NOT EXISTS system_settings (
    id INT PRIMARY KEY DEFAULT 1,
    map_provider VARCHAR(50) DEFAULT 'osm',
    default_zoom INT DEFAULT 15,
    default_center_lat DECIMAL(10,8) DEFAULT 34.5553,
    default_center_lng DECIMAL(11,8) DEFAULT 69.2075,
    primary_color VARCHAR(7) DEFAULT '#3B82F6',
    secondary_color VARCHAR(7) DEFAULT '#10B981',
    features JSON DEFAULT '{"realTimeTracking": true, "chatSystem": true, "paymentGateway": false, "notifications": true, "analytics": true}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- درج تنظیمات پیش‌فرض
INSERT INTO system_settings (id) VALUES (1) ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- 4. اضافه کردن فیلدهای مفقود به جدول drivers
ALTER TABLE drivers 
ADD COLUMN IF NOT EXISTS taxi_type_id VARCHAR(50) DEFAULT 'eco',
ADD COLUMN IF NOT EXISTS service_types JSON DEFAULT '["city", "airport"]',
ADD COLUMN IF NOT EXISTS earnings DECIMAL(12,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 5. ایجاد foreign key برای taxi_type_id
ALTER TABLE drivers 
ADD CONSTRAINT fk_drivers_taxi_type 
FOREIGN KEY (taxi_type_id) REFERENCES taxi_types(id) 
ON UPDATE CASCADE ON DELETE SET NULL;

-- 6. ایجاد جدول admin_logs برای ردیابی تغییرات
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

-- 7. بروزرسانی رانندگان موجود با taxi_type مناسب
UPDATE drivers d
JOIN users u ON d.id = u.id
SET d.taxi_type_id = CASE 
    WHEN u.rating >= 4.8 AND u.total_trips >= 1000 THEN 'premium'
    WHEN u.rating >= 4.5 AND u.total_trips >= 500 THEN 'lux'
    WHEN u.rating >= 4.0 AND u.total_trips >= 100 THEN 'plus'
    ELSE 'eco'
END
WHERE d.taxi_type_id = 'eco';

-- 8. ایجاد indexes برای بهبود عملکرد
CREATE INDEX IF NOT EXISTS idx_taxi_types_active ON taxi_types(is_active);
CREATE INDEX IF NOT EXISTS idx_drivers_taxi_type ON drivers(taxi_type_id);
CREATE INDEX IF NOT EXISTS idx_drivers_earnings ON drivers(earnings);

-- 9. ایجاد view برای اطلاعات کامل رانندگان
CREATE OR REPLACE VIEW driver_details AS
SELECT 
    d.*,
    u.name,
    u.phone,
    u.rating,
    u.total_trips,
    u.balance,
    tt.name_fa as taxi_type_name_fa,
    tt.name_en as taxi_type_name_en,
    tt.color as taxi_type_color,
    tt.image_path as taxi_type_image
FROM drivers d
JOIN users u ON d.id = u.id
LEFT JOIN taxi_types tt ON d.taxi_type_id = tt.id
WHERE u.role = 'driver';

-- 10. تنظیم triggers برای بروزرسانی خودکار
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
DELIMITER ;

-- تایید موفقیت‌آمیز اجرای اسکریپت
SELECT 'Database fixes applied successfully!' as status;
