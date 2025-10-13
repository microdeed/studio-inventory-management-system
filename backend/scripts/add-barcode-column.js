const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('Adding barcode column to equipment table...');

db.serialize(() => {
    // Check if column already exists
    db.all("PRAGMA table_info(equipment)", (err, columns) => {
        if (err) {
            console.error('Error checking table schema:', err);
            db.close();
            return;
        }

        const hasBarcode = columns.some(col => col.name === 'barcode');

        if (hasBarcode) {
            console.log('✓ Barcode column already exists!');
            db.close();
            return;
        }

        // Add barcode column
        db.run(`ALTER TABLE equipment ADD COLUMN barcode VARCHAR(100)`, (err) => {
            if (err) {
                console.error('Error adding barcode column:', err);
                db.close();
                return;
            }

            console.log('✓ Barcode column added successfully!');

            // Add index on barcode
            db.run(`CREATE INDEX IF NOT EXISTS idx_equipment_barcode ON equipment(barcode)`, (err) => {
                if (err) {
                    console.error('Error creating barcode index:', err);
                } else {
                    console.log('✓ Barcode index created successfully!');
                }

                // Verify the column was added
                db.all("PRAGMA table_info(equipment)", (err, columns) => {
                    if (err) {
                        console.error('Error verifying schema:', err);
                    } else {
                        console.log('\nCurrent equipment table columns:');
                        columns.forEach(col => {
                            console.log(`  - ${col.name} (${col.type})`);
                        });
                    }
                    db.close();
                });
            });
        });
    });
});
