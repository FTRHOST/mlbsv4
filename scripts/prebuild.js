require('dotenv').config();
global.WebSocket = require('ws');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

let branch = 'production';
let hash = 'unknown';
try {
  branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  hash = execSync('git rev-parse --short=7 HEAD').toString().trim();
} catch(e) {}

async function runPrebuild() {
  let latestCloudVersion = "2.2.14.1230.1";
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'sClientVersion')
        .single();
      
      if (!error && data && data.value) {
        latestCloudVersion = data.value;
      } else if (error) {
        console.warn('[!] Error fetching version from Supabase:', error.message);
      }
    } catch(e) {
      console.warn('[!] Exception fetching version from Supabase:', e.message);
    }
  } else {
    console.warn('[!] Supabase env variables not found, using fallback version:', latestCloudVersion);
  }

  fs.writeFileSync(path.join(__dirname, '../src/env.js'), 
    'export const GIT_BRANCH = "' + branch + '";\n' +
    'export const GIT_HASH = "' + hash + '";\n' +
    'export const LATEST_CLOUD_VERSION = "' + latestCloudVersion + '";\n'
  );
  console.log('[*] Generated src/env.js for branch: ' + branch + ' (' + hash + ') with version from Supabase: ' + latestCloudVersion);
}

runPrebuild();
