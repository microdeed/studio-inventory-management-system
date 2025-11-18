const express = require('express');
const { body, validationResult } = require('express-validator');
const database = require('../database/connection');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Load version from version.json
function getVersionFromFile() {
    try {
        const versionPath = path.join(__dirname, '..', 'version.json');
        const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
        return versionData;
    } catch (error) {
        console.error('Error reading version.json:', error);
        return { version: '1.0.0', lastUpdated: new Date().toISOString() };
    }
}

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
    const userId = req.body.created_by || req.headers['x-user-id'];

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
        console.error('[Version Auth] Error checking admin status:', error);
        return res.status(500).json({ error: 'Authentication error' });
    }
};

// GET /api/version - Returns current version and latest release notes
router.get('/', async (req, res) => {
    try {
        const versionInfo = getVersionFromFile();

        // Get latest release note from database
        const latestNote = await database.get(
            'SELECT * FROM release_notes ORDER BY release_date DESC, created_at DESC LIMIT 1'
        );

        res.json({
            version: versionInfo.version,
            lastUpdated: versionInfo.lastUpdated,
            latestReleaseNotes: latestNote || null
        });
    } catch (error) {
        console.error('Get version error:', error);
        // Fallback to file version if database query fails
        const versionInfo = getVersionFromFile();
        res.json({
            version: versionInfo.version,
            lastUpdated: versionInfo.lastUpdated,
            latestReleaseNotes: null
        });
    }
});

// GET /api/release-notes - Returns all release notes
router.get('/release-notes', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        const result = await database.paginate(
            'SELECT * FROM release_notes ORDER BY release_date DESC, created_at DESC',
            [],
            parseInt(page),
            parseInt(limit)
        );

        res.json(result);
    } catch (error) {
        console.error('Get release notes error:', error);
        res.status(500).json({ error: 'Failed to fetch release notes' });
    }
});

// GET /api/release-notes/:version - Get specific version notes
router.get('/release-notes/:version', async (req, res) => {
    try {
        const { version } = req.params;

        const note = await database.get(
            'SELECT * FROM release_notes WHERE version = ?',
            [version]
        );

        if (!note) {
            return res.status(404).json({ error: 'Release notes not found for this version' });
        }

        res.json(note);
    } catch (error) {
        console.error('Get release note by version error:', error);
        res.status(500).json({ error: 'Failed to fetch release note' });
    }
});

// POST /api/release-notes - Create new release note (admin only)
router.post('/release-notes', requireAdmin, [
    body('version').trim().matches(/^\d+\.\d+\.\d+$/).withMessage('Version must be in semver format (e.g., 1.0.0)'),
    body('notes').trim().isLength({ min: 1 }).withMessage('Release notes are required'),
    body('release_date').optional().isISO8601().withMessage('Release date must be in ISO format')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { version, notes, release_date } = req.body;
        const created_by = req.body.created_by || req.headers['x-user-id'];

        // Check if version already exists
        const existing = await database.get('SELECT id FROM release_notes WHERE version = ?', [version]);
        if (existing) {
            return res.status(409).json({ error: 'Release notes for this version already exist' });
        }

        const result = await database.run(
            `INSERT INTO release_notes (version, notes, release_date, created_by)
             VALUES (?, ?, ?, ?)`,
            [version, notes, release_date || new Date().toISOString().split('T')[0], created_by]
        );

        const newNote = await database.get('SELECT * FROM release_notes WHERE id = ?', [result.id]);

        res.status(201).json(newNote);
    } catch (error) {
        console.error('Create release note error:', error);
        res.status(500).json({ error: 'Failed to create release note' });
    }
});

// PUT /api/release-notes/:id - Update release note (admin only)
router.put('/release-notes/:id', requireAdmin, [
    body('notes').trim().isLength({ min: 1 }).withMessage('Release notes are required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { notes } = req.body;

        const result = await database.run(
            'UPDATE release_notes SET notes = ? WHERE id = ?',
            [notes, id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Release note not found' });
        }

        const updatedNote = await database.get('SELECT * FROM release_notes WHERE id = ?', [id]);
        res.json(updatedNote);
    } catch (error) {
        console.error('Update release note error:', error);
        res.status(500).json({ error: 'Failed to update release note' });
    }
});

// DELETE /api/release-notes/:id - Delete release note (admin only)
router.delete('/release-notes/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await database.run('DELETE FROM release_notes WHERE id = ?', [id]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Release note not found' });
        }

        res.json({ message: 'Release note deleted successfully' });
    } catch (error) {
        console.error('Delete release note error:', error);
        res.status(500).json({ error: 'Failed to delete release note' });
    }
});

module.exports = router;
