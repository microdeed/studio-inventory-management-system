-- Migration V3: Add Purpose Field to Checkout/Reservation Transactions
-- Run this after migration_v2.sql to upgrade the database schema

-- Add purpose column to transactions table
ALTER TABLE transactions ADD COLUMN purpose VARCHAR(50);
-- Valid values: 'events', 'marketing', 'personal'
-- NULL allowed for existing transactions and non-checkout/reservation types

-- Note: SQLite doesn't support CHECK constraints via ALTER TABLE
-- Validation will be enforced at the application level in the API

-- Create index for filtering transactions by purpose
CREATE INDEX IF NOT EXISTS idx_transactions_purpose ON transactions(purpose);

-- Update equipment_status view to include purpose field
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
    t.purpose as transaction_purpose,
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
        t1.location,
        t1.purpose
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

-- Log this migration
INSERT INTO activity_log (user_id, action, entity_type, entity_id, changes_json)
VALUES (1, 'migration', 'system', NULL, '{"version": "v3", "description": "Added purpose field for checkout/reservation transactions"}');
