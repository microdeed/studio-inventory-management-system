/**
 * Role-based permissions middleware
 *
 * Usage:
 * - requireAuth: Requires any authenticated user
 * - requireAdmin: Requires admin role
 * - requireManager: Requires manager or admin role
 */

const database = require('../database/connection');

/**
 * Middleware to verify user is authenticated
 * Expects user_id in request body or headers
 */
const requireAuth = async (req, res, next) => {
    try {
        // Check for user_id in body, query, or custom header
        const userId = req.body.created_by ||
                       req.body.user_id ||
                       req.body.checked_in_by ||
                       req.query.user_id ||
                       req.headers['x-user-id'];

        if (!userId) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'User ID not provided'
            });
        }

        // Verify user exists and is active
        const user = await database.get(
            'SELECT id, username, full_name, email, role, department FROM users WHERE id = ? AND is_active = 1',
            [userId]
        );

        if (!user) {
            return res.status(401).json({
                error: 'Authentication failed',
                message: 'User not found or inactive'
            });
        }

        // Attach user to request
        req.user = user;
        next();

    } catch (error) {
        console.error('[Auth Middleware] Error:', error);
        res.status(500).json({ error: 'Authentication check failed' });
    }
};

/**
 * Middleware to require admin role
 * Must be used after requireAuth
 */
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'User must be authenticated'
        });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Permission denied',
            message: 'Admin access required'
        });
    }

    next();
};

/**
 * Middleware to require manager or admin role
 * Must be used after requireAuth
 */
const requireManager = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'User must be authenticated'
        });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
        return res.status(403).json({
            error: 'Permission denied',
            message: 'Manager or admin access required'
        });
    }

    next();
};

/**
 * Helper function to check if user can edit
 * Currently only admins can edit
 */
const canEdit = (user) => {
    return user && user.role === 'admin';
};

/**
 * Helper function to check if user can view
 * All authenticated users can view
 */
const canView = (user) => {
    return user && user.role in ['admin', 'manager', 'user'];
};

module.exports = {
    requireAuth,
    requireAdmin,
    requireManager,
    canEdit,
    canView
};
