/**
 * Migration script to add batch_id column to transactions table
 */

const database = require('../database/connection');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    console.log('[Migration] Starting batch_id migration...');

    try {
        // Connect to database first
        await database.connect();
        console.log('[Migration] Database connected');

        // Check if column already exists
        const tableInfo = await database.all('PRAGMA table_info(transactions)');
        const batchIdExists = tableInfo.some(col => col.name === 'batch_id');

        if (batchIdExists) {
            console.log('[Migration] batch_id column already exists. Skipping migration.');
            return;
        }

        // Read migration SQL
        const migrationPath = path.join(__dirname, '../database/migrations/add_batch_id.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        // Split by semicolons and execute each statement
        const statements = migrationSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        await database.beginTransaction();

        try {
            for (const statement of statements) {
                console.log('[Migration] Executing:', statement.substring(0, 50) + '...');
                await database.run(statement);
            }

            await database.commit();
            console.log('[Migration] ✅ Successfully added batch_id column to transactions table');
        } catch (error) {
            await database.rollback();
            throw error;
        }

    } catch (error) {
        console.error('[Migration] ❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migration if called directly
if (require.main === module) {
    runMigration()
        .then(() => {
            console.log('[Migration] Migration complete');
            process.exit(0);
        })
        .catch(error => {
            console.error('[Migration] Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { runMigration };
