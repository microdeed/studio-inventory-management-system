const express = require('express');
const database = require('../database/connection');
const router = express.Router();

// Dashboard summary
router.get('/dashboard', async (req, res) => {
    try {
        const [
            totalEquipment,
            availableEquipment,
            checkedOutEquipment,
            maintenanceEquipment,
            overdueEquipment,
            totalUsers,
            totalCategories,
            recentActivity
        ] = await Promise.all([
            database.get('SELECT COUNT(*) as count FROM equipment WHERE is_active = 1'),
            database.get(`
                SELECT COUNT(*) as count FROM equipment e
                LEFT JOIN (
                    SELECT DISTINCT equipment_id FROM transactions t1
                    WHERE t1.id = (
                        SELECT MAX(t2.id) FROM transactions t2
                        WHERE t2.equipment_id = t1.equipment_id AND t2.actual_return_date IS NULL
                    )
                ) t ON e.id = t.equipment_id
                WHERE e.is_active = 1 AND t.equipment_id IS NULL
            `),
            database.get(`
                SELECT COUNT(*) as count FROM transactions t
                WHERE t.transaction_type = 'checkout' AND t.actual_return_date IS NULL
            `),
            database.get(`
                SELECT COUNT(*) as count FROM transactions t
                WHERE t.transaction_type = 'maintenance' AND t.actual_return_date IS NULL
            `),
            database.get(`
                SELECT COUNT(*) as count FROM transactions t
                WHERE t.transaction_type = 'checkout' 
                AND t.actual_return_date IS NULL 
                AND t.expected_return_date < datetime('now')
            `),
            database.get('SELECT COUNT(*) as count FROM users WHERE is_active = 1'),
            database.get('SELECT COUNT(*) as count FROM categories'),
            database.all(`
                SELECT t.transaction_type, t.created_at, t.purpose,
                       e.name as equipment_name, u.full_name as user_name
                FROM transactions t
                LEFT JOIN equipment e ON t.equipment_id = e.id
                LEFT JOIN users u ON t.user_id = u.id
                ORDER BY t.created_at DESC
                LIMIT 10
            `)
        ]);

        res.json({
            summary: {
                total_equipment: totalEquipment.count,
                available_equipment: availableEquipment.count,
                checked_out_equipment: checkedOutEquipment.count,
                maintenance_equipment: maintenanceEquipment.count,
                overdue_equipment: overdueEquipment.count,
                total_users: totalUsers.count,
                total_categories: totalCategories.count
            },
            recent_activity: recentActivity
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// Equipment utilization report
router.get('/utilization', async (req, res) => {
    try {
        const utilization = await database.all(`
            SELECT 
                e.id, e.name, e.serial_number,
                COUNT(t.id) as total_checkouts,
                AVG(julianday(COALESCE(t.actual_return_date, datetime('now'))) - julianday(t.checkout_date)) as avg_checkout_days,
                SUM(julianday(COALESCE(t.actual_return_date, datetime('now'))) - julianday(t.checkout_date)) as total_days_out,
                MAX(t.checkout_date) as last_checkout
            FROM equipment e
            LEFT JOIN transactions t ON e.id = t.equipment_id AND t.transaction_type = 'checkout'
            WHERE e.is_active = 1
            GROUP BY e.id
            ORDER BY total_checkouts DESC
        `);

        res.json(utilization);
    } catch (error) {
        console.error('Utilization report error:', error);
        res.status(500).json({ error: 'Failed to fetch utilization report' });
    }
});

module.exports = router;