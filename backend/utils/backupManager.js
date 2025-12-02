const fs = require('fs').promises;
const path = require('path');
const nodemailer = require('nodemailer');
const database = require('../database/connection.js');

/**
 * Backup Manager
 * Handles database backup creation, storage, email delivery, and cleanup
 */
class BackupManager {
  constructor() {
    this.backupDir = path.join(__dirname, '..', 'backups');
    this.dbPath = process.env.DB_PATH || './database/inventory.db';
    this.retentionCount = parseInt(process.env.BACKUP_RETENTION_COUNT) || 7;

    // Email configuration
    this.emailEnabled = process.env.BACKUP_EMAIL_ENABLED === 'true';
    this.emailConfig = {
      host: process.env.BACKUP_EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.BACKUP_EMAIL_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.BACKUP_EMAIL_USER,
        pass: process.env.BACKUP_EMAIL_PASSWORD
      }
    };
    this.emailTo = process.env.BACKUP_EMAIL_TO;

    this.lastBackupTime = null;
  }

  /**
   * Initialize backup directory
   */
  async initialize() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      console.log(`[Backup] Backup directory initialized: ${this.backupDir}`);

      // Load last backup time
      const backups = await this.getBackupFiles();
      if (backups.length > 0) {
        const lastBackup = backups[0]; // Most recent
        const stats = await fs.stat(path.join(this.backupDir, lastBackup));
        this.lastBackupTime = stats.mtime;
        console.log(`[Backup] Last backup was at: ${this.lastBackupTime.toISOString()}`);
      }

      return true;
    } catch (error) {
      console.error('[Backup] Failed to initialize backup directory:', error);
      return false;
    }
  }

  /**
   * Get database file modification time
   */
  async getDatabaseModificationTime() {
    try {
      const dbFullPath = path.resolve(this.dbPath);
      const stats = await fs.stat(dbFullPath);
      return stats.mtime;
    } catch (error) {
      console.error('[Backup] Failed to get database modification time:', error);
      return null;
    }
  }

  /**
   * Check if database has been modified since last backup
   */
  async isDatabaseModified() {
    const dbModTime = await this.getDatabaseModificationTime();

    if (!dbModTime) {
      return false;
    }

    if (!this.lastBackupTime) {
      console.log('[Backup] No previous backup found, database needs backup');
      return true;
    }

    const isModified = dbModTime > this.lastBackupTime;

    if (isModified) {
      console.log(`[Backup] Database modified at ${dbModTime.toISOString()}, last backup at ${this.lastBackupTime.toISOString()}`);
    } else {
      console.log('[Backup] Database not modified since last backup');
    }

    return isModified;
  }

  /**
   * Create a backup of the database
   */
  async createBackup() {
    const timestamp = new Date().toISOString()
      .replace(/:/g, '-')
      .replace(/\..+/, '')
      .replace('T', '-');
    const backupFileName = `inventory-backup-${timestamp}.db`;
    const backupPath = path.join(this.backupDir, backupFileName);

    try {
      console.log(`[Backup] Creating backup: ${backupFileName}`);

      // Use SQLite VACUUM INTO for safe backup (handles WAL mode properly)
      await database.run(`VACUUM INTO ?`, [backupPath]);

      // Verify backup was created
      const stats = await fs.stat(backupPath);
      const backupSizeKB = (stats.size / 1024).toFixed(2);

      console.log(`[Backup] Backup created successfully: ${backupFileName} (${backupSizeKB} KB)`);

      // Update last backup time
      this.lastBackupTime = new Date();

      return {
        success: true,
        fileName: backupFileName,
        filePath: backupPath,
        size: stats.size,
        timestamp: this.lastBackupTime
      };

    } catch (error) {
      console.error('[Backup] Failed to create backup:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send backup via email
   */
  async sendBackupEmail(backupInfo) {
    if (!this.emailEnabled) {
      console.log('[Backup] Email delivery disabled');
      return { success: true, skipped: true };
    }

    if (!this.emailConfig.auth.user || !this.emailConfig.auth.pass || !this.emailTo) {
      console.error('[Backup] Email configuration incomplete, skipping email delivery');
      return { success: false, error: 'Email configuration incomplete' };
    }

    try {
      console.log(`[Backup] Sending backup via email to ${this.emailTo}`);

      // Create transporter
      const transporter = nodemailer.createTransport(this.emailConfig);

      // Read backup file
      const backupData = await fs.readFile(backupInfo.filePath);
      const backupSizeMB = (backupInfo.size / 1024 / 1024).toFixed(2);

      // Send email with attachment
      const info = await transporter.sendMail({
        from: this.emailConfig.auth.user,
        to: this.emailTo,
        subject: `Inventory Database Backup - ${new Date().toLocaleDateString()}`,
        text: `Automated database backup created at ${backupInfo.timestamp.toISOString()}\n\n` +
              `Backup file: ${backupInfo.fileName}\n` +
              `Size: ${backupSizeMB} MB\n\n` +
              `This backup was automatically generated by the Inventory Management System.`,
        html: `<h2>Inventory Database Backup</h2>
               <p>Automated database backup created at <strong>${backupInfo.timestamp.toISOString()}</strong></p>
               <ul>
                 <li><strong>File:</strong> ${backupInfo.fileName}</li>
                 <li><strong>Size:</strong> ${backupSizeMB} MB</li>
               </ul>
               <p><em>This backup was automatically generated by the Inventory Management System.</em></p>`,
        attachments: [
          {
            filename: backupInfo.fileName,
            content: backupData
          }
        ]
      });

      console.log(`[Backup] Email sent successfully: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId
      };

    } catch (error) {
      console.error('[Backup] Failed to send backup email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get list of backup files sorted by date (newest first)
   */
  async getBackupFiles() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(f => f.startsWith('inventory-backup-') && f.endsWith('.db'));

      // Sort by name (which includes timestamp) in descending order
      backupFiles.sort((a, b) => b.localeCompare(a));

      return backupFiles;
    } catch (error) {
      console.error('[Backup] Failed to list backup files:', error);
      return [];
    }
  }

  /**
   * Clean up old backups (keep only last N backups)
   */
  async cleanupOldBackups() {
    try {
      const backupFiles = await this.getBackupFiles();

      if (backupFiles.length <= this.retentionCount) {
        console.log(`[Backup] ${backupFiles.length} backups found, retention policy: ${this.retentionCount}, no cleanup needed`);
        return { success: true, deleted: 0 };
      }

      // Delete old backups
      const filesToDelete = backupFiles.slice(this.retentionCount);
      let deletedCount = 0;

      for (const file of filesToDelete) {
        try {
          const filePath = path.join(this.backupDir, file);
          await fs.unlink(filePath);
          console.log(`[Backup] Deleted old backup: ${file}`);
          deletedCount++;
        } catch (error) {
          console.error(`[Backup] Failed to delete ${file}:`, error);
        }
      }

      console.log(`[Backup] Cleanup complete: deleted ${deletedCount} old backups`);

      return {
        success: true,
        deleted: deletedCount
      };

    } catch (error) {
      console.error('[Backup] Failed to cleanup old backups:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Perform full backup operation (create, email, cleanup)
   */
  async performBackup(force = false) {
    try {
      console.log('[Backup] Starting backup operation...');

      // Check if backup is needed (unless forced)
      if (!force) {
        const isModified = await this.isDatabaseModified();
        if (!isModified) {
          console.log('[Backup] Database not modified, skipping backup');
          return {
            success: true,
            skipped: true,
            reason: 'Database not modified since last backup'
          };
        }
      }

      // Create backup
      const backupResult = await this.createBackup();
      if (!backupResult.success) {
        return backupResult;
      }

      // Send email
      const emailResult = await this.sendBackupEmail(backupResult);

      // Cleanup old backups
      const cleanupResult = await this.cleanupOldBackups();

      // Log to activity log
      try {
        await database.run(
          `INSERT INTO activity_log (user_id, action, entity_type, changes_json) VALUES (?, ?, ?, ?)`,
          [
            null,
            'BACKUP',
            'SYSTEM',
            JSON.stringify({
              fileName: backupResult.fileName,
              size: backupResult.size,
              emailSent: emailResult.success,
              cleanedUp: cleanupResult.deleted || 0
            })
          ]
        );
      } catch (logError) {
        console.error('[Backup] Failed to log backup to activity_log:', logError);
      }

      console.log('[Backup] Backup operation completed successfully');

      return {
        success: true,
        backup: backupResult,
        email: emailResult,
        cleanup: cleanupResult
      };

    } catch (error) {
      console.error('[Backup] Backup operation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get backup status information
   */
  async getStatus() {
    try {
      const backupFiles = await this.getBackupFiles();
      const dbModTime = await this.getDatabaseModificationTime();

      const backupList = await Promise.all(
        backupFiles.slice(0, 10).map(async (file) => {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);
          return {
            fileName: file,
            size: stats.size,
            created: stats.mtime
          };
        })
      );

      return {
        success: true,
        totalBackups: backupFiles.length,
        retentionCount: this.retentionCount,
        lastBackupTime: this.lastBackupTime,
        databaseModifiedTime: dbModTime,
        needsBackup: this.lastBackupTime ? (dbModTime > this.lastBackupTime) : true,
        emailEnabled: this.emailEnabled,
        recentBackups: backupList
      };
    } catch (error) {
      console.error('[Backup] Failed to get backup status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
const backupManager = new BackupManager();
module.exports = backupManager;
