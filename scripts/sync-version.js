#!/usr/bin/env node

/**
 * Sync version from version.json to all package.json files
 * This ensures version.json is the single source of truth
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const VERSION_FILE = path.join(ROOT_DIR, 'version.json');

const PACKAGE_FILES = [
  path.join(ROOT_DIR, 'package.json'),
  path.join(ROOT_DIR, 'backend', 'package.json'),
  path.join(ROOT_DIR, 'frontend', 'package.json')
];

function syncVersion() {
  try {
    // Read version.json
    const versionData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
    const { version } = versionData;

    if (!version) {
      console.error('❌ Error: No version found in version.json');
      process.exit(1);
    }

    console.log(`📦 Syncing version ${version} to all package.json files...`);

    let updatedCount = 0;

    // Update each package.json
    PACKAGE_FILES.forEach(packagePath => {
      if (!fs.existsSync(packagePath)) {
        console.warn(`⚠️  Warning: ${packagePath} not found, skipping...`);
        return;
      }

      const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const oldVersion = packageData.version;

      if (oldVersion === version) {
        console.log(`✓ ${path.relative(ROOT_DIR, packagePath)} already at ${version}`);
        return;
      }

      packageData.version = version;
      fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2) + '\n', 'utf8');

      console.log(`✓ ${path.relative(ROOT_DIR, packagePath)}: ${oldVersion} → ${version}`);
      updatedCount++;
    });

    if (updatedCount === 0) {
      console.log('✅ All package.json files already in sync!');
    } else {
      console.log(`✅ Successfully synced ${updatedCount} package.json file(s)!`);
    }

  } catch (error) {
    console.error('❌ Error syncing versions:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  syncVersion();
}

module.exports = { syncVersion };
