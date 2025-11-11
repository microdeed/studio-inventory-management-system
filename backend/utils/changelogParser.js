/**
 * CHANGELOG.md Parser
 * Parses Keep a Changelog format entries
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse CHANGELOG.md and extract release notes
 * @param {string} changelogPath - Path to CHANGELOG.md file
 * @returns {Array<{version: string, release_date: string, notes: string}>}
 */
function parseChangelog(changelogPath) {
    try {
        const content = fs.readFileSync(changelogPath, 'utf8');
        const entries = [];

        // Split content by release headers: ## [version] - date
        const releaseHeaderRegex = /^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})/gm;

        let match;
        const matches = [];

        // Find all release headers
        while ((match = releaseHeaderRegex.exec(content)) !== null) {
            matches.push({
                version: match[1],
                date: match[2],
                position: match.index,
                fullMatch: match[0]
            });
        }

        // Extract notes for each release
        for (let i = 0; i < matches.length; i++) {
            const current = matches[i];
            const next = matches[i + 1];

            // Extract content between this header and the next (or end of file)
            const startPos = current.position + current.fullMatch.length;
            const endPos = next ? next.position : content.length;
            const notes = content.substring(startPos, endPos).trim();

            // Only add entries that have content
            if (notes && notes.length > 0) {
                entries.push({
                    version: current.version,
                    release_date: current.date,
                    notes: notes
                });
            }
        }

        return entries;
    } catch (error) {
        console.error('Error parsing CHANGELOG.md:', error.message);
        return [];
    }
}

/**
 * Get parsed entries from the project's CHANGELOG.md
 * @returns {Array<{version: string, release_date: string, notes: string}>}
 */
function getChangelogEntries() {
    // CHANGELOG.md is in project root, backend is one level down
    const changelogPath = path.join(__dirname, '..', '..', 'CHANGELOG.md');

    if (!fs.existsSync(changelogPath)) {
        console.warn('CHANGELOG.md not found at:', changelogPath);
        return [];
    }

    return parseChangelog(changelogPath);
}

module.exports = {
    parseChangelog,
    getChangelogEntries
};
