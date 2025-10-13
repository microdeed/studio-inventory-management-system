const fs = require('fs');
const path = require('path');
const database = require('../database/connection');

// Category mapping for equipment types
const categoryMapping = {
    'Camera': 'Video',
    'Lens': 'Video', 
    'Drone': 'Video',
    'Battery': 'Accessories',
    'Remote': 'Accessories',
    'Strobe': 'Lighting',
    'Misc': 'Accessories',
    'Stand': 'Furniture',
    'Grip': 'Accessories',
    'Modifer': 'Lighting',
    'Modifier': 'Lighting',
    'Video Light': 'Lighting',
    'Camera Platform': 'Video',
    'Storage': 'Computing',
    'Mic': 'Audio',
    'Lens Filter': 'Video',
    'Camera Rig': 'Video'
};

// Status mapping
const statusMapping = {
    'Normal': 'good',
    'Brand New': 'excellent',
    'Functional': 'fair', 
    'Worn': 'poor',
    'Decommissioned': 'damaged'
};

async function createCategories() {
    console.log('Creating equipment categories...');
    
    const categories = [
        { name: 'Video', description: 'Cameras, lenses, drones, rigs', color: '#4ECDC4' },
        { name: 'Audio', description: 'Microphones, wireless systems', color: '#FF6B6B' },
        { name: 'Lighting', description: 'Studio lights, strobes, modifiers', color: '#FFEAA7' },
        { name: 'Computing', description: 'Storage devices, computers', color: '#45B7D1' },
        { name: 'Accessories', description: 'Batteries, cables, cases', color: '#DDA0DD' },
        { name: 'Furniture', description: 'Stands, racks, supports', color: '#98D8C8' }
    ];
    
    for (const category of categories) {
        try {
            await database.run(
                'INSERT OR IGNORE INTO categories (name, description, color) VALUES (?, ?, ?)',
                [category.name, category.description, category.color]
            );
            console.log(`  ✓ Created category: ${category.name}`);
        } catch (error) {
            console.error(`  ✗ Error creating category ${category.name}:`, error.message);
        }
    }
}

async function getCategoryId(typeName) {
    if (!typeName) return null;
    
    const categoryName = categoryMapping[typeName] || 'Accessories';
    const category = await database.get(
        'SELECT id FROM categories WHERE name = ?',
        [categoryName]
    );
    return category ? category.id : null;
}

function cleanEquipmentName(nameField) {
    if (!nameField) return null;
    
    // Remove newlines and extra spaces
    let name = nameField.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Remove "Untagged" prefix if present
    name = name.replace(/^Untagged\s*/, '');
    
    return name || null;
}

function extractManufacturer(name) {
    if (!name) return null;
    
    const commonBrands = ['Sony', 'DJI', 'Godox', 'Impact', 'Aputure', 'Dracast', 
                         'Voigtlander', 'Sigma', 'K&F', 'NiSi', 'SmallRig', 'Pelican',
                         'Tilta', 'Sennheiser', 'RODE', 'Flashpoint', 'Manfrotto',
                         'RRS', 'Edelkrone', 'WELLMAKING', 'Insta', 'GoPro', 'Neewer',
                         'Spider', 'Ice'];
    
    for (const brand of commonBrands) {
        if (name.toLowerCase().includes(brand.toLowerCase())) {
            return brand;
        }
    }
    
    return null;
}

