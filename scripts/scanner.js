const fs = require('fs');
const https = require('https');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// Fungsi untuk mengecek URL
async function checkUrl(url) {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            resolve(res.statusCode === 200);
        }).on('error', () => resolve(false));
    });
}

// Fungsi jeda (delay) agar tidak memberatkan server
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
    console.log(`[*] Memulai Scanner Versi...`);
    const currentFullVer = db.sClientVersion; // contoh: "2.1.95.1228.1"
    const parts = currentFullVer.split('.');
    
    // Kita ambil "1228" (mayor) dan "1" (minor)
    const currentMajor = parseInt(parts[parts.length - 2], 10);
    const currentMinor = parseInt(parts[parts.length - 1], 10);

    let foundNewVersion = false;
    let newFullVer = currentFullVer;

    let consecutive404 = 0;
    const MAX_CONSECUTIVE_404 = 5; // Batas berhenti jika gagal terus menerus

    outerLoop:
    for (let major = currentMajor; major <= currentMajor + 10; major++) {
        // Jika sedang di mayor saat ini, mulai dari minor + 1. Jika mayor baru, mulai dari minor 1.
        let startMinor = (major === currentMajor) ? currentMinor + 1 : 1;
        
        for (let minor = startMinor; minor <= 9; minor++) {
            const testVer = `${major}.${minor}`;
            const url = `https://akmcdn.ml.youngjoygame.com/res_version5_ind/${testVer}/version/android/version.xml`;
            
            console.log(`[~] Mengecek: ${testVer} ...`);
            const exists = await checkUrl(url);
            
            if (exists) {
                console.log(`[+] DITEMUKAN UPDATE BARU: ${testVer}`);
                foundNewVersion = true;
                parts[parts.length - 2] = major.toString();
                parts[parts.length - 1] = minor.toString();
                newFullVer = parts.join('.');
                
                // Reset hitungan 404 karena kita menemukan jalur versi yang valid
                consecutive404 = 0;
            } else {
                consecutive404++;
                console.log(`[-] Gagal (404) - Count: ${consecutive404}`);
                if (consecutive404 >= MAX_CONSECUTIVE_404) {
                    console.log(`[!] Mendapat ${MAX_CONSECUTIVE_404}x kegagalan berturut-turut. Berhenti untuk mencegah blokir IP.`);
                    break outerLoop;
                }
            }
            // Beri jeda 500ms agar traffic terlihat alami (seperti manusia/browser)
            await sleep(500);
        }
    }

    if (foundNewVersion) {
        db.sClientVersion = newFullVer;
        
        // Simpan waktu deteksi dengan format zona waktu UTC (bisa disesuaikan nanti)
        const now = new Date().toISOString();
        db.lastUpdated = now;
        
        if (!db.updateHistory) db.updateHistory = [];
        
        // Tambahkan ke log riwayat
        db.updateHistory.push({
            version: newFullVer,
            detectedAt: now
        });
        
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
        console.log(`[+] Database berhasil diperbarui dengan versi: ${newFullVer}`);
    } else {
        console.log(`[*] Tidak ada update baru. Versi saat ini tetap: ${currentFullVer}`);
    }
}

run();
