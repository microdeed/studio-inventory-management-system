const database = require('../database/connection');

const categories = [
  { name: 'Camera', code: 'CA', color: '#4f46e5', description: 'Cameras and camera systems' },
  { name: 'Lens', code: 'LN', color: '#dc2626', description: 'Camera lenses and optical equipment' },
  { name: 'Microphone', code: 'MI', color: '#059669', description: 'Audio recording equipment' },
  { name: 'Lighting', code: 'LG', color: '#d97706', description: 'Lighting equipment and fixtures' },
  { name: 'Misc', code: 'MS', color: '#6b7280', description: 'Miscellaneous equipment' },
  { name: 'Grip', code: 'GR', color: '#7c2d12', description: 'Grip equipment and rigging' },
  { name: 'Stand', code: 'SD', color: '#1f2937', description: 'Stands and support equipment' },
  { name: 'Strobe', code: 'SB', color: '#7c3aed', description: 'Strobe and flash equipment' },
  { name: 'Modifier', code: 'MD', color: '#be185d', description: 'Light modifiers and accessories' },
  { name: 'Drone', code: 'DN', color: '#0891b2', description: 'Drone and UAV equipment' },
  { name: 'Battery', code: 'BY', color: '#65a30d', description: 'Batteries and power equipment' },
  { name: 'Remote', code: 'RT', color: '#c2410c', description: 'Remote controls and wireless equipment' },
  { name: 'Video Light', code: 'VL', color: '#eab308', description: 'Video lighting equipment' },
  { name: 'Storage', code: 'SR', color: '#374151', description: 'Storage and memory devices' }
];

// Equipment type mapping based on name patterns
const equipmentTypeMapping = [
  { patterns: ['camera', 'canon', 'nikon', 'sony', 'blackmagic', 'red'], category: 'Camera' },
  { patterns: ['lens', 'mm', 'f/', 'zoom', 'prime'], category: 'Lens' },
  { patterns: ['mic', 'microphone', 'audio', 'recorder', 'xlr'], category: 'Microphone' },
  { patterns: ['light', 'led', 'tungsten', 'fresnel', 'aputure', 'dracast'], category: 'Lighting' },
  { patterns: ['stand', 'tripod', 'boom', 'c-stand'], category: 'Stand' },
  { patterns: ['strobe', 'flash', 'speedlight'], category: 'Strobe' },
  { patterns: ['softbox', 'umbrella', 'reflector', 'diffuser', 'barndoor', 'gel'], category: 'Modifier' },
  { patterns: ['drone', 'dji', 'mavic', 'avata', 'fpv'], category: 'Drone' },
  { patterns: ['battery', 'power', 'charger', 'v-mount'], category: 'Battery' },
  { patterns: ['remote', 'controller', 'rc', 'wireless'], category: 'Remote' },
  { patterns: ['storage', 'sd card', 'cf card', 'ssd', 'hard drive'], category: 'Storage' },
  { patterns: ['grip', 'clamp', 'arm', 'mount', 'plate', 'stud'], category: 'Grip' }
];

function categorizeEquipment(name) {
  const lowerName = name.toLowerCase();
  
  for (const mapping of equipmentTypeMapping) {
    for (const pattern of mapping.patterns) {
      if (lowerName.includes(pattern)) {
        return mapping.category;
      }
    }
  }
  
  return 'Misc'; // Default category
}

async function createCategoriesAndAssign() {
  try {
    console.log('Connecting to database...');
    await database.connect();
    
    console.log('Creating categories...');
    for (const category of categories) {
      await database.run(
        'INSERT OR REPLACE INTO categories (name, color, description) VALUES (?, ?, ?)',
        [category.name, category.color, category.description]
      );
      console.log(`Created category: ${category.name}`);
    }
    
    console.log('Fetching equipment...');
    const equipment = await database.all('SELECT id, name FROM equipment WHERE is_active = 1');
    
    console.log('Assigning categories to equipment...');
    let assignedCount = 0;
    
    for (const item of equipment) {
      const categoryName = categorizeEquipment(item.name);
      const category = await database.get('SELECT id FROM categories WHERE name = ?', [categoryName]);
      
      if (category) {
        await database.run(
          'UPDATE equipment SET category_id = ? WHERE id = ?',
          [category.id, item.id]
        );
        console.log(`Assigned ${item.name} -> ${categoryName}`);
        assignedCount++;
      }
    }
    
    console.log(`Successfully assigned ${assignedCount} equipment items to categories.`);
    
    // Show category counts
    const categoryCounts = await database.all(`
      SELECT c.name, c.color, COUNT(e.id) as count 
      FROM categories c 
      LEFT JOIN equipment e ON c.id = e.category_id AND e.is_active = 1 
      GROUP BY c.id, c.name, c.color 
      ORDER BY count DESC
    `);
    
    console.log('\nCategory Summary:');
    categoryCounts.forEach(cat => {
      console.log(`${cat.name}: ${cat.count} items`);
    });
    
    await database.close();
    console.log('Done!');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createCategoriesAndAssign();