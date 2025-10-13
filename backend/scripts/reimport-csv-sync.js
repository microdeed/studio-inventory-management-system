const sqlite3 = require('sqlite3').verbose();
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../database/inventory.db');
const csvPath = path.join(__dirname, '../../data/Equipment Inventory (Incomplete).csv');

async function reimport() {
    const db = new sqlite3.Database(dbPath);

    // Promisify database operations
    const dbRun = (sql, params) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    };

    const dbGet = (sql, params) => {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    };

    console.log('Re-importing equipment from CSV...\n');

    try {
        // Clear existing equipment
        await dbRun('DELETE FROM equipment', []);
        console.log('✓ Cleared existing equipment\n');

        // Read CSV - skip first 3 empty lines
        const fileContent = fs.readFileSync(csvPath, 'utf8');
        const lines = fileContent.split('\n');
        const dataLines = lines.slice(3); // Skip first 3 empty lines
        const csvContent = dataLines.join('\n');

        const { Readable } = require('stream');
        const rows = [];
        await new Promise((resolve, reject) => {
            Readable.from([csvContent])
                .pipe(csv())
                .on('data', (row) => rows.push(row))
                .on('end', resolve)
                .on('error', reject);
        });

        console.log(`Found ${rows.length} rows in CSV`);

        let imported = 0;
        let skipped = 0;
        const errors = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const lineNumber = i + 2; // Account for header

            // Skip empty rows
            if (!row['Name/Model'] || row['Name/Model'].trim() === '') {
                skipped++;
                continue;
            }

            try {
                const equipmentData = {
                    name: row['Name/Model']?.trim(),
                    serial_number: row.Serial?.trim(),
                    barcode: row.Barcode?.trim(),
                    category_name: row.Type?.trim(),
                    condition: row['Equipment Status']?.trim() || 'good',
                    notes: row['Item Notes']?.trim()
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
                let category_id = null;
                if (equipmentData.category_name) {
                    let category = await dbGet('SELECT id FROM categories WHERE name = ?', [equipmentData.category_name]);

                    if (!category) {
                        // Create new category
                        const result = await dbRun('INSERT INTO categories (name) VALUES (?)', [equipmentData.category_name]);
                        category_id = result.lastID;
                        console.log(`  Created category: ${equipmentData.category_name}`);
                    } else {
                        category_id = category.id;
                    }
                }

                // Insert equipment
                const qr_code = `EQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                await dbRun(`
                    INSERT INTO equipment (
                        name, serial_number, barcode, category_id,
                        condition, notes, qr_code
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    equipmentData.name,
                    equipmentData.serial_number,
                    equipmentData.barcode,
                    category_id,
                    equipmentData.condition,
                    equipmentData.notes,
                    qr_code
                ]);

                imported++;
                if (imported <= 5) {
                    console.log(`  ✓ Imported: ${equipmentData.name} (Serial: ${equipmentData.serial_number || 'N/A'}, Barcode: ${equipmentData.barcode || 'N/A'})`);
                }
            } catch (err) {
                errors.push(`Line ${lineNumber}: ${err.message}`);
            }
        }

        console.log(`\n✓ Import complete!`);
        console.log(`  - Imported: ${imported} items`);
        console.log(`  - Skipped: ${skipped} empty rows`);
        if (errors.length > 0) {
            console.log(`  - Errors: ${errors.length}\n`);
            errors.slice(0, 5).forEach(err => console.log(`    ${err}`));
            if (errors.length > 5) {
                console.log(`    ... and ${errors.length - 5} more errors`);
            }
        }

        // Show sample data
        const samples = await new Promise((resolve, reject) => {
            db.all('SELECT id, name, serial_number, barcode, category_id FROM equipment LIMIT 5', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        if (samples.length > 0) {
            console.log('\nSample imported equipment:');
            samples.forEach(row => {
                console.log(`  - ${row.name}`);
                console.log(`    Serial: ${row.serial_number || 'NULL'}, Barcode: ${row.barcode || 'NULL'}, Category: ${row.category_id || 'NULL'}`);
            });
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        db.close();
    }
}

reimport();
