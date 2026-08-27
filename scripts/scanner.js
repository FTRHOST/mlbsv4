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
    console.log(`[*] Memulai Scanner Versi Otomatis...`);
    const currentFullVer = db.sClientVersion; // contoh: "2.1.95.1228.1"
    const parts = currentFullVer.split('.');
    
    // Ambil "1228" (mayor) dan "1" (minor)
    const currentMajor = parseInt(parts[parts.length - 2], 10);
    const currentMinor = parseInt(parts[parts.length - 1], 10);

    let foundNewVersion = false;
    let highestMajor = currentMajor;
    let highestMinor = currentMinor;

    // Batasan scanning: 10 versi mayor ke depan secara penuh
    const targetMajor = currentMajor + 10;

    for (let major = currentMajor; major <= targetMajor; major++) {
        // Jika sedang di mayor saat ini, mulai dari minor + 1. Jika mayor baru, mulai dari minor 1.
        let startMinor = (major === currentMajor) ? currentMinor + 1 : 1;
        
        // Memindai minor dari 1 sampai 9
        for (let minor = startMinor; minor <= 9; minor++) {
            const testVer = `${major}.${minor}`;
            const url = `https://akmcdn.ml.youngjoygame.com/res_version5_ind/${testVer}/version/android/version.xml`;
            
            console.log(`[~] Mengecek: ${testVer} ...`);
            const exists = await checkUrl(url);
            
            if (exists) {
                console.log(`[+] DITEMUKAN UPDATE BARU: ${testVer}`);
                foundNewVersion = true;
                
                // Selalu simpan versi tertinggi yang berhasil ditemukan selama scanning berjalan
                highestMajor = major;
                highestMinor = minor;
            } else {
                console.log(`[-] Gagal (404) - Tetap melanjutkan scanning...`);
            }
            
            // Beri jeda agar traffic terlihat alami dan menghindari IP block
            await sleep(500);
        }
    }

    if (foundNewVersion) {
        // Menyusun kembali string versi menggunakan versi tertinggi yang berhasil ditemukan
        parts[parts.length - 2] = highestMajor.toString();
        parts[parts.length - 1] = highestMinor.toString();
        const newFullVer = parts.join('.');

        db.sClientVersion = newFullVer;
        
        const now = new Date().toISOString();
        db.lastUpdated = now;
        
        if (!db.updateHistory) db.updateHistory = [];
        
        // Tambahkan ke log riwayat jika belum ada versi ini di riwayat terbaru
        db.updateHistory.push({
            version: newFullVer,
            detectedAt: now
        });
        
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
        console.log(`[+] Database berhasil diperbarui dengan versi tertinggi baru: ${newFullVer}`);
    } else {
        console.log(`[*] Tidak ada update baru ditemukan setelah memindai 10 versi ke depan. Versi tetap: ${currentFullVer}`);
    }
}

run();
