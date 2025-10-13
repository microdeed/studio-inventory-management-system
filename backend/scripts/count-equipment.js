const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/inventory.db');
const db = new sqlite3.Database(dbPath);

db.all(`
    SELECT
        COUNT(*) as total,
        COUNT(serial_number) as with_serial,
        COUNT(barcode) as with_barcode,
        COUNT(category_id) as with_category
    FROM equipment
    WHERE is_active = 1
`, (err, rows) => {
    if (err) {
        console.error('Error:', err);
    } else {
        const stats = rows[0];
        console.log('Equipment Statistics:');
        console.log(`  Total Items: ${stats.total}`);
        console.log(`  With Serial Numbers: ${stats.with_serial}`);
        console.log(`  With Barcodes: ${stats.with_barcode}`);
        console.log(`  With Categories: ${stats.with_category}`);
    }

    // Show category breakdown
    db.all(`
        SELECT c.name, COUNT(*) as count
        FROM equipment e
        LEFT JOIN categories c ON e.category_id = c.id
        WHERE e.is_active = 1
        GROUP BY c.name
        ORDER BY count DESC
    `, (err, rows) => {
        if (err) {
            console.error('Error:', err);
        } else {
            console.log('\nEquipment by Category:');
            rows.forEach(row => {
                console.log(`  ${row.name || 'No Category'}: ${row.count}`);
            });
        }
        db.close();
    });
});
