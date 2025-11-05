const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const database = require('../database/connection');
const { logActivity, getRequestInfo } = require('../utils/activityLogger');
const { generateBarcode } = require('../utils/barcodeGenerator');
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
                // Log raw row data for debugging
                console.log(`[CSV Import] Processing row ${row.lineNumber}:`, JSON.stringify(row));

                // Map CSV columns to database fields (CSV format matches database export)
                const equipmentData = {
                    name: row.name,
                    serial_number: row.serial_number || null,
                    barcode: row.barcode || null,
                    model: row.model || null,
                    manufacturer: row.manufacturer || null,
                    category_name: row.category || null,
                    condition: row.condition || 'normal',
                    status: row.status || 'available',
                    location: row.location || null,
                    purchase_date: row.purchase_date || null,
                    purchase_price: parseFloat(row.purchase_price) || null,
                    current_value: parseFloat(row.current_value) || null,
                    description: row.description || null,
                    notes: row.notes || null,
                    image_path: row.image_path || null,
                    qr_code: row.qr_code || null,
                    included_in_kit: row.included_in_kit === 'true' || row.included_in_kit === '1' || row.included_in_kit === 1,
                    kit_contents: row.kit_contents || null
                };

                console.log(`[CSV Import] Mapped category_name: "${equipmentData.category_name}"`);

                // Validate required fields
                if (!equipmentData.name) {
                    errors.push(`Line ${row.lineNumber}: Equipment name is required`);
                    continue;
                }

                // Normalize condition to lowercase to handle case variations
                if (equipmentData.condition) {
                    equipmentData.condition = equipmentData.condition.toLowerCase().trim();
                }

                // Validate condition value (CSV should already have normalized values from database)
                const validConditions = ['brand_new', 'functional', 'normal', 'worn', 'out_of_commission', 'broken'];
                if (equipmentData.condition && !validConditions.includes(equipmentData.condition)) {
                    // If legacy value, normalize it
                    const conditionMap = {
                        'brand new': 'brand_new',
                        'new': 'brand_new',
                        'excellent': 'brand_new',
                        'good': 'functional',
                        'fair': 'normal',
                        'poor': 'worn',
                        'damaged': 'out_of_commission',
                        'out of commission': 'out_of_commission',
                        'decommissioned': 'broken',
                        'retired': 'broken',
                        'out of service': 'broken'
                    };
                    const normalizedCondition = equipmentData.condition.toLowerCase().replace(/ /g, '_');
                    equipmentData.condition = conditionMap[normalizedCondition] || 'normal';
                }

                // Validate status value
                const validStatuses = ['available', 'checked_out', 'maintenance', 'retired'];
                if (equipmentData.status && !validStatuses.includes(equipmentData.status)) {
                    equipmentData.status = 'available';
                }

                // Find or create category
                let category_id = null;
                if (equipmentData.category_name && equipmentData.category_name.trim()) {
                    const categoryName = equipmentData.category_name.trim();
                    console.log(`[CSV Import] Looking up category: "${categoryName}"`);

                    let category = await database.get(
                        'SELECT id FROM categories WHERE LOWER(name) = LOWER(?)',
                        [categoryName]
                    );

                    if (!category) {
                        // Create new category
                        console.log(`[CSV Import] Creating new category: "${categoryName}"`);
                        const categoryResult = await database.run(
                            'INSERT INTO categories (name) VALUES (?)',
                            [categoryName]
                        );
                        category_id = categoryResult.id;
                        console.log(`[CSV Import] Created new category with ID: ${category_id}`);
                    } else {
                        category_id = category.id;
                        console.log(`[CSV Import] Found existing category ID: ${category_id}`);
                    }
                } else {
                    console.log(`[CSV Import] No category provided for "${equipmentData.name}"`);
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

                // Use provided QR code or generate new one
                const qr_code = equipmentData.qr_code || `EQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                // Generate barcode if not provided in CSV
                let barcode = equipmentData.barcode;
                if (!barcode || barcode.trim() === '') {
                    const categoryName = equipmentData.category_name?.trim() || null;
                    barcode = await generateBarcode(
                        categoryName,
                        equipmentData.purchase_date,
                        1, // Single item
                        equipmentData.serial_number,
                        1  // Total quantity
                    );
                    console.log(`[CSV Import] Generated barcode: ${barcode} for "${equipmentData.name}"`);
                } else {
                    console.log(`[CSV Import] Using CSV-provided barcode: ${barcode} for "${equipmentData.name}"`);
                }

                // Log what we're about to insert
                console.log(`[CSV Import] Inserting equipment "${equipmentData.name}" with category_id: ${category_id}, status: ${equipmentData.status}`);

                // Insert equipment with all fields
                const result = await database.run(`
                    INSERT INTO equipment (
                        name, serial_number, barcode, model, manufacturer, category_id,
                        condition, status, location, purchase_date, purchase_price,
                        current_value, description, notes, image_path, qr_code,
                        included_in_kit, kit_contents
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    equipmentData.name,
                    equipmentData.serial_number,
                    barcode,
                    equipmentData.model,
                    equipmentData.manufacturer,
                    category_id,
                    equipmentData.condition,
                    equipmentData.status,
                    equipmentData.location,
                    equipmentData.purchase_date,
                    equipmentData.purchase_price,
                    equipmentData.current_value,
                    equipmentData.description,
                    equipmentData.notes,
                    equipmentData.image_path,
                    qr_code,
                    equipmentData.included_in_kit ? 1 : 0,
                    equipmentData.kit_contents
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

        // Log the import activity
        const requestInfo = getRequestInfo(req);
        await logActivity({
            user_id: req.user?.id || null, // Will be null if no auth middleware
            action: 'import',
            entity_type: 'equipment',
            entity_id: null,
            changes: {
                imported: results.length,
                errors: errors.length,
                filename: req.file.originalname
            },
            ip_address: requestInfo.ip_address,
            user_agent: requestInfo.user_agent
        });

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
    const template = `name,serial_number,barcode,model,manufacturer,category,purchase_date,purchase_price,current_value,condition,status,location,description,notes,image_path,qr_code,included_in_kit,kit_contents
Godox AD200,AD200-001,,AD200,Godox,Strobe,2023-01-15,350.00,320.00,functional,available,Studio A,"Portable flash strobe","200Ws power",,,0,
Sony A7IV,A7IV-001,1234567890123,A7 IV,Sony,Camera,2023-02-20,2500.00,2300.00,brand_new,available,Equipment Room,"Full-frame mirrorless camera","33MP sensor",,,0,
Sony 24-70mm,LENS-001,9876543210987,FE 24-70mm f/2.8 GM,Sony,Lens,2023-06-01,2200.00,2000.00,functional,available,Storage,"Standard zoom lens","Weather sealed",,,0,`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="equipment_import_template.csv"');
    res.send(template);
});