function generateQRCode() {
    return `EQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function parseCSVWithMultilineFields(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Find the header row (line with ID,Ct,Gear Tag...)
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('ID,Ct,Gear Tag')) {
            headerIndex = i;
            break;
        }
    }
    
    if (headerIndex === -1) {
        throw new Error('Header row not found');
    }
    
    const headers = lines[headerIndex].split(',').map(h => h.trim());
    console.log('Headers found:', headers);
    
    const records = [];
    let currentRecord = null;
    let fieldIndex = 0;
    
    for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Check if this line starts a new record (starts with a number)
        const match = line.match(/^(\d+),/);
        if (match) {
            // Save previous record
            if (currentRecord && currentRecord.ID) {
                records.push(currentRecord);
            }
            
            // Start new record
            const fields = line.split(',');
            currentRecord = {};
            
            // Map fields to headers
            for (let j = 0; j < headers.length && j < fields.length; j++) {
                currentRecord[headers[j]] = fields[j] || '';
            }
            fieldIndex = 0;
        } else if (currentRecord) {
            // This is a continuation line - likely part of Name/Model field
            if (currentRecord['Name/Model']) {
                currentRecord['Name/Model'] += ' ' + line;
            } else {
                currentRecord['Name/Model'] = line;
            }
        }
    }
    
    // Don't forget the last record
    if (currentRecord && currentRecord.ID) {
        records.push(currentRecord);
    }
    
    return records.filter(record => record.ID && record.ID !== '' && !isNaN(parseInt(record.ID)));
}

async function populateEquipment() {
    console.log('\nReading and processing equipment data...');
    
    const csvPath = path.join(__dirname, '../../data/Equipment Inventory (Incomplete).csv');
    let successCount = 0;
    let errorCount = 0;
    
    try {
        const records = parseCSVWithMultilineFields(csvPath);
        console.log(`Found ${records.length} equipment entries to process`);
        
        for (const row of records) {
            try {
                const name = cleanEquipmentName(row['Name/Model']);
                if (!name || name.length < 3) {
                    console.log(`  ~ Skipping item with invalid name: ${JSON.stringify(row['Name/Model'])}`);
                    continue;
                }
                
                const manufacturer = extractManufacturer(name);
                const serial = row['Serial'] ? row['Serial'].trim() : null;
                const type = row['Type'] ? row['Type'].trim() : null;
                const status = row['Equipment Status'] ? row['Equipment Status'].trim() : 'Normal';
                const barcode = row['Barcode'] ? row['Barcode'].trim() : null;
                const notes = row['Item Notes'] ? row['Item Notes'].trim() : null;
                
                // Skip if equipment already exists (by serial or name)
                if (serial && serial !== '') {
                    const existing = await database.get(
                        'SELECT id FROM equipment WHERE serial_number = ?',
                        [serial]
                    );
                    if (existing) {
                        console.log(`  ~ Skipping duplicate serial: ${serial}`);
                        continue;
                    }
                }
                
                const categoryId = await getCategoryId(type);
                const condition = statusMapping[status] || 'good';
                const qrCode = generateQRCode();
                
                // Extract model from name if possible
                let model = null;
                const modelMatch = name.match(/([A-Z0-9-]+(?:\s+[A-Z0-9-]+)*)\s*$/);
                if (modelMatch) {
                    model = modelMatch[1];
                }
                
                // Insert equipment
                const result = await database.run(`
                    INSERT INTO equipment (
                        name, serial_number, model, manufacturer, category_id,
                        condition, notes, qr_code, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `, [name, serial, model, manufacturer, categoryId, condition, notes, qrCode]);
                
                successCount++;
                console.log(`  ✓ Added: ${name} (ID: ${result.id})`);
                
            } catch (error) {
                errorCount++;
                console.error(`  ✗ Error processing row ${row.ID}: ${error.message}`);
                console.error('    Row data:', JSON.stringify(row, null, 2));
            }
        }
        
    } catch (error) {
        console.error('Error parsing CSV file:', error);
        throw error;
    }
    
    console.log(`\nImport completed:`);
    console.log(`  ✓ Successfully imported: ${successCount} items`);
    console.log(`  ✗ Errors: ${errorCount} items`);
    
    return { success: successCount, errors: errorCount };
}

async function createSampleUser() {
    console.log('\nCreating sample users...');
    
    const users = [
        {
            username: 'admin',
            email: 'admin@studio.com',
            full_name: 'Studio Administrator',
            role: 'admin',
            department: 'Management'
        },
        {
            username: 'levi',
            email: 'levi@studio.com', 
            full_name: 'Levi',
            role: 'user',
            department: 'Production'
        },
        {
            username: 'operator1',
            email: 'operator@studio.com',
            full_name: 'Studio Operator',
            role: 'user', 
            department: 'Production'
        }
    ];
    
    for (const user of users) {
        try {
            await database.run(`
                INSERT OR IGNORE INTO users (username, email, full_name, role, department)
                VALUES (?, ?, ?, ?, ?)
            `, [user.username, user.email, user.full_name, user.role, user.department]);
            
            console.log(`  ✓ Created user: ${user.full_name}`);
        } catch (error) {
            console.error(`  ✗ Error creating user ${user.username}:`, error.message);
        }
    }
}

async function main() {
    try {
        console.log('🚀 Starting database population...\n');
        
        // Connect to database
        await database.connect();
        
        // Create categories
        await createCategories();
        
        // Create sample users
        await createSampleUser();
        
        // Import equipment
        const result = await populateEquipment();
        
        console.log('\n✅ Database population completed successfully!');
        console.log(`📊 Final stats: ${result.success} items imported, ${result.errors} errors`);
        
        // Show summary
        const counts = await Promise.all([
            database.get('SELECT COUNT(*) as count FROM equipment'),
            database.get('SELECT COUNT(*) as count FROM categories'), 
            database.get('SELECT COUNT(*) as count FROM users')
        ]);
        
        console.log('\n📈 Database Summary:');
        console.log(`  Equipment: ${counts[0].count} items`);
        console.log(`  Categories: ${counts[1].count} categories`);
        console.log(`  Users: ${counts[2].count} users`);
        
        // Show sample equipment
        const sampleEquipment = await database.all(`
            SELECT e.name, e.serial_number, c.name as category
            FROM equipment e 
            LEFT JOIN categories c ON e.category_id = c.id 
            LIMIT 5
        `);
        
        console.log('\n📦 Sample Equipment:');
        sampleEquipment.forEach(item => {
            console.log(`  • ${item.name} (${item.category}) - SN: ${item.serial_number || 'N/A'}`);
        });
        
    } catch (error) {
        console.error('❌ Error during database population:', error);
        process.exit(1);
    } finally {
        await database.close();
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { main };