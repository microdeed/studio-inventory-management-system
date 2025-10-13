/**
 * Activity Logger Utility
 * Logs all user actions to database and file
 */

const database = require('../database/connection');
const fs = require('fs').promises;
const path = require('path');

const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'activity.log');

/**
 * Ensure logs directory exists
 */
async function ensureLogDir() {
    try {
        await fs.mkdir(LOG_DIR, { recursive: true });
    } catch (error) {
        console.error('[Activity Logger] Failed to create log directory:', error);
    }
}

/**
 * Write to log file
 * @param {string} message - Log message
 */
async function writeToFile(message) {
    try {
        await ensureLogDir();
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}\n`;
        await fs.appendFile(LOG_FILE, logEntry, 'utf8');
    } catch (error) {
        console.error('[Activity Logger] Failed to write to file:', error);
    }
}

/**
 * Get daily log file path
 * @returns {string} Log file path for today
 */
function getDailyLogFile() {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(LOG_DIR, `activity-${date}.log`);
}

/**
 * Log activity to database and file
 * @param {object} params - Activity parameters
 * @param {number} params.user_id - User ID performing the action
 * @param {string} params.action - Action type (create, update, delete, checkout, checkin)
 * @param {string} params.entity_type - Entity type (equipment, user, transaction)
 * @param {number} params.entity_id - Entity ID
 * @param {object} params.changes - Object containing changes made
 * @param {string} params.ip_address - IP address (optional)
 * @param {string} params.user_agent - User agent (optional)
 */
async function logActivity({
    user_id,
    action,
    entity_type,
    entity_id,
    changes = null,
    ip_address = null,
    user_agent = null
}) {
    try {
        // Validate required fields
        if (!action || !entity_type) {
            console.error('[Activity Logger] Missing required fields');
            return;
        }

        // Convert changes to JSON string
        const changes_json = changes ? JSON.stringify(changes) : null;

        // Insert into database
        await database.run(`
            INSERT INTO activity_log (
                user_id, action, entity_type, entity_id,
                changes_json, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [user_id, action, entity_type, entity_id, changes_json, ip_address, user_agent]);

        // Write to daily log file
        const logMessage = `User ${user_id || 'SYSTEM'} ${action} ${entity_type} ${entity_id || 'N/A'}${changes ? ` - ${JSON.stringify(changes)}` : ''}`;
        await writeToFile(logMessage);

        console.log(`[Activity Logger] Logged: ${logMessage}`);
    } catch (error) {
        console.error('[Activity Logger] Failed to log activity:', error);
        // Don't throw - logging failures shouldn't break the app
    }
}

/**
 * Get activity logs with filters
 * @param {object} filters - Filter parameters
 * @param {number} filters.user_id - Filter by user ID
 * @param {string} filters.action - Filter by action
 * @param {string} filters.entity_type - Filter by entity type
 * @param {number} filters.entity_id - Filter by entity ID
 * @param {string} filters.start_date - Start date (ISO string)
 * @param {string} filters.end_date - End date (ISO string)
 * @param {number} filters.limit - Limit results (default 100)
 * @returns {Promise<Array>} Activity logs
 */
async function getActivityLogs({
    user_id = null,
    action = null,
    entity_type = null,
    entity_id = null,
    start_date = null,
    end_date = null,
    limit = 100
} = {}) {
    try {
        let query = `
            SELECT
                al.id, al.user_id, al.action, al.entity_type, al.entity_id,
                al.changes_json, al.ip_address, al.user_agent, al.created_at,
                u.full_name as user_name, u.username
            FROM activity_log al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE 1 = 1
        `;
        const params = [];

        if (user_id) {
            query += ` AND al.user_id = ?`;
            params.push(user_id);
        }

        if (action) {
            query += ` AND al.action = ?`;
            params.push(action);
        }

        if (entity_type) {
            query += ` AND al.entity_type = ?`;
            params.push(entity_type);
        }

        if (entity_id) {
            query += ` AND al.entity_id = ?`;
            params.push(entity_id);
        }

        if (start_date) {
            query += ` AND al.created_at >= ?`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND al.created_at <= ?`;
            params.push(end_date);
        }

        query += ` ORDER BY al.created_at DESC LIMIT ?`;
        params.push(limit);

        const logs = await database.all(query, params);

        // Parse changes_json
        return logs.map(log => ({
            ...log,
            changes: log.changes_json ? JSON.parse(log.changes_json) : null
        }));
    } catch (error) {
        console.error('[Activity Logger] Failed to get activity logs:', error);
        return [];
    }
}

/**
 * Get recent activity for dashboard
 * @param {number} limit - Number of recent activities to fetch
 * @returns {Promise<Array>} Recent activities
 */
async function getRecentActivity(limit = 20) {
    return getActivityLogs({ limit });
}

/**
 * Express middleware to capture request info
 * @param {object} req - Express request
 * @returns {object} Request info (ip, user agent)
 */
function getRequestInfo(req) {
    return {
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.get('user-agent') || null
    };
}

module.exports = {
    logActivity,
    getActivityLogs,
    getRecentActivity,
    getRequestInfo,
    ensureLogDir
};
