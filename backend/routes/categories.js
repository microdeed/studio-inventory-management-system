const express = require('express');
const { body, validationResult } = require('express-validator');
const database = require('../database/connection');
const router = express.Router();

// Get all categories
router.get('/', async (req, res) => {
    try {
        const categories = await database.all(`
            SELECT c.*, COUNT(e.id) as equipment_count
            FROM categories c
            LEFT JOIN equipment e ON c.id = e.category_id AND e.is_active = 1
            GROUP BY c.id
            ORDER BY c.name
        `);

        res.json(categories);
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Create category
router.post('/', [
    body('name').trim().isLength({ min: 1 }).withMessage('Category name is required'),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color must be a valid hex color')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, description, color } = req.body;

        const result = await database.run(`
            INSERT INTO categories (name, description, color) VALUES (?, ?, ?)
        `, [name, description, color]);

        const newCategory = await database.get(
            'SELECT * FROM categories WHERE id = ?',
            [result.id]
        );

        res.status(201).json(newCategory);
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Category name already exists' });
        }
        console.error('Create category error:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

module.exports = router;