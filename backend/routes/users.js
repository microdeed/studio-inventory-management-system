const express = require('express');
const { body, validationResult } = require('express-validator');
const database = require('../database/connection');
const router = express.Router();

// Get all users
router.get('/', async (req, res) => {
    try {
        const { active_only = 'true' } = req.query;
        
        let query = `
            SELECT u.*, 
                COUNT(DISTINCT t.id) as total_checkouts,
                COUNT(DISTINCT CASE WHEN t.actual_return_date IS NULL THEN t.id END) as active_checkouts
            FROM users u
            LEFT JOIN transactions t ON u.id = t.user_id AND t.transaction_type = 'checkout'
        `;

        const params = [];
        
        if (active_only === 'true') {
            query += ' WHERE u.is_active = 1';
        }

        query += ' GROUP BY u.id ORDER BY u.full_name';

        const users = await database.all(query, params);
        
        // Remove sensitive data
        const safeUsers = users.map(user => {
            const { ...safeUser } = user;
            return safeUser;
        });

        res.json(safeUsers);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
    const userId = req.body.checked_by || req.body.user_id || req.headers['x-user-id'];

    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const user = await database.get('SELECT role FROM users WHERE id = ? AND is_active = 1', [userId]);

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        next();
    } catch (error) {
        console.error('[Auth] Error checking admin status:', error);
        return res.status(500).json({ error: 'Authentication error' });
    }
};

// Create user (admin only)
router.post('/', requireAdmin, [
    body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('full_name').trim().isLength({ min: 1 }).withMessage('Full name is required'),
    body('role').optional().isIn(['admin', 'user', 'manager']),
    body('department').optional().trim()
], async (req, res) => {
    try {
        console.log('[User Create] Request body:', JSON.stringify(req.body, null, 2));

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('[User Create] Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, full_name, role = 'user', phone, department } = req.body;

        const result = await database.run(`
            INSERT INTO users (username, email, full_name, role, phone, department)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [username, email, full_name, role, phone, department]);

        const newUser = await database.get(
            'SELECT * FROM users WHERE id = ?',
            [result.id]
        );

        console.log(`[User Create] Successfully created user ID: ${result.id}`);
        res.status(201).json(newUser);
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            console.warn('[User Create] Duplicate username or email');
            return res.status(400).json({ error: 'Username or email already exists' });
        }
        console.error('[User Create] Error:', error);
        console.error('[User Create] Stack trace:', error.stack);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Update user (admin only)
router.put('/:id', requireAdmin, [
    body('username').optional().trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('full_name').optional().trim().isLength({ min: 1 }).withMessage('Full name cannot be empty'),
    body('role').optional().isIn(['admin', 'user', 'manager']),
    body('department').optional({ nullable: true }).trim(),
    body('phone').optional({ nullable: true }).trim()
], async (req, res) => {
    try {
        console.log(`[User Update] Request for ID: ${req.params.id}`);
        console.log('[User Update] Request body:', JSON.stringify(req.body, null, 2));

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('[User Update] Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.params.id;
        const updateFields = [];
        const updateValues = [];

        // Build dynamic update query
        const allowedFields = ['username', 'email', 'full_name', 'role', 'phone', 'department'];

        for (const field of allowedFields) {
            if (req.body.hasOwnProperty(field)) {
                updateFields.push(`${field} = ?`);
                updateValues.push(req.body[field]);
            }
        }

        if (updateFields.length === 0) {
            console.error('[User Update] No valid fields to update');
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        console.log('[User Update] Fields to update:', updateFields);
        console.log('[User Update] Values:', updateValues);

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(userId);

        await database.run(`
            UPDATE users
            SET ${updateFields.join(', ')}
            WHERE id = ? AND is_active = 1
        `, updateValues);

        const updatedUser = await database.get(
            'SELECT * FROM users WHERE id = ?',
            [userId]
        );

        if (!updatedUser) {
            console.error(`[User Update] User not found for ID: ${userId}`);
            return res.status(404).json({ error: 'User not found' });
        }

        console.log(`[User Update] Successfully updated user ID: ${userId}`);
        res.json(updatedUser);

    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            console.warn('[User Update] Duplicate username or email');
            return res.status(400).json({ error: 'Username or email already exists' });
        }
        console.error('[User Update] Error:', error);
        console.error('[User Update] Stack trace:', error.stack);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user (soft delete, admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;

        // Check if user exists
        const user = await database.get(
            'SELECT * FROM users WHERE id = ? AND is_active = 1',
            [userId]
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if user has active checkouts
        const activeCheckouts = await database.get(
            `SELECT COUNT(*) as count FROM transactions
             WHERE user_id = ? AND transaction_type = 'checkout' AND actual_return_date IS NULL`,
            [userId]
        );

        if (activeCheckouts.count > 0) {
            return res.status(400).json({
                error: `Cannot delete user with active checkouts. User has ${activeCheckouts.count} equipment checked out.`
            });
        }

        // Soft delete: set is_active = 0
        await database.run(
            'UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [userId]
        );

        console.log(`[User Delete] Successfully deleted user ID: ${userId}`);
        res.json({ success: true, message: 'User deleted successfully' });

    } catch (error) {
        console.error('[User Delete] Error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

module.exports = router;