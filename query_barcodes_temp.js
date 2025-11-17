const db = require('./backend/database/connection');

(async () => {
    try {
        await db.connect();
        const rows = await db.all('SELECT id, name, barcode FROM equipment WHERE is_active = 1 ORDER BY id DESC LIMIT 30');
        console.log('Sample barcodes from database:\n');
        rows.forEach(r => {
            console.log(`ID: ${r.id}, Barcode: ${r.barcode}, Name: ${r.name}`);
        });
        await db.close();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
})();
