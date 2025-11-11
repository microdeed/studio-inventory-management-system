/**
 * Sync CHANGELOG.md entries to release_notes database table
 * Runs on server startup to ensure database is up-to-date
 */

const { getChangelogEntries } = require('./changelogParser');

/**
 * Sync CHANGELOG.md entries to the database
 * @param {Object} database - Database connection instance
 * @returns {Promise<{added: number, updated: number, errors: number}>}
 */
async function syncChangelogToDatabase(database) {
    const stats = {
        added: 0,
        updated: 0,
        errors: 0
    };

    try {
        // Parse CHANGELOG.md
        const entries = getChangelogEntries();

        if (entries.length === 0) {
            console.log('No entries found in CHANGELOG.md');
            return stats;
        }

        console.log(`Found ${entries.length} release entries in CHANGELOG.md`);

        // Process each entry
        for (const entry of entries) {
            try {
                // Check if this version already exists
                const existing = await database.get(
                    'SELECT id, notes, release_date FROM release_notes WHERE version = ?',
                    [entry.version]
                );

                if (existing) {
                    // Update if content has changed
                    const notesChanged = existing.notes !== entry.notes;
                    const dateChanged = existing.release_date !== entry.release_date;

                    if (notesChanged || dateChanged) {
                        await database.run(
                            `UPDATE release_notes
                             SET notes = ?, release_date = ?
                             WHERE version = ?`,
                            [entry.notes, entry.release_date, entry.version]
                        );
                        stats.updated++;
                        console.log(`  ✓ Updated release notes for v${entry.version}`);
                    } else {
                        console.log(`  - v${entry.version} already up-to-date`);
                    }
                } else {
                    // Insert new entry
                    await database.run(
                        `INSERT INTO release_notes (version, notes, release_date, created_at, created_by)
                         VALUES (?, ?, ?, CURRENT_TIMESTAMP, NULL)`,
                        [entry.version, entry.notes, entry.release_date]
                    );
                    stats.added++;
                    console.log(`  ✓ Added release notes for v${entry.version}`);
                }
            } catch (error) {
                console.error(`  ✗ Error processing v${entry.version}:`, error.message);
                stats.errors++;
            }
        }

        // Summary
        if (stats.added > 0 || stats.updated > 0) {
            console.log(`\n✓ Release notes sync complete: ${stats.added} added, ${stats.updated} updated`);
        } else {
            console.log('✓ All release notes are up-to-date');
        }

        if (stats.errors > 0) {
            console.warn(`⚠ ${stats.errors} error(s) occurred during sync`);
        }

    } catch (error) {
        console.error('Failed to sync CHANGELOG.md to database:', error.message);
        stats.errors++;
    }

    return stats;
}

module.exports = {
    syncChangelogToDatabase
};
