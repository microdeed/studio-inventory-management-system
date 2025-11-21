const express = require('express');
const { body, validationResult } = require('express-validator');
const database = require('../database/connection');
const QRCode = require('qrcode');
const { generateBarcode } = require('../utils/barcodeGenerator');
const { generateQRCode, generateQRImage } = require('../utils/qrCodeGenerator');
const { logActivity, getRequestInfo } = require('../utils/activityLogger');
const router = express.Router();

// Middleware to check if user is admin or manager
const requireAdminOrManager = async (req, res, next) => {
    const userId = req.body.created_by || req.body.updated_by || req.body.deleted_by || req.headers['x-user-id'];

    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const user = await database.get('SELECT role FROM users WHERE id = ? AND is_active = 1', [userId]);

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        if (user.role !== 'admin' && user.role !== 'manager') {
            return res.status(403).json({ error: 'Admin or Manager access required' });
        }

        next();
    } catch (error) {
        console.error('[Auth] Error checking admin/manager status:', error);
        return res.status(500).json({ error: 'Authentication error' });
    }
};

// Get all equipment with status (ledger view)
router.get('/', async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 50, 
            category, 
            status, 
            search,
            sort = 'name',
            order = 'ASC'
        } = req.query;

        let baseQuery = `
            SELECT
                e.id, e.name, e.serial_number, e.barcode, e.model, e.manufacturer,
                e.category_id, c.name as category_name, c.color as category_color,
                e.condition, e.location, e.purchase_date, e.purchase_price, e.current_value,
                e.image_path, e.qr_code, e.description, e.notes,
                e.status as equipment_status, e.needs_relabeling,
                CASE
                    WHEN t.equipment_id IS NULL THEN e.status
                    WHEN t.transaction_type = 'checkout' AND t.actual_return_date IS NULL THEN 'checked_out'
                    WHEN t.transaction_type = 'maintenance' AND t.actual_return_date IS NULL THEN 'maintenance'
                    ELSE e.status
                END as status,
                t.user_id as checked_out_by_id,
                u.full_name as checked_out_by_name,
                u.email as checked_out_by_email,
                t.checkout_date,
                t.expected_return_date,
                julianday('now') - julianday(t.checkout_date) as days_out
            FROM equipment e
            LEFT JOIN categories c ON e.category_id = c.id
            LEFT JOIN (
                SELECT DISTINCT
                    t1.equipment_id, t1.user_id, t1.transaction_type,
                    t1.checkout_date, t1.expected_return_date, t1.actual_return_date
                FROM transactions t1
                WHERE t1.id = (
                    SELECT MAX(t2.id)
                    FROM transactions t2
                    WHERE t2.equipment_id = t1.equipment_id
                    AND t2.actual_return_date IS NULL
                )
            ) t ON e.id = t.equipment_id
            LEFT JOIN users u ON t.user_id = u.id
            WHERE e.is_active = 1
        `;

        const params = [];

        // Add filters
        if (category) {
            baseQuery += ` AND e.category_id = ?`;
            params.push(category);
        }

        if (status) {
            if (status === 'available') {
                baseQuery += ` AND t.equipment_id IS NULL AND e.status = 'available'`;
            } else if (status === 'checked_out') {
                baseQuery += ` AND t.transaction_type = 'checkout' AND t.actual_return_date IS NULL`;
            } else if (status === 'maintenance') {
                baseQuery += ` AND t.transaction_type = 'maintenance' AND t.actual_return_date IS NULL`;
            } else if (status === 'needs_maintenance') {
                baseQuery += ` AND t.equipment_id IS NULL AND e.status = 'needs_maintenance'`;
            } else {
                // For other statuses (unavailable, in_use, reserved, decommissioned, etc.)
                baseQuery += ` AND t.equipment_id IS NULL AND e.status = ?`;
                params.push(status);
            }
        }

        if (search) {
            baseQuery += ` AND (
                LOWER(e.name) LIKE LOWER(?) OR
                LOWER(e.serial_number) LIKE LOWER(?) OR
                LOWER(e.barcode) LIKE LOWER(?) OR
                LOWER(e.qr_code) LIKE LOWER(?) OR
                LOWER(e.model) LIKE LOWER(?) OR
                LOWER(e.manufacturer) LIKE LOWER(?) OR
                LOWER(c.name) LIKE LOWER(?)
            )`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
        }

        // Add sorting
        const allowedSortFields = ['name', 'serial_number', 'category_name', 'status', 'checkout_date', 'expected_return_date'];
        let sortField = allowedSortFields.includes(sort) ? sort : 'name';
        
        // Fix ambiguous column reference for 'name'
        if (sortField === 'name') {
            sortField = 'e.name';
        }
        
        const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        
        baseQuery += ` ORDER BY ${sortField} ${sortOrder}`;

        const result = await database.paginate(baseQuery, params, parseInt(page), parseInt(limit));
        res.json(result);

    } catch (error) {
        console.error('Get equipment error:', error);
        res.status(500).json({ error: 'Failed to fetch equipment' });
    }
});

