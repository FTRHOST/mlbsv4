const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
let branch = 'production';
let hash = 'unknown';
try {
  branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  hash = execSync('git rev-parse --short=7 HEAD').toString().trim();
} catch(e) {}

let latestCloudVersion = "2.1.95.1228.1";
try {
  const dbPath = path.join(__dirname, '../database.json');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  if (db.sClientVersion) {
    latestCloudVersion = db.sClientVersion;
  }
} catch(e) {}

fs.writeFileSync(path.join(__dirname, '../src/env.js'), 
  'export const GIT_BRANCH = "' + branch + '";\n' +
  'export const GIT_HASH = "' + hash + '";\n' +
  'export const LATEST_CLOUD_VERSION = "' + latestCloudVersion + '";\n'
);
console.log('[*] Generated src/env.js for branch: ' + branch + ' (' + hash + ') with version: ' + latestCloudVersion);
