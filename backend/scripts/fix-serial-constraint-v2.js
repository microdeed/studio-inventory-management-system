const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('Fixing serial_number UNIQUE constraint...\n');

db.serialize(() => {
    // Drop view first
    db.run('DROP VIEW IF EXISTS equipment_status', (err) => {
        if (err) {
            console.error('Error dropping view:', err);
            db.close();
            return;
        }
        console.log('✓ Dropped equipment_status view');
    });

    // Create new table without UNIQUE constraint
    db.run(`
        CREATE TABLE equipment_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(100) NOT NULL,
            serial_number VARCHAR(100),
            barcode VARCHAR(100),
            model VARCHAR(100),
            manufacturer VARCHAR(100),
            category_id INTEGER,
            purchase_date DATE,
            purchase_price DECIMAL(10,2),
            current_value DECIMAL(10,2),
            condition VARCHAR(20) DEFAULT 'good',
            location VARCHAR(100),
            description TEXT,
            notes TEXT,
            image_path VARCHAR(255),
            qr_code VARCHAR(100),
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id)
        )
    `, (err) => {
        if (err) {
            console.error('Error creating new table:', err);
            db.close();
            return;
        }
        console.log('✓ Created new table');
    });

    // Copy data
    db.run('INSERT INTO equipment_new SELECT * FROM equipment', (err) => {
        if (err) {
            console.error('Error copying data:', err);
            db.close();
            return;
        }
        console.log('✓ Copied data');
    });

    // Drop old table
    db.run('DROP TABLE equipment', (err) => {
        if (err) {
            console.error('Error dropping old table:', err);
            db.close();
            return;
        }
        console.log('✓ Dropped old table');
    });

    // Rename new table
    db.run('ALTER TABLE equipment_new RENAME TO equipment', (err) => {
        if (err) {
            console.error('Error renaming table:', err);
            db.close();
            return;
        }
        console.log('✓ Renamed table');
    });

    // Create indexes
    db.run('CREATE INDEX idx_equipment_serial ON equipment(serial_number)');
    db.run('CREATE INDEX idx_equipment_barcode ON equipment(barcode)');
    db.run('CREATE INDEX idx_equipment_category ON equipment(category_id)');
    db.run('CREATE INDEX idx_equipment_active ON equipment(is_active)', (err) => {
        if (err) {
            console.error('Error creating indexes:', err);
        } else {
            console.log('✓ Created indexes');
        }
        console.log('\n✓ Done! Serial numbers no longer have UNIQUE constraint.\n');
        db.close();
    });
});
