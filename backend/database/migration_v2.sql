-- Migration V2: Add PIN Auth, Activity Logging, and Enhanced Fields
-- Run this after init.sql to upgrade the database schema

-- Add PIN code to users table (hashed with bcrypt)
ALTER TABLE users ADD COLUMN pin_code VARCHAR(255);

-- Create activity_log table for tracking all changes
CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'checkout', 'checkin'
    entity_type VARCHAR(50) NOT NULL, -- 'equipment', 'user', 'transaction'
    entity_id INTEGER,
    changes_json TEXT, -- JSON string of what changed
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Add new fields to equipment table
ALTER TABLE equipment ADD COLUMN status VARCHAR(30) DEFAULT 'available';
-- 'in_use', 'out_for_maintenance', 'decommissioned', 'reserved', 'needs_maintenance', 'available'

ALTER TABLE equipment ADD COLUMN included_in_kit BOOLEAN DEFAULT 0;

-- Add location to transactions table
ALTER TABLE transactions ADD COLUMN location VARCHAR(50);
-- 'studio', 'vault', 'user'

-- Create index for activity logs
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);

-- Update equipment view to include new status field
DROP VIEW IF EXISTS equipment_status;
CREATE VIEW equipment_status AS
SELECT
    e.id,
    e.name,
    e.serial_number,
    e.barcode,
    e.model,
    e.manufacturer,
    c.name as category_name,
    c.color as category_color,
    e.condition,
    e.status as equipment_status,
    e.location as equipment_location,
    e.included_in_kit,
    CASE
        WHEN t.equipment_id IS NULL THEN 'available'
        WHEN t.transaction_type = 'checkout' AND t.actual_return_date IS NULL THEN 'checked_out'
        WHEN t.transaction_type = 'maintenance' AND t.actual_return_date IS NULL THEN 'maintenance'
        ELSE 'available'
    END as transaction_status,
    t.user_id as checked_out_by,
    u.full_name as checked_out_by_name,
    t.checkout_date,
    t.expected_return_date,
    t.location as transaction_location,
    CASE
        WHEN t.expected_return_date < DATE('now') AND t.actual_return_date IS NULL THEN 1
        ELSE 0
    END as is_overdue,
    e.image_path,
    e.qr_code
FROM equipment e
LEFT JOIN categories c ON e.category_id = c.id
LEFT JOIN (
    SELECT DISTINCT
        t1.equipment_id,
        t1.user_id,
        t1.transaction_type,
        t1.checkout_date,
        t1.expected_return_date,
        t1.actual_return_date,
        t1.location
    FROM transactions t1
    WHERE t1.id = (
        SELECT MAX(t2.id)
        FROM transactions t2
        WHERE t2.equipment_id = t1.equipment_id
        AND t2.actual_return_date IS NULL
    )
) t ON e.id = t.equipment_id
LEFT JOIN users u ON t.user_id = u.id
WHERE e.is_active = 1;

-- Insert comment explaining new condition values
-- New condition values: 'out_of_commission', 'out_for_repair', 'brand_new', 'functional', 'worn', 'normal', 'decommissioned', 'broken'
-- Old values: 'excellent', 'good', 'fair', 'poor', 'damaged', 'decommissioned'

-- Set default PIN for existing admin user (PIN: 123456, hashed)
-- $2a$10$xCzPEpqOl8eE7JYXx3fXs.cT7kJKzSoXWqY9cJL8bqxH8nzULvZ6K
UPDATE users
SET pin_code = '$2a$10$xCzPEpqOl8eE7JYXx3fXs.cT7kJKzSoXWqY9cJL8bqxH8nzULvZ6K'
WHERE username = 'admin';

-- Log this migration
INSERT INTO activity_log (user_id, action, entity_type, entity_id, changes_json)
VALUES (1, 'migration', 'system', NULL, '{"version": "v2", "description": "Added PIN auth, activity logging, and equipment enhancements"}');
