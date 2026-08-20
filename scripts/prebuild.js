const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
let branch = 'production';
let hash = 'unknown';
try {
  branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  hash = execSync('git rev-parse --short=7 HEAD').toString().trim();
} catch(e) {}
fs.writeFileSync(path.join(__dirname, '../src/env.js'), 
  'export const GIT_BRANCH = "' + branch + '";\n' +
  'export const GIT_HASH = "' + hash + '";\n'
);
console.log('[*] Generated src/env.js for branch: ' + branch + ' (' + hash + ')');
