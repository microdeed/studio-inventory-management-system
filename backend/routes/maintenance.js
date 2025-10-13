const express = require('express');
const { body, validationResult } = require('express-validator');
const database = require('../database/connection');
const router = express.Router();

// Get maintenance records
router.get('/', async (req, res) => {
    try {
        const { equipment_id, page = 1, limit = 50 } = req.query;

        let baseQuery = `
            SELECT m.*, e.name as equipment_name, e.serial_number,
                   u.full_name as created_by_name
            FROM maintenance_records m
            LEFT JOIN equipment e ON m.equipment_id = e.id
            LEFT JOIN users u ON m.created_by = u.id
            WHERE 1 = 1
        `;

        const params = [];

        if (equipment_id) {
            baseQuery += ` AND m.equipment_id = ?`;
            params.push(equipment_id);
        }

        baseQuery += ` ORDER BY m.performed_date DESC`;

        const result = await database.paginate(baseQuery, params, parseInt(page), parseInt(limit));
        res.json(result);
    } catch (error) {
        console.error('Get maintenance error:', error);
        res.status(500).json({ error: 'Failed to fetch maintenance records' });
    }
});

// Create maintenance record
router.post('/', [
    body('equipment_id').isInt().withMessage('Equipment ID is required'),
    body('maintenance_type').isIn(['routine', 'repair', 'calibration', 'upgrade']).withMessage('Invalid maintenance type'),
    body('description').trim().isLength({ min: 1 }).withMessage('Description is required'),
    body('performed_date').isISO8601().withMessage('Performed date is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            equipment_id, maintenance_type, description, cost,
            performed_by, performed_date, next_maintenance_date,
            notes, created_by
        } = req.body;

        const result = await database.run(`
            INSERT INTO maintenance_records (
                equipment_id, maintenance_type, description, cost,
                performed_by, performed_date, next_maintenance_date,
                notes, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            equipment_id, maintenance_type, description, cost,
            performed_by, performed_date, next_maintenance_date,
            notes, created_by
        ]);

        const newRecord = await database.get(
            'SELECT * FROM maintenance_records WHERE id = ?',
            [result.id]
        );

        res.status(201).json(newRecord);
    } catch (error) {
        console.error('Create maintenance error:', error);
        res.status(500).json({ error: 'Failed to create maintenance record' });
    }
});

module.exports = router;