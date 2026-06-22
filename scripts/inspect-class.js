const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PACKAGE_NAME = 'com.mobilelegends.taptest';

function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (err) {
    console.error(`[-] Error: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log("==========================================");
  console.log("🔍 SYSTEMDATA CLASS INSPECTOR RUNNER");
  console.log("==========================================\n");

  const devicesOutput = runCmd('adb devices');
  const lines = devicesOutput ? devicesOutput.split('\n').map(l => l.trim()).filter(l => l.length > 0) : [];
  const devices = lines.slice(1).filter(l => l.includes('device')).map(l => l.split('\t')[0]);

  if (devices.length === 0) {
    console.error("[-] ERROR: Tidak ada perangkat Android terhubung via ADB!");
    console.log("    Silakan hubungkan HP Anda kembali dan pastikan USB debugging aktif.");
    process.exit(1);
  }

  const deviceId = devices[0];
  console.log(`[+] Perangkat terdeteksi: ${deviceId}`);

  const agentSrc = path.join(__dirname, 'inspect-class-agent.js');
  const agentOut = path.join(__dirname, '..', 'dist', 'inspect-agent.js');

  console.log("[*] Mengompilasi agent inspector...");
  try {
    execSync(`npx frida-compile "${agentSrc}" -o "${agentOut}" -c`, { stdio: 'inherit' });
    console.log("[+] Kompilasi selesai.");
  } catch (e) {
    console.error("[-] ERROR: Gagal mengompilasi agent.");
    process.exit(1);
  }

  console.log("[*] Memulai pencarian PID game...");
  let pid = null;
  const stdout = runCmd("adb shell ps -A");
  if (stdout) {
    const psLines = stdout.split('\n');
    for (const line of psLines) {
      if (line.includes(':UnityKillsMe')) {
        const parts = line.trim().split(/\s+/);
        pid = parseInt(parts[1], 10);
        break;
      }
    }
  }

  if (!pid) {
    console.log("[*] Game tidak terdeteksi berjalan. Mencoba menjalankan game...");
    runCmd(`adb -s ${deviceId} shell am start -n ${PACKAGE_NAME}/com.moba.unityplugin.MobaGameMainActivityWithExtractor`);
    console.log("[*] Menunggu game berjalan...");
    for (let i = 0; i < 15; i++) {
      const psCheck = runCmd("adb shell ps -A");
      if (psCheck && psCheck.includes(':UnityKillsMe')) {
        const psLines = psCheck.split('\n');
        for (const line of psLines) {
          if (line.includes(':UnityKillsMe')) {
            pid = parseInt(line.trim().split(/\s+/)[1], 10);
            break;
          }
        }
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (!pid) {
    console.error("[-] ERROR: Gagal mendeteksi atau menjalankan game.");
    process.exit(1);
  }

  console.log(`[+] PID ditemukan: ${pid}. Menempelkan Frida...`);
  try {
    execSync(`frida -U -p ${pid} -l "${agentOut}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error("[-] Terjadi error saat menjalankan Frida:", err.message);
  }
}

main();