// Get single equipment by ID
router.get('/:id', async (req, res) => {
    try {
        const equipment = await database.get(`
            SELECT
                e.*, c.name as category_name, c.color as category_color,
                e.status as equipment_status,
                CASE
                    WHEN t.equipment_id IS NULL THEN e.status
                    WHEN t.transaction_type = 'checkout' AND t.actual_return_date IS NULL THEN 'checked_out'
                    WHEN t.transaction_type = 'maintenance' AND t.actual_return_date IS NULL THEN 'maintenance'
                    ELSE e.status
                END as status,
                t.user_id as checked_out_by_id,
                u.full_name as checked_out_by_name,
                t.checkout_date,
                t.expected_return_date
            FROM equipment e
            LEFT JOIN categories c ON e.category_id = c.id
            LEFT JOIN (
                SELECT DISTINCT
                    t1.equipment_id, t1.user_id, t1.transaction_type,
                    t1.checkout_date, t1.expected_return_date, t1.actual_return_date
                FROM transactions t1
                WHERE t1.id = (
                    SELECT MAX(t2.id)
                    FROM transactions t2
                    WHERE t2.equipment_id = t1.equipment_id
                    AND t2.actual_return_date IS NULL
                )
            ) t ON e.id = t.equipment_id
            LEFT JOIN users u ON t.user_id = u.id
            WHERE e.id = ? AND e.is_active = 1
        `, [req.params.id]);

        if (!equipment) {
            return res.status(404).json({ error: 'Equipment not found' });
        }

        res.json(equipment);
    } catch (error) {
        console.error('Get equipment by ID error:', error);
        res.status(500).json({ error: 'Failed to fetch equipment' });
    }
});

