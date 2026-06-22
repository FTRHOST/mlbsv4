const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGE_NAME = 'com.mobilelegends.taptest';
const LAUNCH_ACTIVITY = 'com.mobilelegends.taptest/com.moba.unityplugin.MobaGameMainActivityWithExtractor';
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
  console.log("🚀 ADB PUSH UTILITY FOR FRIDA HOOK SCRIPTS");
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

  // 2. Recompile and sign the OTA script first so we push the latest changes
  console.log("[*] Mengompilasi dan menandatangani script terbaru...");
  try {
    execSync('npm run sign-ota', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log("[+] Kompilasi & penandatanganan selesai.");
  } catch (e) {
    console.error("[-] ERROR: Gagal menjalankan 'npm run sign-ota'.");
    process.exit(1);
  }

  const publicDir = path.join(__dirname, '..', 'public');
  const hookJs = path.join(publicDir, 'hook.js');
  const hookSig = path.join(publicDir, 'hook.js.sig');

  if (!fs.existsSync(hookJs) || !fs.existsSync(hookSig)) {
    console.error(`[-] ERROR: File build di ${publicDir} tidak lengkap.`);
    process.exit(1);
  }

  // 3. Push files to the device
  console.log(`[*] Mengirim (pushing) file ke perangkat (${PACKAGE_NAME})...`);
  
  // Push hook_cache.js
  console.log(`    - Menulis hook_cache.js...`);
  runCmd(`adb -s ${deviceId} push "${hookJs}" "${DEVICE_PATH}/hook_cache.js"`);

  // Push hook_cache.js.sig
  console.log(`    - Menulis hook_cache.js.sig...`);
  runCmd(`adb -s ${deviceId} push "${hookSig}" "${DEVICE_PATH}/hook_cache.js.sig"`);

  // Check if a local patch_config.xml exists in root and push it if exists
  const configPath = path.join(__dirname, '..', 'patch_config.xml');
  if (fs.existsSync(configPath)) {
    console.log(`    - Menulis patch_config.xml...`);
    runCmd(`adb -s ${deviceId} push "${configPath}" "${DEVICE_PATH}/patch_config.xml"`);
  } else {
    console.log(`    - patch_config.xml lokal tidak ditemukan. Menggunakan konfigurasi yang ada di perangkat.`);
  }

  console.log("[+] Pengiriman file berhasil!");

  // 4. Force-stop and restart the application
  console.log(`[*] Menghentikan aplikasi ${PACKAGE_NAME} secara paksa...`);
  runCmd(`adb -s ${deviceId} shell am force-stop ${PACKAGE_NAME}`);
  
  console.log("[*] Menjalankan kembali aplikasi...");
  runCmd(`adb -s ${deviceId} shell am start -n ${LAUNCH_ACTIVITY}`);
  
  console.log("\n[+] Sukses! Script hook telah diperbarui pada perangkat dan game berhasil dijalankan ulang.");
  console.log("==========================================");
}

main();
