const express = require('express');
const database = require('../database/connection');
const { getActivityLogs, getRecentActivity } = require('../utils/activityLogger');
const router = express.Router();

/**
 * Get recent activity logs
 * Returns all types of activity: checkouts, checkins, updates, imports
 */
router.get('/recent', async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const logs = await getRecentActivity(parseInt(limit));
        res.json(logs);
    } catch (error) {
        console.error('[Activity] Error fetching recent activity:', error);
        res.status(500).json({ error: 'Failed to fetch recent activity' });
    }
});

/**
 * Get batch details for a specific batch_id
 * Returns all equipment items in a checkout/checkin batch
 */
router.get('/batch/:batch_id', async (req, res) => {
    try {
        const { batch_id } = req.params;

        console.log(`[Activity] Fetching batch details for: ${batch_id}`);

        // Get all transactions in this batch
        const transactions = await database.all(`
            SELECT
                t.id, t.equipment_id, t.user_id, t.transaction_type,
                t.checkout_date, t.expected_return_date, t.actual_return_date,
                t.condition_on_checkout, t.condition_on_return, t.purpose, t.notes,
                t.created_at,
                e.name as equipment_name, e.serial_number, e.barcode, e.model, e.manufacturer,
                e.status as equipment_status, e.condition as equipment_condition,
                u.full_name as user_name, u.email as user_email,
                c.name as category_name, c.color as category_color
            FROM transactions t
            LEFT JOIN equipment e ON t.equipment_id = e.id
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN categories c ON e.category_id = c.id
            WHERE t.batch_id = ?
            ORDER BY t.created_at DESC, e.name ASC
        `, [batch_id]);

        if (transactions.length === 0) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        // Get activity log entry for this batch if it exists
        const activityLog = await database.get(`
            SELECT al.*, u.full_name as user_name, u.username
            FROM activity_log al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.changes_json LIKE ?
            ORDER BY al.created_at DESC
            LIMIT 1
        `, [`%"batch_id":"${batch_id}"%`]);

        res.json({
            batch_id: batch_id,
            transaction_type: transactions[0].transaction_type,
            transaction_count: transactions.length,
            user_name: transactions[0].user_name,
            user_email: transactions[0].user_email,
            created_at: transactions[0].created_at,
            purpose: transactions[0].purpose,
            transactions: transactions,
            activity_log: activityLog ? {
                ...activityLog,
                changes: activityLog.changes_json ? JSON.parse(activityLog.changes_json) : null
            } : null
        });

    } catch (error) {
        console.error('[Activity] Error fetching batch details:', error);
        res.status(500).json({ error: 'Failed to fetch batch details' });
    }
});

/**
 * Get activity logs with filters
 */
router.get('/', async (req, res) => {
    try {
        const {
            user_id,
            action,
            entity_type,
            entity_id,
            start_date,
            end_date,
            limit = 100
        } = req.query;

        const logs = await getActivityLogs({
            user_id: user_id ? parseInt(user_id) : null,
            action,
            entity_type,
            entity_id: entity_id ? parseInt(entity_id) : null,
            start_date,
            end_date,
            limit: parseInt(limit)
        });

        res.json(logs);
    } catch (error) {
        console.error('[Activity] Error fetching activity logs:', error);
        res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
});

module.exports = router;
