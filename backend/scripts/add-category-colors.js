const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/inventory.db');
const db = new sqlite3.Database(dbPath);

console.log('Adding colors to categories...\n');

const categoryColors = {
    'Camera': '#4ECDC4',
    'Lens': '#45B7D1',
    'Drone': '#FFB6C1',
    'Battery': '#FFEAA7',
    'Misc': '#DDA0DD',
    'Remote': '#96CEB4',
    'Stabilizer': '#98D8C8',
    'Mic': '#FF6B6B',
    'Stand': '#A8E6CF',
    'Grip': '#87CEEB',
    'Video Light': '#FFD93D',
    'Modifer': '#C7CEEA',
    'Camera Platform': '#6BCB77',
    'Storage': '#FDA7DF',
    'Camera Rig': '#FF8787',
    'Lens Filter': '#B4E7CE',
    'Strobe': '#F38181'
};

db.serialize(() => {
    const stmt = db.prepare('UPDATE categories SET color = ? WHERE name = ?');

    Object.entries(categoryColors).forEach(([name, color]) => {
        stmt.run(color, name, (err) => {
            if (err) {
                console.error(`Error updating ${name}:`, err);
            } else {
                console.log(`✓ ${name}: ${color}`);
            }
        });
    });

    stmt.finalize(() => {
        // Verify
        db.all('SELECT name, color FROM categories ORDER BY name', (err, rows) => {
            if (err) {
                console.error('Error verifying:', err);
            } else {
                console.log('\nAll categories:');
                rows.forEach(row => {
                    console.log(`  ${row.name}: ${row.color || 'NO COLOR'}`);
                });
            }
            db.close();
        });
    });
});
