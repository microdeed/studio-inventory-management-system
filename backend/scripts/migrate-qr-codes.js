const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { generateQRCode } = require('../utils/qrCodeGenerator');

const dbPath = path.join(__dirname, '../database/inventory.db');

console.log('===========================================');
console.log('QR Code Migration Script');
console.log('===========================================');
console.log('This script will update all QR codes to the new format\n');
console.log('Old format: EQ-1731849600000-a4b2c7d9e');
console.log('New format: EQ-00123 (based on equipment ID)\n');

async function migrateQRCodes() {
    const db = new sqlite3.Database(dbPath);

    // Promisify database operations
    const dbAll = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    };

    const dbRun = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    };

    try {
        // Get all equipment with their current QR codes
        console.log('📊 Fetching all equipment records...\n');
        const equipment = await dbAll(`
            SELECT id, name, qr_code
            FROM equipment
            WHERE is_active = 1
            ORDER BY id
        `);

        if (equipment.length === 0) {
            console.log('No equipment found in the database.');
            db.close();
            return;
        }

        console.log(`Found ${equipment.length} equipment items to update\n`);
        console.log('─'.repeat(80));

        let updated = 0;
        let skipped = 0;
        let errors = 0;

        for (const item of equipment) {
            const oldQR = item.qr_code;
            const newQR = generateQRCode(item.id);

            // Skip if QR code is already in the new format
            if (oldQR === newQR) {
                skipped++;
                if (skipped <= 3) {
                    console.log(`⏭️  ID ${item.id}: Already up-to-date (${oldQR})`);
                }
                continue;
            }

            try {
                await dbRun(
                    'UPDATE equipment SET qr_code = ? WHERE id = ?',
                    [newQR, item.id]
                );

                updated++;

                // Show first 10 updates in detail
                if (updated <= 10) {
                    console.log(`✅ ID ${item.id}: "${item.name}"`);
                    console.log(`   Old: ${oldQR || 'NULL'}`);
                    console.log(`   New: ${newQR}`);
                    console.log();
                }

            } catch (error) {
                errors++;
                console.error(`❌ Error updating ID ${item.id}:`, error.message);
            }
        }

        if (updated > 10) {
            console.log(`   ... and ${updated - 10} more updates`);
            console.log();
        }

        if (skipped > 3) {
            console.log(`   ... and ${skipped - 3} more skipped`);
            console.log();
        }

        console.log('─'.repeat(80));
        console.log('\n📈 Migration Summary:');
        console.log(`   ✅ Updated: ${updated} QR codes`);
        console.log(`   ⏭️  Skipped: ${skipped} (already in new format)`);
        console.log(`   ❌ Errors: ${errors}`);
        console.log(`   📦 Total: ${equipment.length} equipment items\n`);

        if (updated > 0) {
            console.log('✨ Migration completed successfully!');
            console.log('\n💡 Tip: You may want to regenerate QR code labels for updated items.');
        } else if (skipped === equipment.length) {
            console.log('✨ All QR codes are already in the new format!');
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        console.error(error.stack);
    } finally {
        db.close(() => {
            console.log('\n🔒 Database connection closed.');
        });
    }
}

// Run the migration
migrateQRCodes().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
