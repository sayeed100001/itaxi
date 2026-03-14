-- اضافه کردن جداول مفقود به schema

-- جدول انواع تاکسی
CREATE TABLE IF NOT EXISTS taxi_types (
    id TEXT PRIMARY KEY,
    name_fa TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description_fa TEXT,
    description_en TEXT,
    base_fare DECIMAL(10,2) NOT NULL,
    per_km_rate DECIMAL(10,2) NOT NULL,
    color TEXT NOT NULL,
    image_path TEXT,
    features TEXT, -- JSON array
    min_rating DECIMAL(3,2),
    min_rides INTEGER,
    icon_size TEXT, -- JSON array [width, height]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- داده های پیش فرض انواع تاکسی
INSERT INTO taxi_types (id, name_fa, name_en, description_fa, description_en, base_fare, per_km_rate, color, image_path, features, icon_size)
VALUES 
('eco', 'اقتصادی', 'Economy', 'سفرهای مقرون به صرفه برای روزمره', 'Affordable rides for everyday trips', 30000, 5000, '#10B981', '/img/map-icons/eco.svg', '["خودروی استاندارد", "تهویه مطبوع", "سفر امن"]', '[40, 40]'),
('plus', 'پلاس', 'Plus', 'راحتی بیشتر با خودروهای بهتر', 'More comfort with better vehicles', 45000, 7000, '#3B82F6', '/img/map-icons/plus.svg', '["خودروی جدیدتر", "تهویه پریمیوم", "شارژر موبایل"]', '[45, 45]'),
('lux', 'لوکس', 'Luxury', 'خودروهای پریمیوم برای مناسبات خاص', 'Premium vehicles for special occasions', 70000, 10000, '#8B5CF6', '/img/map-icons/lux.svg', '["خودروی لوکس", "صندلی چرمی", "وای فای", "آب"]', '[50, 50]'),
('premium', 'پریمیوم', 'Premium', 'سرویس درجه یک با رانندگان باتجربه', 'Top-tier service with experienced drivers', 100000, 15000, '#F59E0B', '/img/map-icons/premium.svg', '["خودروی پریمیوم", "سرویس VIP", "نوشیدنی", "پشتیبانی اولویت"]', '[55, 55]')
ON CONFLICT (id) DO NOTHING;

-- جدول تنظیمات سیستم (structured)
CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    map_provider TEXT DEFAULT 'osm',
    map_default_zoom INTEGER DEFAULT 15,
    map_default_lat DECIMAL(10,8) DEFAULT 34.5553,
    map_default_lng DECIMAL(11,8) DEFAULT 69.2075,
    ui_theme TEXT DEFAULT 'dark',
    ui_primary_color TEXT DEFAULT '#3B82F6',
    ui_secondary_color TEXT DEFAULT '#10B981',
    feature_real_time_tracking BOOLEAN DEFAULT true,
    feature_chat_system BOOLEAN DEFAULT true,
    feature_payment_gateway BOOLEAN DEFAULT false,
    feature_notifications BOOLEAN DEFAULT true,
    feature_analytics BOOLEAN DEFAULT true,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- داده پیش فرض
INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- جدول لاگ تغییرات ادمین
CREATE TABLE IF NOT EXISTS admin_logs (
    id TEXT PRIMARY KEY,
    admin_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    target_type TEXT, -- 'taxi_type', 'driver', 'settings', etc.
    target_id TEXT,
    old_values TEXT, -- JSON
    new_values TEXT, -- JSON
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at);
