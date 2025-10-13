const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking equipment table...\n');

db.all("SELECT id, name, serial_number, barcode, category_id, manufacturer, model FROM equipment LIMIT 10", (err, rows) => {
    if (err) {
        console.error('Error querying equipment:', err);
        db.close();
        return;
    }

    if (rows.length === 0) {
        console.log('No equipment found in database.');
    } else {
        console.log(`Found ${rows.length} equipment items:\n`);
        rows.forEach(row => {
            console.log(`ID: ${row.id}`);
            console.log(`  Name: ${row.name}`);
            console.log(`  Serial: ${row.serial_number || 'NULL'}`);
            console.log(`  Barcode: ${row.barcode || 'NULL'}`);
            console.log(`  Category ID: ${row.category_id || 'NULL'}`);
            console.log(`  Manufacturer: ${row.manufacturer || 'NULL'}`);
            console.log(`  Model: ${row.model || 'NULL'}`);
            console.log('---');
        });
    }

    // Check categories
    db.all("SELECT id, name FROM categories", (err, categories) => {
        if (err) {
            console.error('Error querying categories:', err);
        } else {
            console.log(`\nCategories in database:`);
            categories.forEach(cat => {
                console.log(`  - ${cat.id}: ${cat.name}`);
            });
        }
        db.close();
    });
});
