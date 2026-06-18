const frida = require('frida');
const fs = require('fs');
const path = require('path');
const http = require('http');
const admin = require('firebase-admin');
const { execSync } = require('child_process');

// 1. Inisialisasi Firebase Admin
const SERVICE_ACCOUNT_PATH = './serviceAccountKey.json';

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("==================================================================");
  console.error("[-] ERROR: File 'serviceAccountKey.json' tidak ditemukan!");
  console.error("Silakan ikuti langkah berikut:");
  console.error("1. Buka Firebase Console.");
  console.error("2. Pilih Project Anda -> Project Settings -> Service Accounts.");
  console.error("3. Klik 'Generate new private key'.");
  console.error("4. Unduh file JSON tersebut dan simpan di folder ini dengan nama 'serviceAccountKey.json'.");
  console.error("==================================================================");
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
console.log("[+] Firebase Admin SDK berhasil diinisialisasi.");

// 1.5 Inisialisasi Web Server untuk Dashboard Realtime (SSE)
let sseClients = [];
let lastRoomData = null;

const server = http.createServer((req, res) => {
  if (req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    // Kirim data terakhir jika ada agar dashboard langsung terisi
    if (lastRoomData) {
      res.write(`data: ${JSON.stringify(lastRoomData)}\n\n`);
    }
    sseClients.push(res);
    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== res);
    });
    return;
  }

  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    const htmlPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(htmlPath)) {
      res.end(fs.readFileSync(htmlPath, 'utf8'));
    } else {
      res.end("index.html tidak ditemukan. Harap pastikan index.html ada di direktori yang sama.");
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(3000, '0.0.0.0', () => {
  console.log("[+] Realtime Dashboard Web Server running at http://localhost:3000");
});

// 2. Fungsi untuk menyimpan data ke Firestore
async function saveToFirestore(payload) {
  try {
    const matchData = {
      operatorId: payload.operatorId,
      players: payload.players,
      draftTime: payload.draftTime !== undefined ? payload.draftTime : 0,
      draftPhase: payload.draftPhase !== undefined ? payload.draftPhase : 0,
      caption: payload.caption || "",
      mapDraw: payload.mapDraw !== undefined && payload.mapDraw !== null ? (typeof payload.mapDraw === 'object' ? Number(payload.mapDraw.toString()) : Number(payload.mapDraw)) : 0,
      agentTimestamp: payload.timestamp
    };

    // Menyimpan data ke collection 'broadcast_test'
    const OpID = payload.operatorId ? String(payload.operatorId).trim() : "";
    if (!OpID) {
      console.log("[-] [Firestore] Gagal: Operator ID kosong!");
      return;
    }

    // 1. Tulis ke parent doc agar dokumennya aktif (tidak berwarna abu-abu/miring di console)
    await db.collection('test').doc("OperatorId").set({
      last_active: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // 2. Tulis ke subkoleksi
    const path = `test/OperatorId/${OpID}/iPlayer`;
    await db.collection('test').doc("OperatorId").collection(OpID).doc("iPlayer").set(matchData);

    console.log(`[+] [Firestore] Data room berhasil disimpan!`);
    console.log(`    Path: ${path}`);
    console.log(`    Jumlah Player: ${payload.players.length}`);
  } catch (error) {
    console.error("[-] [Firestore] Gagal menyimpan data:", error);
  }
}

// Fungsi pembantu untuk mendapatkan PID menggunakan ADB
function getTargetPid() {
  try {
    const stdout = execSync("adb shell ps -A", { encoding: 'utf8' });
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.includes(':UnityKillsMe')) {
        const parts = line.trim().split(/\s+/);
        // Kolom PID biasanya kolom ke-2
        const pid = parseInt(parts[1], 10);
        if (!isNaN(pid)) {
          return pid;
        }
      }
    }
  } catch (e) {
    // Abaikan error jika adb tidak merespon sementara
  }
  return null;
}

// 3. Fungsi untuk mencari proses target dan memuat script Frida
async function getTargetProcess(device) {
  console.log("[*] Mencari proses target ':UnityKillsMe' via ADB...");
  while (true) {
    const pid = getTargetPid();
    if (pid) {
      console.log(`[+] Proses ':UnityKillsMe' ditemukan via ADB! PID: ${pid}`);
      return { pid };
    }

    // Fallback: cari menggunakan name-matching frida (siapa tahu namanya terdeteksi berbeda)
    try {
      const processes = await device.enumerateProcesses();
      const target = processes.find(p => p.name.includes(':UnityKillsMe') || p.name.includes('UnityKillsMe'));
      if (target) {
        console.log(`[+] Proses ':UnityKillsMe' ditemukan via Frida! Name: ${target.name} (PID: ${target.pid})`);
        return target;
      }
    } catch (e) {
      // Abaikan error enumerate
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function main() {
  try {
    console.log("[*] Menghubungkan ke USB Device...");
    const device = await frida.getUsbDevice();
    console.log(`[+] Terhubung ke device: ${device.name}`);

    // Menunggu dan mendapatkan proses target
    const targetProcess = await getTargetProcess(device);

    console.log(`[*] Melakukan attach ke PID: ${targetProcess.pid}...`);
    const session = await device.attach(targetProcess.pid);
    console.log("[+] Berhasil attach ke sesi Frida.");

    // Membaca file agent yang sudah dicompile
    const agentPath = './dist/agent.js';
    if (!fs.existsSync(agentPath)) {
      console.error(`[-] ERROR: File '${agentPath}' tidak ditemukan. Silakan jalankan 'npm run build' terlebih dahulu!`);
      process.exit(1);
    }

    const source = fs.readFileSync(agentPath, 'utf8');
    const script = await session.createScript(source);

    // Menangani event message dari script Frida
    script.message.connect((message, data) => {
      if (message.type === 'send') {
        const payload = message.payload;
        if (payload && payload.type === 'ROOM_DATA') {
          console.log("[+] Menerima ROOM_DATA dari agent:");
          saveToFirestore(payload.payload);

          // Kirim data secara realtime ke SSE clients
          lastRoomData = payload.payload;
          sseClients.forEach(client => {
            client.write(`data: ${JSON.stringify(lastRoomData)}\n\n`);
          });
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

    // Menangani event session detached (jika aplikasi ditutup/crash)
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
