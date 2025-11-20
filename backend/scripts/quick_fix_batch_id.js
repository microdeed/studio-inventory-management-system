const database = require('../database/connection');

(async () => {
    try {
        await database.connect();
        console.log('Connected to database');

        // Try to add the column
        try {
            await database.run('ALTER TABLE transactions ADD COLUMN batch_id VARCHAR(50)');
            console.log('✅ Added batch_id column');
        } catch (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('✅ Column already exists');
            } else {
                throw err;
            }
        }

        // Add index
        try {
            await database.run('CREATE INDEX idx_transactions_batch ON transactions(batch_id)');
            console.log('✅ Added index on batch_id');
        } catch (err) {
            if (err.message.includes('already exists')) {
                console.log('✅ Index already exists');
            } else {
                throw err;
            }
        }

        // Verify
        const tableInfo = await database.all('PRAGMA table_info(transactions)');
        const hasBatchId = tableInfo.some(col => col.name === 'batch_id');
        console.log(`\nVerification: batch_id column ${hasBatchId ? 'EXISTS ✅' : 'MISSING ❌'}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
})();
