const express = require('express');
const { body, validationResult } = require('express-validator');
const database = require('../database/connection');
const router = express.Router();

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

// Check out equipment
router.post('/checkout', [
    body('equipment_id').isInt().withMessage('Equipment ID is required'),
    body('user_id').isInt().withMessage('User ID is required'),
    body('expected_return_date').isISO8601().withMessage('Expected return date is required'),
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
            notes,
            created_by = user_id
        } = req.body;

        await database.beginTransaction();

        try {
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
            `, [equipment_id]);

            if (!equipment) {
                console.error(`[Checkout] Equipment not found: ${equipment_id}`);
                throw new Error('Equipment not found');
            }

            // Only allow checkout if status is 'available' or 'needs_maintenance'
            if (equipment.status !== 'available' && equipment.status !== 'needs_maintenance') {
                console.error(`[Checkout] Equipment ${equipment_id} has status '${equipment.status}' (not available or needs_maintenance)`);
                throw new Error(`Cannot checkout equipment with status '${equipment.status}'. Equipment must be 'available' or 'needs_maintenance' to checkout.`);
            }

            // Check if user exists
            const user = await database.get(
                'SELECT id, full_name FROM users WHERE id = ? AND is_active = 1',
                [user_id]
            );

            if (!user) {
                console.error(`[Checkout] User not found: ${user_id}`);
                throw new Error('User not found');
            }

            console.log(`[Checkout] Checking out equipment ${equipment_id} to user ${user_id}`);


            // Create checkout transaction
            const result = await database.run(`
                INSERT INTO transactions (
                    equipment_id, user_id, transaction_type, checkout_date,
                    expected_return_date, notes, created_by
                ) VALUES (?, ?, 'checkout', datetime('now'), ?, ?, ?)
            `, [equipment_id, user_id, expected_return_date, notes, created_by]);

            await database.commit();

            console.log(`[Checkout] Successfully created transaction ID: ${result.id}`);

            // Fetch the created transaction with related data
            const transaction = await database.get(`
                SELECT 
                    t.*, e.name as equipment_name, u.full_name as user_name
                FROM transactions t
                LEFT JOIN equipment e ON t.equipment_id = e.id
                LEFT JOIN users u ON t.user_id = u.id
                WHERE t.id = ?
            `, [result.id]);

            res.status(201).json(transaction);

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

// Check in equipment
router.post('/checkin', [
    body('equipment_id').isInt().withMessage('Equipment ID is required'),
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

        await database.beginTransaction();

        try {
            // Find the active checkout transaction
            const activeTransaction = await database.get(`
                SELECT t.*, u.full_name as checked_out_user_name
                FROM transactions t
                LEFT JOIN users u ON t.user_id = u.id
                WHERE t.equipment_id = ?
                AND t.transaction_type = 'checkout'
                AND t.actual_return_date IS NULL
                ORDER BY t.checkout_date DESC
                LIMIT 1
            `, [equipment_id]);

            if (!activeTransaction) {
                throw new Error('No active checkout found for this equipment');
            }

            // Get the user checking in to verify permissions
            const checkingInUser = await database.get(
                'SELECT id, full_name, role FROM users WHERE id = ? AND is_active = 1',
                [checked_in_by]
            );

            if (!checkingInUser) {
                throw new Error('User checking in not found or inactive');
            }

            // Verify that the user checking in is either:
            // 1. The same user who checked out the equipment
            // 2. An admin or manager who can override
            const isOriginalUser = activeTransaction.user_id === checked_in_by;
            const isAdminOrManager = checkingInUser.role === 'admin' || checkingInUser.role === 'manager';

            if (!isOriginalUser && !isAdminOrManager) {
                throw new Error(
                    `Only ${activeTransaction.checked_out_user_name} or an admin/manager can check in this equipment. ` +
                    `This equipment was checked out by ${activeTransaction.checked_out_user_name}.`
                );
            }

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
            // If condition_on_return is provided, update the condition; otherwise leave it unchanged
            if (condition_on_return) {
                await database.run(`
                    UPDATE equipment
                    SET location = ?,
                        condition = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [return_location, condition_on_return, equipment_id]);
            } else {
                // Only update location if no condition specified
                await database.run(`
                    UPDATE equipment
                    SET location = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [return_location, equipment_id]);
            }

            await database.commit();

            // Fetch the updated transaction
            const transaction = await database.get(`
                SELECT 
                    t.*, e.name as equipment_name, u.full_name as user_name
                FROM transactions t
                LEFT JOIN equipment e ON t.equipment_id = e.id
                LEFT JOIN users u ON t.user_id = u.id
                WHERE t.id = ?
            `, [activeTransaction.id]);

            res.json(transaction);

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