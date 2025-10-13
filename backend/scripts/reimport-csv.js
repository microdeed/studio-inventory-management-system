const sqlite3 = require('sqlite3').verbose();
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../database/inventory.db');
const csvPath = path.join(__dirname, '../../data/Equipment Inventory (Incomplete).csv');

const db = new sqlite3.Database(dbPath);

console.log('Re-importing equipment from CSV...\n');

// Clear existing equipment
db.run('DELETE FROM equipment', (err) => {
    if (err) {
        console.error('Error clearing equipment:', err);
        db.close();
        return;
    }

    console.log('✓ Cleared existing equipment');

    const results = [];
    const errors = [];
    let lineNumber = 0;

    fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
            lineNumber++;

            // Skip empty rows or header rows
            if (!row['Name/Model'] || row['Name/Model'].trim() === '') {
                return;
            }

            const equipmentData = {
                name: row['Name/Model'] || row.Name || row.name,
                serial_number: row.Serial || row.serial_number || row['Serial Number'],
                barcode: row.Barcode || row.barcode,
                manufacturer: null, // Not in CSV
                model: null, // Not in CSV
                category_name: row.Type || row.type || row.Category,
                condition: row['Equipment Status'] || row.condition || 'good',
                notes: row['Item Notes'] || row.notes
            };

            // Normalize condition
            const conditionMap = {
                'brand new': 'excellent',
                'new': 'excellent',
                'normal': 'good',
                'excellent': 'excellent',
                'good': 'good',
                'fair': 'fair',
                'poor': 'poor',
                'damaged': 'damaged'
            };
            const normalizedCondition = equipmentData.condition ? equipmentData.condition.toLowerCase() : 'good';
            equipmentData.condition = conditionMap[normalizedCondition] || 'good';

            // Find or create category
            if (equipmentData.category_name) {
                db.get('SELECT id FROM categories WHERE name = ?', [equipmentData.category_name], (err, category) => {
                    let category_id = null;

                    if (err) {
                        errors.push(`Line ${lineNumber}: Error checking category: ${err.message}`);
                        return;
                    }

                    if (!category) {
                        // Create new category
                        db.run('INSERT INTO categories (name) VALUES (?)', [equipmentData.category_name], function(err) {
                            if (err) {
                                errors.push(`Line ${lineNumber}: Error creating category: ${err.message}`);
                                return;
                            }
                            category_id = this.lastID;
                            insertEquipment(equipmentData, category_id, lineNumber);
                        });
                    } else {
                        category_id = category.id;
                        insertEquipment(equipmentData, category_id, lineNumber);
                    }
                });
            } else {
                insertEquipment(equipmentData, null, lineNumber);
            }
        })
        .on('end', () => {
            setTimeout(() => {
                console.log(`\n✓ Import complete!`);
                console.log(`  - Processed ${lineNumber} lines`);
                console.log(`  - Imported ${results.length} items`);
                if (errors.length > 0) {
                    console.log(`  - ${errors.length} errors\n`);
                    errors.forEach(err => console.log(`    ${err}`));
                }

                // Show sample data
                db.all('SELECT id, name, serial_number, barcode, category_id FROM equipment LIMIT 5', (err, rows) => {
                    if (!err && rows.length > 0) {
                        console.log('\nSample imported equipment:');
                        rows.forEach(row => {
                            console.log(`  - ${row.name}`);
                            console.log(`    Serial: ${row.serial_number || 'NULL'}`);
                            console.log(`    Barcode: ${row.barcode || 'NULL'}`);
                            console.log(`    Category ID: ${row.category_id || 'NULL'}`);
                        });
                    }
                    db.close();
                });
            }, 2000); // Wait for async operations to complete
        })
        .on('error', (err) => {
            console.error('Error reading CSV:', err);
            db.close();
        });

    function insertEquipment(data, category_id, line) {
        const qr_code = `EQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        db.run(`
            INSERT INTO equipment (
                name, serial_number, barcode, manufacturer, model, category_id,
                condition, notes, qr_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            data.name,
            data.serial_number,
            data.barcode,
            data.manufacturer,
            data.model,
            category_id,
            data.condition,
            data.notes,
            qr_code
        ], function(err) {
            if (err) {
                errors.push(`Line ${line}: ${err.message}`);
            } else {
                results.push({ line, id: this.lastID, name: data.name });
            }
        });
    }
});