// Undo import - delete specific equipment items
router.post('/undo', async (req, res) => {
    try {
        const { equipmentIds } = req.body;

        if (!equipmentIds || !Array.isArray(equipmentIds) || equipmentIds.length === 0) {
            return res.status(400).json({ error: 'Equipment IDs array is required' });
        }

        console.log(`[CSV Import] Undo request for ${equipmentIds.length} items`);

        let deletedCount = 0;

        // Delete each equipment item
        for (const id of equipmentIds) {
            try {
                await database.run(
                    'DELETE FROM equipment WHERE id = ?',
                    [id]
                );
                deletedCount++;
            } catch (error) {
                console.error(`[CSV Import] Failed to delete equipment ${id}:`, error);
            }
        }

        console.log(`[CSV Import] Undo complete - Deleted ${deletedCount} items`);

        // Log the undo activity
        const requestInfo = getRequestInfo(req);
        await logActivity({
            user_id: req.user?.id || null,
            action: 'undo_import',
            entity_type: 'equipment',
            entity_id: null,
            changes: {
                deleted: deletedCount,
                equipment_ids: equipmentIds
            },
            ip_address: requestInfo.ip_address,
            user_agent: requestInfo.user_agent
        });

        res.json({
            success: true,
            deleted: deletedCount
        });

    } catch (error) {
        console.error('[CSV Import] Undo error:', error);
        res.status(500).json({ error: 'Failed to undo import' });
    }
});

module.exports = router;