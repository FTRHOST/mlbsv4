const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGE_NAME = 'com.mobilelegends.taptest';
const DEVICE_PATH = `/sdcard/Android/data/${PACKAGE_NAME}/files`;

function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (err) {
    console.error(`[-] Gagal menjalankan perintah: ${cmd}`);
    console.error(`    Error: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log("==========================================");
  console.log("🚀 ADB PULL UTILITY FOR FRIDA HOOK SCRIPTS");
  console.log("==========================================\n");

  // 1. Check ADB device
  const devicesOutput = runCmd('adb devices');
  if (!devicesOutput) {
    console.error("[-] Gagal mendeteksi perangkat ADB.");
    process.exit(1);
  }

  const lines = devicesOutput.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const devices = lines.slice(1).filter(l => l.includes('device')).map(l => l.split('\t')[0]);

  if (devices.length === 0) {
    console.error("[-] ERROR: Tidak ada perangkat Android terhubung via ADB!");
    console.log("    Pastikan USB debugging aktif di opsi pengembang HP Anda.");
    process.exit(1);
  }

  const deviceId = devices[0];
  console.log(`[+] Perangkat terdeteksi: ${deviceId}`);

  // Create pulled directory
  const pulledDir = path.join(__dirname, '..', 'dist', 'pulled');
  if (!fs.existsSync(pulledDir)) {
    fs.mkdirSync(pulledDir, { recursive: true });
  }

  console.log(`[*] Mengambil (pulling) file dari perangkat (${PACKAGE_NAME})...`);

  // Pull hook_cache.js
  console.log(`    - Menarik hook_cache.js...`);
  runCmd(`adb -s ${deviceId} pull "${DEVICE_PATH}/hook_cache.js" "${path.join(pulledDir, 'hook_cache.js')}"`);

  // Pull hook_cache.js.sig
  console.log(`    - Menarik hook_cache.js.sig...`);
  runCmd(`adb -s ${deviceId} pull "${DEVICE_PATH}/hook_cache.js.sig" "${path.join(pulledDir, 'hook_cache.js.sig')}"`);

  // Pull patch_config.xml
  console.log(`    - Menarik patch_config.xml...`);
  const localConfig = path.join(__dirname, '..', 'patch_config.xml');
  runCmd(`adb -s ${deviceId} pull "${DEVICE_PATH}/patch_config.xml" "${localConfig}"`);

  // Pull ota_log.txt
  console.log(`    - Menarik ota_log.txt...`);
  runCmd(`adb -s ${deviceId} pull "${DEVICE_PATH}/ota_log.txt" "${path.join(pulledDir, 'ota_log.txt')}"`);

  console.log("\n[+] Penarikan file berhasil!");
  console.log(`    File disimpan di:`);
  console.log(`    - Script Cache: dist/pulled/hook_cache.js`);
  console.log(`    - Signature Cache: dist/pulled/hook_cache.js.sig`);
  console.log(`    - Active Config: patch_config.xml`);
  console.log(`    - OTA Logs: dist/pulled/ota_log.txt`);
  console.log("==========================================");
}

main();
