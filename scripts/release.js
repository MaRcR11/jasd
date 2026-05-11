#!/usr/bin/env node
'use strict';
/**
 * Release helper — bumps package.json version, commits, tags and pushes.
 *
 * Usage:
 *   node scripts/release.js patch        → 0.3.6 → 0.3.7
 *   node scripts/release.js minor        → 0.3.6 → 0.4.0
 *   node scripts/release.js major        → 0.3.6 → 1.0.0
 *   node scripts/release.js 1.2.3        → explicit version
 *
 * The push triggers CI: test → build (win/mac/linux) → GitHub Release.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const bump = process.argv[2];
if (!bump) {
  console.error('Usage: node scripts/release.js [patch|minor|major|x.y.z]');
  process.exit(1);
}

function nextVersion(current, type) {
  const [major, minor, patch] = current.split('.').map(Number);
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  if (type === 'patch') return `${major}.${minor}.${patch + 1}`;
  if (/^\d+\.\d+\.\d+$/.test(type)) return type;
  console.error(`Unknown bump type: "${type}". Use patch, minor, major, or x.y.z`);
  process.exit(1);
}

const newVersion = nextVersion(pkg.version, bump);
const tag = `v${newVersion}`;

const status = execSync('git status --porcelain').toString().trim();
if (status) {
  console.error('Working tree is not clean. Commit or stash your changes first:\n' + status);
  process.exit(1);
}

try {
  execSync(`git rev-parse ${tag}`, { stdio: 'ignore' });
  console.error(`Tag ${tag} already exists.`);
  process.exit(1);
} catch {}

console.log(`Bumping ${pkg.version} → ${newVersion}`);

pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

run('git add package.json');
run(`git commit -m "chore: release ${tag}"`);
run(`git tag ${tag}`);
run('git push --follow-tags');

console.log(`\nDone — ${tag} has been pushed.`);
console.log('CI will now: run tests → build (win/mac/linux) → publish GitHub Release.');
