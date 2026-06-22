const frida = require('frida');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration for Firebase REST API
const API_URL = process.env.API_URL || 'https://mlbsv4.vercel.app/api/rooms';
const API_KEY = process.env.API_KEY || 'mlbs_secret_token_2026';

console.log("[+] REST API Configured:");
console.log(`    URL: ${API_URL}`);
console.log(`    API Key: ${API_KEY ? '****** (configured)' : 'None'}`);

// Function to send data to the secure REST API
async function sendToRestApi(payload) {
  try {
    const matchData = {
      operatorId: payload.operatorId,
      players: payload.players,
      draftTime: payload.draftTime !== undefined ? payload.draftTime : 0,
      draftPhase: payload.draftPhase !== undefined ? payload.draftPhase : 0,
      caption: payload.caption || "",
      mapDraw: payload.mapDraw !== undefined && payload.mapDraw !== null ? (typeof payload.mapDraw === 'object' ? Number(payload.mapDraw.toString()) : Number(payload.mapDraw)) : 0,
      timestamp: payload.timestamp
    };

    const OpID = payload.operatorId ? String(payload.operatorId).trim() : "";
    if (!OpID) {
      console.log("[-] [API Forwarder] Gagal: Operator ID kosong!");
      return;
    }

    console.log(`[*] [API Forwarder] Mengirim data room ke API...`);
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify(matchData)
    });

    const result = await response.json();
    if (response.ok && result.status === 'success') {
      console.log(`[+] [API Forwarder] Berhasil mengirim ke REST API! Operator ID: ${OpID}`);
    } else {
      console.error(`[-] [API Forwarder] Gagal mengirim: ${result.message || response.statusText}`);
    }
  } catch (error) {
    console.error("[-] [API Forwarder] Error saat fetch REST API:", error.message);
  }
}

// Helper function to get PID using ADB
function getTargetPid() {
  try {
    const stdout = execSync("adb shell ps -A", { encoding: 'utf8' });
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.includes(':UnityKillsMe')) {
        const parts = line.trim().split(/\s+/);
        // PID column is usually the 2nd one
        const pid = parseInt(parts[1], 10);
        if (!isNaN(pid)) {
          return pid;
        }
      }
    }
  } catch (e) {
    // Ignore temp errors
  }
  return null;
}

// Function to find target process and load Frida script
async function getTargetProcess(device) {
  console.log("[*] Mencari proses target ':UnityKillsMe' via ADB...");
  while (true) {
    const pid = getTargetPid();
    if (pid) {
      console.log(`[+] Proses ':UnityKillsMe' ditemukan via ADB! PID: ${pid}`);
      return { pid };
    }

    try {
      const processes = await device.enumerateProcesses();
      const target = processes.find(p => p.name.includes(':UnityKillsMe') || p.name.includes('UnityKillsMe'));
      if (target) {
        console.log(`[+] Proses ':UnityKillsMe' ditemukan via Frida! Name: ${target.name} (PID: ${target.pid})`);
        return target;
      }
    } catch (e) {
      // Ignore enumeration error
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function main() {
  try {
    console.log("[*] Menghubungkan ke USB Device...");
    const device = await frida.getUsbDevice();
    console.log(`[+] Terhubung ke device: ${device.name}`);

    // Wait and get target process
    const targetProcess = await getTargetProcess(device);

    console.log(`[*] Melakukan attach ke PID: ${targetProcess.pid}...`);
    const session = await device.attach(targetProcess.pid);
    console.log("[+] Berhasil attach ke sesi Frida.");

    // Read compiled agent file
    const agentPath = './dist/agent.js';
    if (!fs.existsSync(agentPath)) {
      console.error(`[-] ERROR: File '${agentPath}' tidak ditemukan. Silakan jalankan 'npm run build' terlebih dahulu!`);
      process.exit(1);
    }

    const source = fs.readFileSync(agentPath, 'utf8');
    const script = await session.createScript(source);

    // Handle message event from Frida script
    script.message.connect((message, data) => {
      if (message.type === 'send') {
        const payload = message.payload;
        if (payload && payload.type === 'ROOM_DATA') {
          console.log("[+] Menerima ROOM_DATA dari agent:");
          sendToRestApi(payload.payload);
        } else {
          console.log(`[*] Pesan dari agent:`, payload);
        }
      } else if (message.type === 'error') {
        console.error(`[-] Error dari Frida Agent:`, message.description);
        if (message.stack) {
          console.error(message.stack);
        }
      }
    });

    // Handle session detached (if app closed/crashed)
    session.detached.connect(() => {
      console.warn("[-] Koneksi Frida terputus (aplikasi ditutup atau crash).");
      console.log("[*] Mencoba menyambungkan kembali dalam 2 detik...");
      setTimeout(main, 2000);
    });

    console.log("[*] Memuat script Frida ke proses...");
    await script.load();
    console.log("[+] Script Frida berhasil dimuat dan aktif!");

  } catch (error) {
    console.error("[-] Terjadi kesalahan pada host script:", error.message);
    console.log("[*] Mengulangi inisialisasi dalam 2 detik...");
    setTimeout(main, 2000);
  }
}

main();
