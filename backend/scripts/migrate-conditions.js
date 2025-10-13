const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database path
const dbPath = path.join(__dirname, '../database/inventory.db');

console.log('Starting condition value migration...');
console.log('Database:', dbPath);

// Open database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
    console.log('Connected to database');
});

// Run migration queries
const migrations = [
    { from: 'functional', to: 'normal' }
];

let completedCount = 0;
let totalUpdated = 0;

migrations.forEach((migration) => {
    const sql = `UPDATE equipment SET condition = ? WHERE condition = ?`;

    db.run(sql, [migration.to, migration.from], function(err) {
        if (err) {
            console.error(`Error migrating ${migration.from} -> ${migration.to}:`, err.message);
        } else {
            console.log(`✓ Migrated ${this.changes} equipment from '${migration.from}' to '${migration.to}'`);
            totalUpdated += this.changes;
        }

        completedCount++;

        // When all migrations are done
        if (completedCount === migrations.length) {
            console.log('\n=================================');
            console.log(`Migration complete!`);
            console.log(`Total equipment updated: ${totalUpdated}`);
            console.log('=================================\n');

            // Close database
            db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                } else {
                    console.log('Database connection closed');
                }
                process.exit(0);
            });
        }
    });
});
