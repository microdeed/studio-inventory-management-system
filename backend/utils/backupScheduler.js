const cron = require('node-cron');
const backupManager = require('./backupManager.js');

/**
 * Backup Scheduler
 * Schedules automatic database backups every 5 hours (conditional on database updates)
 */
class BackupScheduler {
  constructor() {
    this.cronJob = null;
    this.isRunning = false;
    // Cron expression: Run every 5 hours (at minute 0)
    // 0 */5 * * * means: at minute 0, every 5 hours
    this.cronExpression = '0 */5 * * *';
  }

  /**
   * Start the backup scheduler
   */
  async start() {
    try {
      console.log('[Backup Scheduler] Initializing backup scheduler...');

      // Initialize backup manager
      const initialized = await backupManager.initialize();
      if (!initialized) {
        console.error('[Backup Scheduler] Failed to initialize backup manager');
        return false;
      }

      // Schedule cron job
      this.cronJob = cron.schedule(this.cronExpression, async () => {
        console.log('[Backup Scheduler] Scheduled backup check triggered');
        await this.runBackup();
      }, {
        scheduled: true,
        timezone: "America/Chicago" // Central Time - adjust as needed
      });

      this.isRunning = true;
      console.log(`[Backup Scheduler] Backup scheduler started successfully`);
      console.log(`[Backup Scheduler] Schedule: Every 5 hours (${this.cronExpression})`);
      console.log(`[Backup Scheduler] Next check: ${this.getNextRunTime()}`);

      // Optionally run an immediate backup check on startup (uncomment if desired)
      // console.log('[Backup Scheduler] Running initial backup check...');
      // await this.runBackup();

      return true;
    } catch (error) {
      console.error('[Backup Scheduler] Failed to start backup scheduler:', error);
      return false;
    }
  }

  /**
   * Stop the backup scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.isRunning = false;
      console.log('[Backup Scheduler] Backup scheduler stopped');
    }
  }

  /**
   * Run a backup (called by cron job or manually)
   */
  async runBackup(force = false) {
    try {
      const result = await backupManager.performBackup(force);

      if (result.skipped) {
        console.log('[Backup Scheduler] Backup skipped:', result.reason);
      } else if (result.success) {
        console.log('[Backup Scheduler] Backup completed successfully');
      } else {
        console.error('[Backup Scheduler] Backup failed:', result.error);
      }

      return result;
    } catch (error) {
      console.error('[Backup Scheduler] Error running backup:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get the next scheduled run time
   */
  getNextRunTime() {
    if (!this.cronJob) {
      return 'Not scheduled';
    }

    // Calculate next run time based on current time
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Next run is at the next multiple of 5 hours at minute 0
    let nextHour = Math.ceil((currentHour + (currentMinute > 0 ? 1 : 0)) / 5) * 5;
    const nextDate = new Date(now);

    if (nextHour >= 24) {
      nextDate.setDate(nextDate.getDate() + 1);
      nextHour = nextHour % 24;
    }

    nextDate.setHours(nextHour, 0, 0, 0);

    return nextDate.toISOString();
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      cronExpression: this.cronExpression,
      nextRunTime: this.getNextRunTime()
    };
  }
}

// Export singleton instance
const backupScheduler = new BackupScheduler();
module.exports = backupScheduler;
