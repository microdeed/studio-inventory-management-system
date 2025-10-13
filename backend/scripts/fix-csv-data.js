const fs = require('fs');
const path = require('path');
const database = require('../database/connection');

async function fixCSVData() {
  try {
    console.log('Connecting to database...');
    await database.connect();

    // First, add barcode column if it doesn't exist
    console.log('Adding barcode column...');
    try {
      await database.run('ALTER TABLE equipment ADD COLUMN barcode TEXT');
      console.log('Barcode column added');
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log('Barcode column already exists');
      } else {
        throw error;
      }
    }

    // Clear existing categories to start fresh
    console.log('Clearing existing categories...');
    await database.run('DELETE FROM categories');
    await database.run('UPDATE equipment SET category_id = NULL');

    // Read and parse CSV
    console.log('Reading CSV file...');
    const csvPath = path.join(__dirname, '../../data/Equipment Inventory (Incomplete).csv');
    const csvData = fs.readFileSync(csvPath, 'utf-8');
    
    // Use the same parsing logic as populate-database.js for consistent results
    function parseCSVWithMultilineFields() {
      const lines = csvData.split('\n');
      
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

    const equipment = parseCSVWithMultilineFields();
    
    function cleanEquipmentName(nameField) {
      if (!nameField) return null;
      
      // Remove quotes, newlines and extra spaces
      let name = nameField.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      name = name.replace(/^"|"$/g, '').replace(/^"|"$/g, ''); // Remove outer quotes
      
      // Remove "Untagged" prefix if present
      name = name.replace(/^Untagged\s*,?\s*/i, '');
      name = name.replace(/^,\s*/, ''); // Remove leading comma after Untagged
      
      return name.trim() || null;
    }

    // Convert to our expected format
    const processedEquipment = equipment.map(record => ({
      id: record.ID,
      nameModel: cleanEquipmentName(record['Name/Model']),
      serial: record.Serial ? record.Serial.trim() : null,
      type: record.Type ? record.Type.trim() : null,
      equipmentStatus: record['Equipment Status'] ? record['Equipment Status'].trim() : 'Normal',
      barcode: record.Barcode ? record.Barcode.trim() : null,
      itemNotes: record['Item Notes'] ? record['Item Notes'].trim() : null
    })).filter(item => item.nameModel && item.nameModel.length > 3);

    console.log(`Found ${processedEquipment.length} equipment items in CSV`);

    // Get unique types from CSV for categories
    const csvTypes = [...new Set(processedEquipment.map(item => item.type).filter(Boolean))];
    console.log('CSV Types found:', csvTypes);

    // Create categories based on CSV types
    const categories = csvTypes.map(type => ({
      name: type,
      color: getColorForType(type),
      description: `${type} equipment`
    }));

    console.log('Creating categories...');
    for (const category of categories) {
      await database.run(
        'INSERT INTO categories (name, color, description) VALUES (?, ?, ?)',
        [category.name, category.color, category.description]
      );
      console.log(`Created category: ${category.name}`);
    }

    // Update equipment with serial numbers, barcodes, and categories
    console.log('Updating equipment with CSV data...');
    let updatedCount = 0;

    for (const csvItem of processedEquipment) {
      // Find matching equipment by name
      const dbEquipment = await database.get(
        'SELECT id FROM equipment WHERE name = ? OR name LIKE ? LIMIT 1',
        [csvItem.nameModel, `%${csvItem.nameModel}%`]
      );

      if (dbEquipment) {
        // Get category ID
        let categoryId = null;
        if (csvItem.type) {
          const category = await database.get('SELECT id FROM categories WHERE name = ?', [csvItem.type]);
          categoryId = category?.id || null;
        }

        // Check if serial number already exists in another equipment
        let serialToUse = csvItem.serial || null;
        if (serialToUse) {
          const existingSerial = await database.get(
            'SELECT id FROM equipment WHERE serial_number = ? AND id != ?',
            [serialToUse, dbEquipment.id]
          );
          if (existingSerial) {
            console.log(`Serial ${serialToUse} already exists, skipping serial update`);
            serialToUse = null; // Don't update serial if it would conflict
          }
        }

        // Update equipment with all CSV data
        await database.run(`
          UPDATE equipment 
          SET serial_number = ?, 
              barcode = ?, 
              category_id = ?,
              condition = ?
          WHERE id = ?
        `, [
          serialToUse,
          csvItem.barcode || null,
          categoryId,
          mapEquipmentStatus(csvItem.equipmentStatus),
          dbEquipment.id
        ]);

        updatedCount++;
        console.log(`Updated: ${csvItem.nameModel} -> ${csvItem.type} (Serial: ${csvItem.serial}, Barcode: ${csvItem.barcode})`);
      } else {
        console.log(`Not found in DB: ${csvItem.nameModel}`);
      }
    }

    console.log(`Successfully updated ${updatedCount} equipment items with CSV data`);

    // Show final category summary
    const categoryCounts = await database.all(`
      SELECT c.name, c.color, COUNT(e.id) as count 
      FROM categories c 
      LEFT JOIN equipment e ON c.id = e.category_id AND e.is_active = 1 
      GROUP BY c.id, c.name, c.color 
      ORDER BY count DESC
    `);

    console.log('\nFinal Category Summary:');
    categoryCounts.forEach(cat => {
      console.log(`${cat.name}: ${cat.count} items (${cat.color})`);
    });

    await database.close();
    console.log('Done!');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

function getColorForType(type) {
  const colorMap = {
    'Camera': '#4f46e5',
    'Lens': '#dc2626', 
    'Drone': '#0891b2',
    'Battery': '#65a30d',
    'Remote': '#c2410c',
    'Strobe': '#7c3aed',
    'Misc': '#6b7280',
    'Stand': '#1f2937',
    'Grip': '#7c2d12',
    'Modifier': '#be185d',
    'Video Light': '#eab308',
    'Camera Platform': '#059669',
    'Storage': '#374151',
    'Mic': '#16a34a',
    'Lens Filter': '#ca8a04',
    'Camera Rig': '#0d9488'
  };
  return colorMap[type] || '#6b7280';
}

function mapEquipmentStatus(status) {
  const statusMap = {
    'Normal': 'good',
    'Brand New': 'excellent',
    'Functional': 'fair',
    'Poor': 'poor',
    'Damaged': 'damaged'
  };
  return statusMap[status] || 'good';
}

fixCSVData();