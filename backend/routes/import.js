const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const database = require('../database/connection');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'import-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed!'), false);
        }
    }
});

// Import equipment from CSV
router.post('/equipment', upload.single('csvFile'), async (req, res) => {
    try {
        console.log('[CSV Import] Import request received');

        if (!req.file) {
            console.error('[CSV Import] No file uploaded');
            return res.status(400).json({ error: 'No CSV file uploaded' });
        }

        console.log('[CSV Import] File received:', req.file.originalname, `(${req.file.size} bytes)`);

        const results = [];
        const errors = [];
        let lineNumber = 1; // Start from 1 (header line)

        // Read and parse CSV
        const csvData = await new Promise((resolve, reject) => {
            const data = [];
            fs.createReadStream(req.file.path)
                .pipe(csv())
                .on('data', (row) => {
                    lineNumber++;
                    data.push({ ...row, lineNumber });
                })
                .on('end', () => resolve(data))
                .on('error', (error) => reject(error));
        });

        console.log(`[CSV Import] Parsed ${csvData.length} rows from CSV`);

        // Process each row
        for (const row of csvData) {
            try {
                // Map CSV columns to database fields
                const equipmentData = {
                    name: row.name || row.Name || row['Name/Model'] || row.equipment_name,
                    serial_number: row.serial_number || row['Serial Number'] || row.Serial || row.serial,
                    barcode: row.barcode || row.Barcode,
                    model: row.model || row.Model,
                    manufacturer: row.manufacturer || row.Manufacturer || row.brand,
                    category_name: row.category || row.Category || row.category_name || row.Type || row.type,
                    condition: (row.condition || row.Condition || row['Equipment Status'] || 'good').toLowerCase(),
                    location: row.location || row.Location,
                    purchase_date: row.purchase_date || row['Purchase Date'],
                    purchase_price: parseFloat(row.purchase_price || row['Purchase Price'] || 0) || null,
                    current_value: parseFloat(row.current_value || row['Current Value'] || 0) || null,
                    description: row.description || row.Description,
                    notes: row.notes || row.Notes || row['Item Notes']
                };

                // Validate required fields
                if (!equipmentData.name) {
                    errors.push(`Line ${row.lineNumber}: Equipment name is required`);
                    continue;
                }

                // Normalize and validate condition using new standardized values
                const conditionMap = {
                    'brand new': 'brand_new',
                    'new': 'brand_new',
                    'brand_new': 'brand_new',
                    'excellent': 'brand_new',
                    'functional': 'functional',
                    'good': 'functional',
                    'normal': 'normal',
                    'fair': 'normal',
                    'worn': 'worn',
                    'poor': 'worn',
                    'out of commission': 'out_of_commission',
                    'out_of_commission': 'out_of_commission',
                    'damaged': 'out_of_commission',
                    'broken': 'broken',
                    'decommissioned': 'broken',
                    'retired': 'broken',
                    'out of service': 'broken'
                };
                const normalizedCondition = equipmentData.condition ? equipmentData.condition.toLowerCase().replace(/ /g, '_') : 'normal';
                equipmentData.condition = conditionMap[normalizedCondition] || 'normal';

                // Find or create category
                let category_id = null;
                if (equipmentData.category_name) {
                    let category = await database.get(
                        'SELECT id FROM categories WHERE name = ?',
                        [equipmentData.category_name]
                    );

                    if (!category) {
                        // Create new category
                        const categoryResult = await database.run(
                            'INSERT INTO categories (name) VALUES (?)',
                            [equipmentData.category_name]
                        );
                        category_id = categoryResult.id;
                    } else {
                        category_id = category.id;
                    }
                }

                // Check for duplicate serial number
                if (equipmentData.serial_number) {
                    const existing = await database.get(
                        'SELECT id FROM equipment WHERE serial_number = ? AND is_active = 1',
                        [equipmentData.serial_number]
                    );
                    if (existing) {
                        errors.push(`Line ${row.lineNumber}: Serial number '${equipmentData.serial_number}' already exists`);
                        continue;
                    }
                }

                // Generate QR code
                const qr_code = `EQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                // Insert equipment
                const result = await database.run(`
                    INSERT INTO equipment (
                        name, serial_number, barcode, model, manufacturer, category_id,
                        condition, location, purchase_date, purchase_price,
                        current_value, description, notes, qr_code
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    equipmentData.name,
                    equipmentData.serial_number,
                    equipmentData.barcode,
                    equipmentData.model,
                    equipmentData.manufacturer,
                    category_id,
                    equipmentData.condition,
                    equipmentData.location,
                    equipmentData.purchase_date,
                    equipmentData.purchase_price,
                    equipmentData.current_value,
                    equipmentData.description,
                    equipmentData.notes,
                    qr_code
                ]);

                results.push({
                    line: row.lineNumber,
                    id: result.id,
                    name: equipmentData.name,
                    serial_number: equipmentData.serial_number,
                    status: 'success'
                });

            } catch (error) {
                console.error(`[CSV Import] Error on line ${row.lineNumber}:`, error);
                errors.push(`Line ${row.lineNumber}: ${error.message}`);
            }
        }

        console.log(`[CSV Import] Import complete - Success: ${results.length}, Errors: ${errors.length}`);

        // Clean up uploaded file
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('[CSV Import] Failed to delete uploaded file:', err);
        });

        res.json({
            success: true,
            imported: results.length,
            errors: errors.length,
            results,
            errors
        });

    } catch (error) {
        console.error('[CSV Import] Error:', error);
        console.error('[CSV Import] Stack trace:', error.stack);

        // Clean up uploaded file on error
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('[CSV Import] Failed to delete uploaded file:', err);
            });
        }

        res.status(500).json({ error: 'Failed to import CSV file' });
    }
});

// Get CSV template
router.get('/template', (req, res) => {
    const template = `name,serial_number,barcode,model,manufacturer,type,condition,location,purchase_date,purchase_price,current_value,description,notes
Studio Monitor,SM001,1234567890123,LSR305,JBL,Audio,functional,Studio A,2023-01-15,150.00,120.00,"Near-field monitor speaker","Used for mixing"
Camera Tripod,CT002,9876543210987,CF-3560,Gitzo,Video,brand_new,Equipment Room,2023-02-20,300.00,280.00,"Carbon fiber tripod","Heavy duty support"`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="equipment_import_template.csv"');
    res.send(template);
});

module.exports = router;