-- Studio Equipment Inventory Database Schema

-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'user', -- 'admin', 'user', 'manager'
    phone VARCHAR(20),
    department VARCHAR(50),
    pin_code VARCHAR(100), -- Hashed PIN code for quick login
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1
);

-- Equipment categories
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7), -- hex color code for UI
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Equipment table
CREATE TABLE equipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100) UNIQUE,
    barcode VARCHAR(100),
    model VARCHAR(100),
    manufacturer VARCHAR(100),
    category_id INTEGER,
    purchase_date DATE,
    purchase_price DECIMAL(10,2),
    current_value DECIMAL(10,2),
    condition VARCHAR(20) DEFAULT 'good', -- 'excellent', 'good', 'fair', 'poor', 'damaged', 'decommissioned'
    location VARCHAR(100),
    description TEXT,
    notes TEXT,
    image_path VARCHAR(255),
    qr_code VARCHAR(100),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Equipment transactions (check-in/check-out history)
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    transaction_type VARCHAR(20) NOT NULL, -- 'checkout', 'checkin', 'reservation', 'maintenance'
    checkout_date DATETIME,
    expected_return_date DATETIME,
    actual_return_date DATETIME,
    condition_on_checkout VARCHAR(20),
    condition_on_return VARCHAR(20),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Maintenance records
CREATE TABLE maintenance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER NOT NULL,
    maintenance_type VARCHAR(50) NOT NULL, -- 'routine', 'repair', 'calibration', 'upgrade'
    description TEXT,
    cost DECIMAL(10,2),
    performed_by VARCHAR(100),
    performed_date DATE,
    next_maintenance_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Damage reports
CREATE TABLE damage_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER NOT NULL,
    reported_by INTEGER NOT NULL,
    damage_description TEXT NOT NULL,
    damage_severity VARCHAR(20) DEFAULT 'minor', -- 'minor', 'moderate', 'severe', 'total_loss'
    estimated_repair_cost DECIMAL(10,2),
    repair_status VARCHAR(20) DEFAULT 'reported', -- 'reported', 'assessed', 'approved', 'in_repair', 'completed'
    image_paths TEXT, -- JSON array of image paths
    reported_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_date DATETIME,
    notes TEXT,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id),
    FOREIGN KEY (reported_by) REFERENCES users(id)
);

-- Insert default categories
INSERT INTO categories (name, description, color) VALUES
('Audio', 'Microphones, speakers, audio interfaces', '#FF6B6B'),
('Video', 'Cameras, lenses, tripods, lighting', '#4ECDC4'),
('Computing', 'Laptops, tablets, hard drives', '#45B7D1'),
('Cables', 'Audio/video cables and adapters', '#96CEB4'),
('Lighting', 'Studio lights, stands, modifiers', '#FFEAA7'),
('Accessories', 'Cases, batteries, memory cards', '#DDA0DD'),
('Furniture', 'Stands, racks, desks', '#98D8C8');

-- Insert default admin user
INSERT INTO users (username, email, full_name, role, department) VALUES
('admin', 'admin@studio.com', 'System Administrator', 'admin', 'IT');

-- Create indexes for better performance
CREATE INDEX idx_equipment_serial ON equipment(serial_number);
CREATE INDEX idx_equipment_barcode ON equipment(barcode);
CREATE INDEX idx_equipment_category ON equipment(category_id);
CREATE INDEX idx_equipment_active ON equipment(is_active);
CREATE INDEX idx_transactions_equipment ON transactions(equipment_id);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_dates ON transactions(checkout_date, actual_return_date);