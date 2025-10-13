const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const database = require('../database/connection');
const { logActivity, getRequestInfo } = require('../utils/activityLogger');
const router = express.Router();

/**
 * POST /api/auth/verify-pin
 * Verify a user's PIN code
 */
router.post('/verify-pin', [
    body('pin').isString().isLength({ min: 4, max: 6 }).withMessage('PIN must be 4-6 digits')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { pin } = req.body;

        // Find user with this PIN
        const user = await database.get(`
            SELECT id, username, full_name, email, role, pin_code
            FROM users
            WHERE is_active = 1 AND pin_code IS NOT NULL
        `);

        if (!user) {
            await logActivity({
                action: 'login_failed',
                entity_type: 'auth',
                changes: { reason: 'no_users_with_pin' },
                ...getRequestInfo(req)
            });
            return res.status(401).json({ error: 'Invalid PIN' });
        }

        // Try to match against all users with PINs (in production, this would be optimized)
        const allUsers = await database.all(`
            SELECT id, username, full_name, email, role, department, pin_code
            FROM users
            WHERE is_active = 1 AND pin_code IS NOT NULL
        `);

        let matchedUser = null;
        for (const u of allUsers) {
            const isMatch = await bcrypt.compare(pin, u.pin_code);
            if (isMatch) {
                matchedUser = u;
                break;
            }
        }

        if (!matchedUser) {
            await logActivity({
                action: 'login_failed',
                entity_type: 'auth',
                changes: { reason: 'invalid_pin' },
                ...getRequestInfo(req)
            });
            return res.status(401).json({ error: 'Invalid PIN' });
        }

        // Log successful login
        await logActivity({
            user_id: matchedUser.id,
            action: 'login',
            entity_type: 'auth',
            changes: { username: matchedUser.username },
            ...getRequestInfo(req)
        });

        // Return user info (without PIN)
        const { pin_code, ...userInfo } = matchedUser;
        res.json({
            success: true,
            user_id: matchedUser.id,
            username: matchedUser.username,
            full_name: matchedUser.full_name,
            email: matchedUser.email,
            role: matchedUser.role,
            department: matchedUser.department
        });

    } catch (error) {
        console.error('[Auth] PIN verification error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

/**
 * POST /api/auth/set-pin
 * Set or update a user's PIN code
 * Requires user_id and new_pin
 */
router.post('/set-pin', [
    body('user_id').isInt().withMessage('User ID is required'),
    body('pin').isString().isLength({ min: 4, max: 6 }).withMessage('PIN must be 4-6 digits'),
    body('confirm_pin').isString().custom((value, { req }) => {
        if (value !== req.body.pin) {
            throw new Error('PIN confirmation does not match');
        }
        return true;
    })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { user_id, pin } = req.body;

        // Verify user exists
        const user = await database.get(
            'SELECT id, username FROM users WHERE id = ? AND is_active = 1',
            [user_id]
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Hash the PIN
        const hashedPin = await bcrypt.hash(pin, 10);

        // Update user's PIN
        await database.run(
            'UPDATE users SET pin_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hashedPin, user_id]
        );

        // Log PIN change
        await logActivity({
            user_id,
            action: 'pin_changed',
            entity_type: 'user',
            entity_id: user_id,
            changes: { username: user.username },
            ...getRequestInfo(req)
        });

        res.json({ success: true, message: 'PIN updated successfully' });

    } catch (error) {
        console.error('[Auth] Set PIN error:', error);
        res.status(500).json({ error: 'Failed to set PIN' });
    }
});

/**
 * GET /api/auth/check-pin-exists/:user_id
 * Check if a user has a PIN set
 */
router.get('/check-pin-exists/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;

        const user = await database.get(
            'SELECT id, pin_code FROM users WHERE id = ? AND is_active = 1',
            [user_id]
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ has_pin: !!user.pin_code });

    } catch (error) {
        console.error('[Auth] Check PIN exists error:', error);
        res.status(500).json({ error: 'Failed to check PIN status' });
    }
});

module.exports = router;
