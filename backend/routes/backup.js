const express = require('express');
const database = require('../database/connection.js');
const backupScheduler = require('../utils/backupScheduler.js');
const backupManager = require('../utils/backupManager.js');
const router = express.Router();

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  const userId = req.body.user_id || req.headers['x-user-id'];

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
    console.error('[Backup Auth] Error checking admin status:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * GET /api/backup/status
 * Get backup system status
 */
router.get('/status', requireAdmin, async (req, res) => {
  try {
    const schedulerStatus = backupScheduler.getStatus();
    const backupStatus = await backupManager.getStatus();

    res.json({
      success: true,
      scheduler: schedulerStatus,
      backups: backupStatus
    });
  } catch (error) {
    console.error('[Backup API] Error getting backup status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get backup status'
    });
  }
});

/**
 * POST /api/backup/trigger
 * Manually trigger a backup
 */
router.post('/trigger', requireAdmin, async (req, res) => {
  try {
    const { force = false } = req.body;
    const userId = req.body.user_id || req.headers['x-user-id'];

    console.log(`[Backup API] Manual backup triggered by user ${userId}${force ? ' (forced)' : ''}`);

    const result = await backupScheduler.runBackup(force);

    // Log to activity log
    try {
      await database.run(
        `INSERT INTO activity_log (user_id, action, entity_type, changes_json) VALUES (?, ?, ?, ?)`,
        [
          userId,
          'BACKUP',
          'MANUAL',
          JSON.stringify({
            forced: force,
            success: result.success,
            skipped: result.skipped || false
          })
        ]
      );
    } catch (logError) {
      console.error('[Backup API] Failed to log manual backup:', logError);
    }

    if (result.skipped) {
      res.json({
        success: true,
        skipped: true,
        message: result.reason,
        result
      });
    } else if (result.success) {
      res.json({
        success: true,
        message: 'Backup completed successfully',
        result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Backup failed',
        result
      });
    }
  } catch (error) {
    console.error('[Backup API] Error triggering backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger backup'
    });
  }
});

module.exports = router;
