const express = require('express');
const { body, validationResult } = require('express-validator');
const database = require('../database/connection');
const { logActivity, getRequestInfo } = require('../utils/activityLogger');
const router = express.Router();

/**
 * Generate a unique batch ID for grouping transactions
 * Format: YYYYMMDD-HHMMSS-RANDOM
 */
function generateBatchId() {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').split('.')[0];
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${timestamp}-${random}`;
}

// Get transaction history
router.get('/', async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 50, 
            equipment_id, 
            user_id,
            type,
            start_date,
            end_date
        } = req.query;

        let baseQuery = `
            SELECT 
                t.id, t.equipment_id, t.user_id, t.transaction_type,
                t.checkout_date, t.expected_return_date, t.actual_return_date,
                t.condition_on_checkout, t.condition_on_return, t.notes,
                t.created_at,
                e.name as equipment_name, e.serial_number, e.model,
                u.full_name as user_name, u.email as user_email,
                cb.full_name as created_by_name,
                CASE 
                    WHEN t.actual_return_date IS NULL AND t.expected_return_date < datetime('now') THEN 1
                    ELSE 0
                END as is_overdue
            FROM transactions t
            LEFT JOIN equipment e ON t.equipment_id = e.id
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN users cb ON t.created_by = cb.id
            WHERE 1 = 1
        `;

        const params = [];

        if (equipment_id) {
            baseQuery += ` AND t.equipment_id = ?`;
            params.push(equipment_id);
        }

        if (user_id) {
            baseQuery += ` AND t.user_id = ?`;
            params.push(user_id);
        }

        if (type) {
            baseQuery += ` AND t.transaction_type = ?`;
            params.push(type);
        }

        if (start_date) {
            baseQuery += ` AND t.created_at >= ?`;
            params.push(start_date);
        }

        if (end_date) {
            baseQuery += ` AND t.created_at <= ?`;
            params.push(end_date);
        }

        baseQuery += ` ORDER BY t.created_at DESC`;

        const result = await database.paginate(baseQuery, params, parseInt(page), parseInt(limit));
        res.json(result);

    } catch (error) {
        console.error('[Transactions List] Error:', error);
        console.error('[Transactions List] Stack trace:', error.stack);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// Check out equipment (single or bulk)
router.post('/checkout', [
    body('equipment_id').custom((value) => {
        // Accept either single ID or array of IDs
        if (Array.isArray(value)) {
            return value.every(id => Number.isInteger(id));
        }
        return Number.isInteger(value);
    }).withMessage('Equipment ID(s) required'),
    body('user_id').isInt().withMessage('User ID is required'),
    body('expected_return_date').isISO8601().withMessage('Expected return date is required'),
    body('purpose').isIn(['events', 'marketing', 'personal']).withMessage('Purpose is required and must be one of: events, marketing, personal'),
    body('notes').optional().trim()
], async (req, res) => {
    try {
        console.log('[Checkout] Request body:', JSON.stringify(req.body, null, 2));

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('[Checkout] Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            equipment_id,
            user_id,
            expected_return_date,
            purpose,
            notes,
            created_by = user_id
        } = req.body;

        // Normalize to array for uniform processing
        const equipment_ids = Array.isArray(equipment_id) ? equipment_id : [equipment_id];

        // Generate batch ID for this checkout session
        const batch_id = generateBatchId();
        console.log(`[Checkout] Generated batch_id: ${batch_id} for ${equipment_ids.length} item(s)`);

        await database.beginTransaction();

        try {
            // Check if user exists
            const user = await database.get(
                'SELECT id, full_name FROM users WHERE id = ? AND is_active = 1',
                [user_id]
            );

            if (!user) {
                console.error(`[Checkout] User not found: ${user_id}`);
                throw new Error('User not found');
            }

            const transactions = [];
            const equipment_details = [];

            // Process each equipment item
            for (const equipId of equipment_ids) {
                // Check if equipment exists and is available
                const equipment = await database.get(`
                    SELECT e.id, e.name, e.condition, e.status as equipment_status,
                        CASE
                            WHEN t.equipment_id IS NULL THEN e.status
                            WHEN t.transaction_type = 'checkout' AND t.actual_return_date IS NULL THEN 'checked_out'
                            WHEN t.transaction_type = 'maintenance' AND t.actual_return_date IS NULL THEN 'maintenance'
                            ELSE e.status
                        END as status
                    FROM equipment e
                    LEFT JOIN (
                        SELECT DISTINCT equipment_id, transaction_type, actual_return_date
                        FROM transactions t1
                        WHERE t1.id = (
                            SELECT MAX(t2.id)
                            FROM transactions t2
                            WHERE t2.equipment_id = t1.equipment_id
                            AND t2.actual_return_date IS NULL
                        )
                    ) t ON e.id = t.equipment_id
                    WHERE e.id = ? AND e.is_active = 1
                `, [equipId]);

                if (!equipment) {
                    console.error(`[Checkout] Equipment not found: ${equipId}`);
                    throw new Error(`Equipment not found: ${equipId}`);
                }

                // Only allow checkout if status is 'available' or 'needs_maintenance'
                if (equipment.status !== 'available' && equipment.status !== 'needs_maintenance') {
                    console.error(`[Checkout] Equipment ${equipId} has status '${equipment.status}'`);
                    throw new Error(`Cannot checkout equipment '${equipment.name}' with status '${equipment.status}'. Equipment must be 'available' or 'needs_maintenance' to checkout.`);
                }

                console.log(`[Checkout] Checking out equipment ${equipId} (${equipment.name}) to user ${user_id}`);

                // Create checkout transaction with batch_id
                const result = await database.run(`
                    INSERT INTO transactions (
                        equipment_id, user_id, transaction_type, batch_id, checkout_date,
                        expected_return_date, purpose, notes, created_by
                    ) VALUES (?, ?, 'checkout', ?, datetime('now'), ?, ?, ?, ?)
                `, [equipId, user_id, batch_id, expected_return_date, purpose, notes, created_by]);

                transactions.push(result.id);
                equipment_details.push({
                    id: equipment.id,
                    name: equipment.name,
                    transaction_id: result.id
                });
            }

            // Log to activity_log for the entire batch
            const requestInfo = getRequestInfo(req);
            await logActivity({
                user_id: user_id,
                action: 'checkout',
                entity_type: 'transaction_batch',
                entity_id: null,
                changes: {
                    batch_id: batch_id,
                    count: equipment_ids.length,
                    equipment: equipment_details,
                    purpose: purpose,
                    expected_return_date: expected_return_date,
                    notes: notes
                },
                ip_address: requestInfo.ip_address,
                user_agent: requestInfo.user_agent
            });

            await database.commit();

            console.log(`[Checkout] Successfully created ${transactions.length} transaction(s) in batch ${batch_id}`);

            // Return summary for compatibility
            res.status(201).json({
                batch_id: batch_id,
                transaction_count: transactions.length,
                equipment_checked_out: equipment_details,
                user_name: user.full_name
            });

        } catch (error) {
            console.error('[Checkout] Transaction error:', error);
            await database.rollback();
            throw error;
        }

    } catch (error) {
        console.error('[Checkout] Error:', error);
        console.error('[Checkout] Stack trace:', error.stack);
        res.status(400).json({ error: error.message || 'Failed to checkout equipment' });
    }
});

// Check in equipment (single or bulk)
router.post('/checkin', [
    body('equipment_id').custom((value) => {
        // Accept either single ID or array of IDs
        if (Array.isArray(value)) {
            return value.every(id => Number.isInteger(id));
        }
        return Number.isInteger(value);
    }).withMessage('Equipment ID(s) required'),
    body('checked_in_by').isInt().withMessage('User ID (checked_in_by) is required for authentication'),
    body('return_location').optional().isIn(['studio', 'vault']).withMessage('Location must be studio or vault'),
    body('condition_on_return').optional().isIn(['brand_new', 'functional', 'normal', 'worn', 'out_of_commission', 'broken']),
    body('notes').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            equipment_id,
            checked_in_by,
            return_location = 'studio',
            condition_on_return, // Optional - may be undefined
            notes
        } = req.body;

        // Normalize to array for uniform processing
        const equipment_ids = Array.isArray(equipment_id) ? equipment_id : [equipment_id];

        // Generate batch ID for this checkin session
        const batch_id = generateBatchId();
        console.log(`[Checkin] Generated batch_id: ${batch_id} for ${equipment_ids.length} item(s)`);

        await database.beginTransaction();

        try {
            // Get the user checking in to verify permissions
            const checkingInUser = await database.get(
                'SELECT id, full_name, role FROM users WHERE id = ? AND is_active = 1',
                [checked_in_by]
            );

            if (!checkingInUser) {
                throw new Error('User checking in not found or inactive');
            }

            const isAdmin = checkingInUser.role === 'admin';
            const transactions = [];
            const equipment_details = [];

            // Process each equipment item
            for (const equipId of equipment_ids) {
                // Find the active checkout transaction
                const activeTransaction = await database.get(`
                    SELECT t.*, u.full_name as checked_out_user_name, e.name as equipment_name
                    FROM transactions t
                    LEFT JOIN users u ON t.user_id = u.id
                    LEFT JOIN equipment e ON t.equipment_id = e.id
                    WHERE t.equipment_id = ?
                    AND t.transaction_type = 'checkout'
                    AND t.actual_return_date IS NULL
                    ORDER BY t.checkout_date DESC
                    LIMIT 1
                `, [equipId]);

                if (!activeTransaction) {
                    throw new Error(`No active checkout found for equipment ID ${equipId}`);
                }

                // Verify that the user checking in is either:
                // 1. The same user who checked out the equipment
                // 2. An admin who can override
                const isOriginalUser = activeTransaction.user_id === checked_in_by;

                if (!isOriginalUser && !isAdmin) {
                    throw new Error(
                        `Only ${activeTransaction.checked_out_user_name} or an admin can check in this equipment. ` +
                        `'${activeTransaction.equipment_name}' was checked out by ${activeTransaction.checked_out_user_name}.`
                    );
                }

                console.log(`[Checkin] Checking in equipment ${equipId} (${activeTransaction.equipment_name})`);

                // Update the transaction with return information
                await database.run(`
                    UPDATE transactions
                    SET actual_return_date = datetime('now'),
                        condition_on_return = ?,
                        notes = CASE
                            WHEN notes IS NULL OR notes = '' THEN ?
                            ELSE notes || '\n--- Return Notes ---\n' || ?
                        END
                    WHERE id = ?
                `, [condition_on_return || null, notes, notes, activeTransaction.id]);

                // Update equipment: location and optionally condition
                if (condition_on_return) {
                    await database.run(`
                        UPDATE equipment
                        SET location = ?,
                            condition = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `, [return_location, condition_on_return, equipId]);
                } else {
                    await database.run(`
                        UPDATE equipment
                        SET location = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `, [return_location, equipId]);
                }

                transactions.push(activeTransaction.id);
                equipment_details.push({
                    id: equipId,
                    name: activeTransaction.equipment_name,
                    transaction_id: activeTransaction.id
                });
            }

            // Log to activity_log for the entire batch
            const requestInfo = getRequestInfo(req);
            await logActivity({
                user_id: checked_in_by,
                action: 'checkin',
                entity_type: 'transaction_batch',
                entity_id: null,
                changes: {
                    batch_id: batch_id,
                    count: equipment_ids.length,
                    equipment: equipment_details,
                    return_location: return_location,
                    condition_on_return: condition_on_return || null,
                    notes: notes
                },
                ip_address: requestInfo.ip_address,
                user_agent: requestInfo.user_agent
            });

            await database.commit();

            console.log(`[Checkin] Successfully checked in ${transactions.length} item(s) in batch ${batch_id}`);

            // Return summary
            res.json({
                batch_id: batch_id,
                transaction_count: transactions.length,
                equipment_checked_in: equipment_details,
                user_name: checkingInUser.full_name
            });

        } catch (error) {
            await database.rollback();
            throw error;
        }

    } catch (error) {
        console.error('Checkin error:', error);
        res.status(400).json({ error: error.message || 'Failed to checkin equipment' });
    }
});

// Get overdue equipment
router.get('/overdue', async (req, res) => {
    try {
        const overdue = await database.all(`
            SELECT 
                t.id, t.equipment_id, t.user_id, t.checkout_date, 
                t.expected_return_date,
                julianday('now') - julianday(t.expected_return_date) as days_overdue,
                e.name as equipment_name, e.serial_number,
                u.full_name as user_name, u.email as user_email, u.phone
            FROM transactions t
            LEFT JOIN equipment e ON t.equipment_id = e.id
            LEFT JOIN users u ON t.user_id = u.id
            WHERE t.transaction_type = 'checkout'
            AND t.actual_return_date IS NULL
            AND t.expected_return_date < datetime('now')
            ORDER BY t.expected_return_date ASC
        `);

        res.json(overdue);

    } catch (error) {
        console.error('Get overdue error:', error);
        res.status(500).json({ error: 'Failed to fetch overdue equipment' });
    }
});

module.exports = router;