// Create new equipment (admin or manager only)
router.post('/', requireAdminOrManager, [
    body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
    body('serial_number').optional({ nullable: true }).trim(),
    body('barcode').optional({ nullable: true }).trim(),
    body('model').optional({ nullable: true }).trim(),
    body('manufacturer').optional({ nullable: true }).trim(),
    body('category_id').optional({ nullable: true }).isInt().withMessage('Category ID must be an integer'),
    body('condition').optional().isIn(['brand_new', 'functional', 'normal', 'worn', 'out_of_commission', 'broken']),
    body('location').optional({ nullable: true }).trim(),
    body('purchase_price').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Purchase price must be positive'),
    body('current_value').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Current value must be positive'),
    body('quantity').optional({ nullable: true }).isInt({ min: 1, max: 99 }).withMessage('Quantity must be between 1 and 99')
], async (req, res) => {
    try {
        console.log('[Equipment Create] Request body:', JSON.stringify(req.body, null, 2));

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('[Equipment Create] Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            name, serial_number, serial_numbers, barcode, model, manufacturer, category_id,
            purchase_date, purchase_price, current_value, condition,
            location, description, notes, quantity, included_in_kit, kit_contents
        } = req.body;

        // Get quantity (defaults to 1 if not provided)
        const itemCount = quantity || 1;

        // Validate serial numbers array if provided
        if (serial_numbers && Array.isArray(serial_numbers)) {
            if (serial_numbers.length !== itemCount) {
                return res.status(400).json({
                    error: `Serial numbers count (${serial_numbers.length}) doesn't match quantity (${itemCount})`
                });
            }

            // Check if any serial numbers already exist
            for (const sn of serial_numbers) {
                if (sn && sn.trim()) {
                    const existing = await database.get(
                        'SELECT id FROM equipment WHERE serial_number = ? AND is_active = 1',
                        [sn.trim()]
                    );
                    if (existing) {
                        console.warn(`[Equipment Create] Serial number already exists: ${sn}`);
                        return res.status(400).json({ error: `Serial number already exists: ${sn}` });
                    }
                }
            }
        }

        // Check if single serial number already exists (only if provided)
        if (itemCount === 1 && serial_number) {
            const existing = await database.get(
                'SELECT id FROM equipment WHERE serial_number = ? AND is_active = 1',
                [serial_number]
            );
            if (existing) {
                console.warn(`[Equipment Create] Serial number already exists: ${serial_number}`);
                return res.status(400).json({ error: 'Serial number already exists' });
            }
        }

        // Get category name for barcode generation
        let categoryName = null;
        if (category_id) {
            const category = await database.get(
                'SELECT name FROM categories WHERE id = ?',
                [category_id]
            );
            categoryName = category ? category.name : null;
        }

        // Create multiple equipment items if quantity > 1
        const createdItems = [];

        for (let count = 1; count <= itemCount; count++) {
            // Get serial number for this item
            let itemSerialNumber = null;
            if (itemCount === 1) {
                // Single item - use serial_number
                itemSerialNumber = serial_number || null;
            } else if (serial_numbers && Array.isArray(serial_numbers) && serial_numbers[count - 1]) {
                // Multiple items with serial numbers array
                itemSerialNumber = serial_numbers[count - 1].trim() || null;
            }

            // Generate barcode using the convention
            let generatedBarcode = barcode;
            if (!generatedBarcode) {
                // Pass count, item's serial number, and total quantity to generateBarcode
                generatedBarcode = await generateBarcode(
                    categoryName,
                    purchase_date,
                    count,
                    itemSerialNumber,
                    itemCount
                );
            }

            // Insert equipment first (without QR code)
            const result = await database.run(`
                INSERT INTO equipment (
                    name, serial_number, barcode, model, manufacturer, category_id,
                    purchase_date, purchase_price, current_value, condition,
                    location, description, notes, qr_code, status, included_in_kit, kit_contents
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                name, itemSerialNumber, generatedBarcode, model, manufacturer, category_id,
                purchase_date, purchase_price, current_value, condition || 'normal',
                location, description, notes, null, 'available', included_in_kit || false, kit_contents
            ]);

            // Generate QR code using the equipment ID
            const qr_code = generateQRCode(result.id);
            console.log(`[Equipment Create] Item ${count}/${itemCount} - ID: ${result.id}, QR: ${qr_code}, Barcode: ${generatedBarcode}, Serial: ${itemSerialNumber || 'N/A'}`);

            // Update equipment with QR code
            await database.run(
                'UPDATE equipment SET qr_code = ? WHERE id = ?',
                [qr_code, result.id]
            );

            const newEquipment = await database.get(
                'SELECT * FROM equipment WHERE id = ?',
                [result.id]
            );

            createdItems.push(newEquipment);

            // Log activity for each item
            await logActivity({
                user_id: req.body.created_by || null,
                action: 'create',
                entity_type: 'equipment',
                entity_id: result.id,
                changes: { name, barcode: generatedBarcode, category_id, count: `${count}/${itemCount}` },
                ...getRequestInfo(req)
            });
        }

        console.log(`[Equipment Create] Successfully created ${createdItems.length} equipment item(s)`);

        // Return single item or array based on quantity
        res.status(201).json(itemCount === 1 ? createdItems[0] : { items: createdItems, count: itemCount });

    } catch (error) {
        console.error('[Equipment Create] Error:', error);
        console.error('[Equipment Create] Stack trace:', error.stack);
        res.status(500).json({ error: 'Failed to create equipment' });
    }
});

// Update equipment (admin or manager only)
router.put('/:id', requireAdminOrManager, [
    body('name').optional().trim().isLength({ min: 1 }).withMessage('Name cannot be empty'),
    body('serial_number').optional({ nullable: true }).trim(),
    body('barcode').optional({ nullable: true }).trim(),
    body('model').optional({ nullable: true }).trim(),
    body('manufacturer').optional({ nullable: true }).trim(),
    body('category_id').optional({ nullable: true }),
    body('condition').optional().isIn(['brand_new', 'functional', 'normal', 'worn', 'out_of_commission', 'broken']),
    body('location').optional({ nullable: true }).trim(),
    body('purchase_date').optional({ nullable: true }),
    body('purchase_price').optional({ nullable: true }).custom(value => {
        if (value === null || value === undefined || value === '') return true;
        if (isNaN(value) || parseFloat(value) < 0) {
            throw new Error('Purchase price must be a positive number');
        }
        return true;
    }),
    body('current_value').optional({ nullable: true }).custom(value => {
        if (value === null || value === undefined || value === '') return true;
        if (isNaN(value) || parseFloat(value) < 0) {
            throw new Error('Current value must be a positive number');
        }
        return true;
    }),
    body('description').optional({ nullable: true }).trim(),
    body('notes').optional({ nullable: true }).trim()
], async (req, res) => {
    try {
        console.log(`[Equipment Update] Request for ID: ${req.params.id}`);
        console.log('[Equipment Update] Request body:', JSON.stringify(req.body, null, 2));

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('[Equipment Update] Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const equipmentId = req.params.id;
        const updateFields = [];
        const updateValues = [];

        // Get original equipment for change tracking
        const originalEquipment = await database.get(
            'SELECT * FROM equipment WHERE id = ?',
            [equipmentId]
        );

        if (!originalEquipment) {
            console.error(`[Equipment Update] Equipment not found for ID: ${equipmentId}`);
            return res.status(404).json({ error: 'Equipment not found' });
        }

        // Check if equipment is currently checked out
        const activeTransaction = await database.get(`
            SELECT id, transaction_type FROM transactions
            WHERE equipment_id = ? AND actual_return_date IS NULL
        `, [equipmentId]);

        // Prevent status changes if equipment is checked out
        if (activeTransaction && req.body.hasOwnProperty('status')) {
            return res.status(400).json({
                error: 'Cannot change status while equipment is checked out. Please check in the equipment first.'
            });
        }

        // Build dynamic update query
        const allowedFields = [
            'name', 'serial_number', 'barcode', 'model', 'manufacturer', 'category_id',
            'purchase_date', 'purchase_price', 'current_value', 'condition',
            'location', 'description', 'notes', 'status', 'included_in_kit', 'kit_contents', 'needs_relabeling'
        ];

        const changes = {};

        for (const field of allowedFields) {
            if (req.body.hasOwnProperty(field)) {
                updateFields.push(`${field} = ?`);
                updateValues.push(req.body[field]);

                // Track changes for activity log
                if (originalEquipment[field] !== req.body[field]) {
                    changes[field] = {
                        from: originalEquipment[field],
                        to: req.body[field]
                    };
                }
            }
        }

        // Check if barcode-affecting fields changed (category_id or purchase_date)
        // Regenerate barcode and compare - if different, update barcode and set relabeling flag
        const categoryChanged = req.body.hasOwnProperty('category_id') &&
            req.body.category_id !== originalEquipment.category_id;
        const purchaseDateChanged = req.body.hasOwnProperty('purchase_date') &&
            req.body.purchase_date !== originalEquipment.purchase_date;

        if ((categoryChanged || purchaseDateChanged) && !req.body.hasOwnProperty('needs_relabeling')) {
            console.log('[Equipment Update] Barcode-affecting fields changed - regenerating barcode');

            // Get category name for barcode generation
            const categoryId = req.body.category_id || originalEquipment.category_id;
            let categoryName = null;
            if (categoryId) {
                const category = await database.get('SELECT name FROM categories WHERE id = ?', [categoryId]);
                categoryName = category ? category.name : null;
            }

            // Regenerate barcode with new values
            const newBarcode = await generateBarcode(
                categoryName,
                req.body.purchase_date || originalEquipment.purchase_date,
                1, // Single item (multiples handled at creation only)
                originalEquipment.serial_number,
                1  // Total quantity
            );

            console.log(`[Equipment Update] Old barcode: ${originalEquipment.barcode}, New barcode: ${newBarcode}`);

            // If barcode changed, update it and set relabeling flag
            if (newBarcode !== originalEquipment.barcode) {
                console.log('[Equipment Update] Barcode changed - setting relabeling flag');

                // Update barcode field
                updateFields.push('barcode = ?');
                updateValues.push(newBarcode);

                // Set relabeling flag
                updateFields.push('needs_relabeling = ?');
                updateValues.push(1);

                // Track changes in activity log
                changes.barcode = {
                    from: originalEquipment.barcode,
                    to: newBarcode
                };
                changes.needs_relabeling = {
                    from: originalEquipment.needs_relabeling || false,
                    to: true
                };
            } else {
                console.log('[Equipment Update] Barcode unchanged - no relabeling needed');
            }
        }

        if (updateFields.length === 0) {
            console.error('[Equipment Update] No valid fields to update');
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        console.log('[Equipment Update] Fields to update:', updateFields);
        console.log('[Equipment Update] Values:', updateValues);

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(equipmentId);

        await database.run(`
            UPDATE equipment
            SET ${updateFields.join(', ')}
            WHERE id = ? AND is_active = 1
        `, updateValues);

        const updatedEquipment = await database.get(
            'SELECT * FROM equipment WHERE id = ?',
            [equipmentId]
        );

        console.log(`[Equipment Update] Successfully updated equipment ID: ${equipmentId}`);

        // Log activity if there were changes
        if (Object.keys(changes).length > 0) {
            await logActivity({
                user_id: req.body.updated_by || null,
                action: 'update',
                entity_type: 'equipment',
                entity_id: parseInt(equipmentId, 10),
                changes,
                ...getRequestInfo(req)
            });
        }

        res.json(updatedEquipment);

    } catch (error) {
        console.error('[Equipment Update] Error:', error);
        console.error('[Equipment Update] Stack trace:', error.stack);
        res.status(500).json({ error: error.message || 'Failed to update equipment' });
    }
});

// Soft delete equipment (admin or manager only)
router.delete('/:id', requireAdminOrManager, async (req, res) => {
    try {
        const equipmentId = req.params.id;

        // Check if equipment is currently checked out
        const currentTransaction = await database.get(`
            SELECT id FROM transactions 
            WHERE equipment_id = ? AND actual_return_date IS NULL
        `, [equipmentId]);

        if (currentTransaction) {
            return res.status(400).json({ 
                error: 'Cannot delete equipment that is currently checked out' 
            });
        }

        // Get equipment info before deleting
        const equipment = await database.get(
            'SELECT name, barcode FROM equipment WHERE id = ?',
            [equipmentId]
        );

        await database.run(
            'UPDATE equipment SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [equipmentId]
        );

        // Log activity
        await logActivity({
            user_id: req.body.deleted_by || null,
            action: 'delete',
            entity_type: 'equipment',
            entity_id: parseInt(equipmentId, 10),
            changes: { name: equipment.name, barcode: equipment.barcode },
            ...getRequestInfo(req)
        });

        res.json({ message: 'Equipment deleted successfully' });

    } catch (error) {
        console.error('Delete equipment error:', error);
        res.status(500).json({ error: 'Failed to delete equipment' });
    }
});

// Generate QR code for equipment
router.get('/:id/qrcode', async (req, res) => {
    try {
        const equipment = await database.get(
            'SELECT qr_code, name FROM equipment WHERE id = ? AND is_active = 1',
            [req.params.id]
        );

        if (!equipment) {
            return res.status(404).json({ error: 'Equipment not found' });
        }

        const qrCodeDataUrl = await generateQRImage(equipment.qr_code);

        res.json({
            qr_code: equipment.qr_code,
            qr_image: qrCodeDataUrl,
            equipment_name: equipment.name
        });

    } catch (error) {
        console.error('Generate QR code error:', error);
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

module.exports = router;