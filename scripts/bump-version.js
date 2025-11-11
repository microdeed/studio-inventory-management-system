#!/usr/bin/env node

/**
 * Bump version with interactive release notes
 * Handles: version bump, changelog update, git commit, git tag, docker tag update
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');
const { syncVersion } = require('./sync-version');

const ROOT_DIR = path.join(__dirname, '..');
const VERSION_FILE = path.join(ROOT_DIR, 'version.json');
const CHANGELOG_FILE = path.join(ROOT_DIR, 'CHANGELOG.md');
const DOCKER_COMPOSE_PROD = path.join(ROOT_DIR, 'docker-compose.prod.yml');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function bumpVersion(currentVersion, bumpType) {
  const parts = currentVersion.split('.').map(Number);

  switch (bumpType) {
    case 'major':
      parts[0]++;
      parts[1] = 0;
      parts[2] = 0;
      break;
    case 'minor':
      parts[1]++;
      parts[2] = 0;
      break;
    case 'patch':
      parts[2]++;
      break;
    default:
      throw new Error(`Invalid bump type: ${bumpType}`);
  }

  return parts.join('.');
}

function updateVersionFile(newVersion) {
  const versionData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
  versionData.version = newVersion;
  versionData.lastUpdated = new Date().toISOString();
  fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2) + '\n', 'utf8');
}

function updateChangelog(version, releaseNotes, date) {
  let changelog = fs.existsSync(CHANGELOG_FILE)
    ? fs.readFileSync(CHANGELOG_FILE, 'utf8')
    : `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`;

  const versionHeader = `## [${version}] - ${date}`;

  // Check if version already exists
  if (changelog.includes(versionHeader)) {
    console.log(`⚠️  Version ${version} already exists in CHANGELOG.md, skipping...`);
    return;
  }

  // Find the position to insert (after the header, before the first version entry)
  const lines = changelog.split('\n');
  let insertIndex = lines.findIndex(line => line.startsWith('## ['));

  if (insertIndex === -1) {
    // No versions yet, append at the end
    insertIndex = lines.length;
  }

  const newEntry = [
    versionHeader,
    '',
    releaseNotes,
    '',
    ''
  ].join('\n');

  lines.splice(insertIndex, 0, newEntry);
  changelog = lines.join('\n');

  fs.writeFileSync(CHANGELOG_FILE, changelog, 'utf8');
  console.log(`✓ Updated CHANGELOG.md`);
}

function updateDockerComposeProd(version) {
  if (!fs.existsSync(DOCKER_COMPOSE_PROD)) {
    console.log('⚠️  docker-compose.prod.yml not found, skipping...');
    return;
  }

  let content = fs.readFileSync(DOCKER_COMPOSE_PROD, 'utf8');

  // Update IMAGE_TAG environment variable
  const imageTagRegex = /(IMAGE_TAG:-)[^}]*/g;
  const oldContent = content;
  content = content.replace(imageTagRegex, `$1v${version}`);

  if (content !== oldContent) {
    fs.writeFileSync(DOCKER_COMPOSE_PROD, content, 'utf8');
    console.log(`✓ Updated IMAGE_TAG in docker-compose.prod.yml to v${version}`);
  } else {
    console.log('⚠️  No IMAGE_TAG found in docker-compose.prod.yml');
  }
}

function gitCommit(version) {
  try {
    // Check if git repo
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });

    // Add files
    execSync('git add version.json package.json backend/package.json frontend/package.json CHANGELOG.md docker-compose.prod.yml', { stdio: 'inherit' });

    // Commit
    execSync(`git commit -m "chore: bump version to v${version}"`, { stdio: 'inherit' });
    console.log(`✓ Committed version bump`);

    // Create tag
    execSync(`git tag -a v${version} -m "Release v${version}"`, { stdio: 'inherit' });
    console.log(`✓ Created git tag v${version}`);

  } catch (error) {
    console.error('❌ Git operations failed:', error.message);
    console.log('ℹ️  You may need to commit and tag manually');
  }
}

async function promptReleaseNotes() {
  console.log('\n📝 Enter release notes (type your changes, then press Enter twice when done):');
  console.log('   Examples:');
  console.log('   - Added: New feature X');
  console.log('   - Fixed: Bug in Y component');
  console.log('   - Changed: Updated Z behavior\n');

  const lines = [];
  let emptyLineCount = 0;

  return new Promise((resolve) => {
    rl.on('line', (line) => {
      if (line.trim() === '') {
        emptyLineCount++;
        if (emptyLineCount >= 2) {
          rl.close();
          resolve(lines.join('\n'));
        }
      } else {
        emptyLineCount = 0;
        lines.push(line);
      }
    });
  });
}

async function run() {
  try {
    // Get bump type from command line
    const bumpType = process.argv[2];

    if (!['patch', 'minor', 'major'].includes(bumpType)) {
      console.error('Usage: npm run version:patch|minor|major');
      process.exit(1);
    }

    // Read current version
    const versionData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
    const currentVersion = versionData.version;
    const newVersion = bumpVersion(currentVersion, bumpType);

    console.log(`\n🚀 Version Bump: ${currentVersion} → ${newVersion} (${bumpType})\n`);

    // Prompt for release notes
    const releaseNotes = await promptReleaseNotes();

    if (!releaseNotes.trim()) {
      console.error('❌ Release notes cannot be empty!');
      process.exit(1);
    }

    console.log('\n\n📦 Processing version bump...\n');

    // 1. Update version.json
    updateVersionFile(newVersion);
    console.log(`✓ Updated version.json to ${newVersion}`);

    // 2. Sync to all package.json files
    syncVersion();

    // 3. Update CHANGELOG.md
    const today = new Date().toISOString().split('T')[0];
    updateChangelog(newVersion, releaseNotes, today);

    // 4. Update docker-compose.prod.yml
    updateDockerComposeProd(newVersion);

    // 5. Git commit and tag
    gitCommit(newVersion);

    console.log('\n✅ Version bump complete!\n');
    console.log(`📌 Next steps:`);
    console.log(`   1. Review the changes: git show`);
    console.log(`   2. Push to remote: git push && git push --tags`);
    console.log(`   3. Release notes will be synced to database when the server restarts\n`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  run();
}
