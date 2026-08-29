require("dotenv").config();
global.WebSocket = require("ws");
const https = require("https");
const { createClient } = require("@supabase/supabase-js");

// ================= KONFIGURASI SUPABASE =================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[-] Error: SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY tidak terdefinisi di Environment Variables!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ================= KONFIGURASI TELEGRAM =================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; // Diambil dari Repository Secret / Environment Variables
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID; // Diambil dari Repository Secret / Environment Variables

async function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return; // Skip jika secret tidak ditemukan
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodeURIComponent(text)}`;
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode === 200);
    }).on("error", () => resolve(false));
  });
}
// ========================================================

// Fungsi untuk mengecek URL dan mengambil versi utuh dari XML
async function fetchVersionXml(url) {
  return new Promise((resolve) => {
    https
      .get(url, (res) => {
        if (res.statusCode === 200) {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            const match = data.match(/<root\s+version="([^"]+)"/);
            resolve(match && match[1] ? match[1] : null);
          });
        } else {
          res.resume(); // Bebaskan memori jika status bukan 200
          resolve(null);
        }
      })
      .on("error", () => resolve(null));
  });
}


// Fungsi jeda (delay) agar tidak memberatkan server
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getStoredClientVersion() {
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "sClientVersion")
    .single();

  if (error || !data || !data.value) {
    console.warn("[!] Gagal mengambil versi dari Supabase atau belum ada data. Menggunakan fallback version '2.1.95.1228.1'.", error ? error.message : "");
    return "2.1.95.1228.1";
  }

  return data.value;
}

async function updateStoredClientVersion(newVersion) {
  const now = new Date().toISOString();

  // 1. Update/Upsert tabel app_config
  const { error: configError } = await supabase
    .from("app_config")
    .upsert({ key: "sClientVersion", value: newVersion, updated_at: now }, { onConflict: "key" });

  if (configError) {
    console.error("[-] Error saat menyimpan versi baru ke Supabase app_config:", configError.message);
  } else {
    console.log(`[+] Sukses update app_config ke versi ${newVersion}`);
  }

  // 2. Insert ke tabel update_history
  const { error: historyError } = await supabase
    .from("update_history")
    .insert([{ version: newVersion, detected_at: now }]);

  if (historyError) {
    console.error("[-] Error saat mencatat update_history ke Supabase:", historyError.message);
  }
}

async function run() {
  console.log(`[*] Memulai Scanner Pintar (Lompat Major)...`);
  const currentFullVer = await getStoredClientVersion();
  console.log(`[*] Versi saat ini di Supabase: ${currentFullVer}`);
  const parts = currentFullVer.split(".");

  const currentMajor = parseInt(parts[parts.length - 2], 10);
  const currentMinor = parseInt(parts[parts.length - 1], 10);

  let highestMajor = currentMajor;
  let highestMinor = currentMinor;
  let targetMajorFound = null;
  let latestFullVer = null; // Menyimpan versi utuh dari XML

  // === FASE 1: SCANNING LOMPAT MAJOR (Mengecek .1 ke depan) ===
  console.log(`[~] Fase 1: Mencari kenaikan Major baru dengan Minor .1...`);
  const targetMajorLimit = currentMajor + 10;

  for (let major = currentMajor + 1; major <= targetMajorLimit; major++) {
    const testVer = `${major}.1`;
    const url = `https://akmcdn.ml.youngjoygame.com/res_version5_ind/${testVer}/version/android/version.xml`;

    console.log(`[~] Mengecek Major: ${testVer} ...`);
    const foundVersion = await fetchVersionXml(url);

    if (foundVersion) {
      console.log(`[+] DITEMUKAN MAJOR BARU: ${testVer} (Versi XML: ${foundVersion})`);
      targetMajorFound = major;
      highestMajor = major;
      highestMinor = 1; // Set ke 1 karena .1 aktif
      latestFullVer = foundVersion;

      // Berhenti melompat ke Major berikutnya, langsung fokus ke Major ini
      break;
    }
    await sleep(500);
  }

  // === FASE 2: EKSPLORASI MINOR (Hanya berjalan jika Major baru ditemukan) ===
  if (targetMajorFound !== null) {
    console.log(
      `[~] Fase 2: Menjelajahi sub-versi Minor untuk Major ${targetMajorFound}...`,
    );

    // Memindai Minor mulai dari .2 sampai .9
    for (let minor = 2; minor <= 9; minor++) {
      const testVer = `${targetMajorFound}.${minor}`;
      const url = `https://akmcdn.ml.youngjoygame.com/res_version5_ind/${testVer}/version/android/version.xml`;

      console.log(`[~] Mengecek Minor: ${testVer} ...`);
      const foundVersion = await fetchVersionXml(url);

      if (foundVersion) {
        console.log(`[+] DITEMUKAN SUB-VERSION: ${testVer} (Versi XML: ${foundVersion})`);
        highestMinor = minor; // Perbarui ke Minor tertinggi yang aktif
        latestFullVer = foundVersion;
      } else {
        console.log(
          `[-] Minor ${testVer} tidak tersedia. Menghentikan eksplorasi Minor.`,
        );
        // Berhenti jika Minor setelahnya mati (misal .1, .2, .3 hidup, .4 mati -> stop)
        break;
      }
      await sleep(500);
    }
  }

  // === FASE UPDATE DATABASE (SUPABASE) ===
  const foundNewVersion =
    highestMajor !== currentMajor || highestMinor !== currentMinor;

  if (foundNewVersion && latestFullVer) {
    await updateStoredClientVersion(latestFullVer);
    console.log(
      `[+] Sukses! Supabase diperbarui ke versi tertinggi: ${latestFullVer}`,
    );

    // Kirim notifikasi Telegram
    await sendTelegramMessage(`🚀 Update Versi Baru Terdeteksi!\n\nVersi Sebelumnya: ${currentFullVer}\nVersi Terbaru: ${latestFullVer}`);
  } else {
    console.log(
      `[*] Tidak ada update baru. Versi saat ini tetap: ${currentFullVer}`,
    );
  }
}

run()
  .then(() => {
    console.log("[*] Proses pencarian selesai.");
    process.exit(0); // Memaksa script berhenti dengan status sukses
  })
  .catch((error) => {
    console.error("[-] Terjadi kesalahan fatal:", error);
    process.exit(1); // Memaksa script berhenti dengan status error
  });
