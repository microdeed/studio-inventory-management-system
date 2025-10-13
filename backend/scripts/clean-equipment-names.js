const database = require('../database/connection');

async function cleanEquipmentNames() {
    console.log('🧹 Cleaning up equipment names...');
    
    try {
        // Connect to database
        await database.connect();
        
        // Get all equipment with problematic names
        const equipment = await database.all('SELECT id, name FROM equipment');
        
        let updatedCount = 0;
        
        for (const item of equipment) {
            let cleanName = item.name;
            
            // Remove leading commas and quotes
            cleanName = cleanName.replace(/^[",\s]+/, '');
            
            // Remove trailing commas and quotes  
            cleanName = cleanName.replace(/[",\s]+$/, '');
            
            // Split on comma and take meaningful parts
            const parts = cleanName.split(',').filter(part => 
                part.trim() && 
                part.trim() !== '""' && 
                part.trim() !== '"' &&
                part.trim().length > 0
            );
            
            // Find the part that looks like equipment name (usually has letters/numbers)
            let finalName = null;
            for (const part of parts) {
                const trimmed = part.trim().replace(/"/g, '');
                if (trimmed && /[a-zA-Z0-9]/.test(trimmed) && trimmed !== 'Untagged') {
                    finalName = trimmed;
                    break;
                }
            }
            
            if (finalName && finalName !== item.name) {
                await database.run(
                    'UPDATE equipment SET name = ? WHERE id = ?',
                    [finalName, item.id]
                );
                console.log(`  ✓ Updated ID ${item.id}: "${item.name}" → "${finalName}"`);
                updatedCount++;
            }
        }
        
        console.log(`\n✅ Cleanup completed! Updated ${updatedCount} equipment names.`);
        
        // Show sample of cleaned names
        const sampleEquipment = await database.all(`
            SELECT e.name, e.serial_number, c.name as category
            FROM equipment e 
            LEFT JOIN categories c ON e.category_id = c.id 
            LIMIT 10
        `);
        
        console.log('\n📦 Sample Equipment (After Cleanup):');
        sampleEquipment.forEach(item => {
            console.log(`  • ${item.name} (${item.category}) - SN: ${item.serial_number || 'N/A'}`);
        });
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        await database.close();
    }
}

// Run the cleanup
if (require.main === module) {
    cleanEquipmentNames();
}

module.exports = { cleanEquipmentNames };