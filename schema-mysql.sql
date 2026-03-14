-- iTaxi MySQL Schema

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
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
    status ENUM('active', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone (phone),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS drivers (
    id VARCHAR(36) PRIMARY KEY,
    vehicle_make VARCHAR(100),
    vehicle_model VARCHAR(100),
    vehicle_plate VARCHAR(50),
    vehicle_type ENUM('eco', 'plus', 'lux'),
    status ENUM('available', 'busy', 'offline', 'suspended') DEFAULT 'offline',
    current_lat DECIMAL(10,8),
    current_lng DECIMAL(11,8),
    h3_index VARCHAR(20),
    bearing DECIMAL(5,2) DEFAULT 0,
    base_fare DECIMAL(10,2) DEFAULT 50.0,
    per_km_rate DECIMAL(10,2) DEFAULT 20.0,
    is_active BOOLEAN DEFAULT true,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_status (status),
    INDEX idx_location (current_lat, current_lng),
    INDEX idx_h3 (h3_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rides (
    id VARCHAR(36) PRIMARY KEY,
    rider_id VARCHAR(36),
    driver_id VARCHAR(36),
    pickup_address TEXT NOT NULL,
    pickup_lat DECIMAL(10,8) NOT NULL,
    pickup_lng DECIMAL(11,8) NOT NULL,
    dropoff_address TEXT NOT NULL,
    dropoff_lat DECIMAL(10,8) NOT NULL,
    dropoff_lng DECIMAL(11,8) NOT NULL,
    fare DECIMAL(10,2) NOT NULL,
    proposed_fare DECIMAL(10,2),
    status ENUM('searching', 'negotiating', 'requested', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled') DEFAULT 'searching',
    service_type VARCHAR(50) NOT NULL,
    distance DECIMAL(10,2),
    duration INT,
    scheduled_time TIMESTAMP NULL,
    rider_rating INT CHECK (rider_rating >= 1 AND rider_rating <= 5),
    driver_rating INT CHECK (driver_rating >= 1 AND driver_rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (rider_id) REFERENCES users(id),
    FOREIGN KEY (driver_id) REFERENCES users(id),
    INDEX idx_rider (rider_id),
    INDEX idx_driver (driver_id),
    INDEX idx_status (status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    amount DECIMAL(12,2) NOT NULL,
    type ENUM('credit', 'debit') NOT NULL,
    status ENUM('completed', 'pending', 'failed') DEFAULT 'completed',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user (user_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id VARCHAR(36) PRIMARY KEY,
    driver_id VARCHAR(36),
    amount DECIMAL(12,2) NOT NULL,
    method VARCHAR(50) NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    account_details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    FOREIGN KEY (driver_id) REFERENCES users(id),
    INDEX idx_driver (driver_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS credit_requests (
    id VARCHAR(36) PRIMARY KEY,
    driver_id VARCHAR(36),
    amount DECIMAL(12,2) NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    FOREIGN KEY (driver_id) REFERENCES users(id),
    INDEX idx_driver (driver_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user (user_id),
    INDEX idx_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(36) PRIMARY KEY,
    ride_id VARCHAR(36),
    sender_id VARCHAR(36),
    recipient_id VARCHAR(36),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ride (ride_id),
    INDEX idx_sender_recipient (sender_id, recipient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_settings (
    id INT PRIMARY KEY DEFAULT 1,
    settings JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default admin user (Password: admin123)
INSERT INTO users (id, name, phone, password_hash, role, balance)
VALUES ('admin-001', 'Admin User', '+93000000000', '$2b$10$YourHashedPasswordHere', 'admin', 1000000)
ON DUPLICATE KEY UPDATE name=name;

-- Insert default settings
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
ON DUPLICATE KEY UPDATE settings=settings;
