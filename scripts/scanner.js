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
    console.log(`[*] Memulai Scanner Pintar (Lompat Major)...`);
    const currentFullVer = db.sClientVersion; // contoh: "2.1.95.1228.1"
    const parts = currentFullVer.split('.');
    
    const currentMajor = parseInt(parts[parts.length - 2], 10);
    const currentMinor = parseInt(parts[parts.length - 1], 10);

    let highestMajor = currentMajor;
    let highestMinor = currentMinor;
    let targetMajorFound = null;

    // === FASE 1: SCANNING LOMPAT MAJOR (Mengecek .1 ke depan) ===
    console.log(`[~] Fase 1: Mencari kenaikan Major baru dengan Minor .1...`);
    const targetMajorLimit = currentMajor + 10;

    for (let major = currentMajor + 1; major <= targetMajorLimit; major++) {
        const testVer = `${major}.1`;
        const url = `https://youngjoygame.com{testVer}/version/android/version.xml`;
        
        console.log(`[~] Mengecek Major: ${testVer} ...`);
        const exists = await checkUrl(url);
        
        if (exists) {
            console.log(`[+] DITEMUKAN MAJOR BARU: ${testVer}`);
            targetMajorFound = major;
            highestMajor = major;
            highestMinor = 1; // Set ke 1 karena .1 aktif
            
            // Berhenti melompat ke Major berikutnya, langsung fokus ke Major ini
            break;
        }
        await sleep(500);
    }

    // === FASE 2: EKSPLORASI MINOR (Hanya berjalan jika Major baru ditemukan) ===
    if (targetMajorFound !== null) {
        console.log(`[~] Fase 2: Menjelajahi sub-versi Minor untuk Major ${targetMajorFound}...`);
        
        // Memindai Minor mulai dari .2 sampai .9
        for (let minor = 2; minor <= 9; minor++) {
            const testVer = `${targetMajorFound}.${minor}`;
            const url = `https://youngjoygame.com{testVer}/version/android/version.xml`;
            
            console.log(`[~] Mengecek Minor: ${testVer} ...`);
            const exists = await checkUrl(url);
            
            if (exists) {
                console.log(`[+] DITEMUKAN SUB-VERSION: ${testVer}`);
                highestMinor = minor; // Perbarui ke Minor tertinggi yang aktif
            } else {
                console.log(`[-] Minor ${testVer} tidak tersedia. Menghentikan eksplorasi Minor.`);
                // Berhenti jika Minor setelahnya mati (misal .1, .2, .3 hidup, .4 mati -> stop)
                break; 
            }
            await sleep(500);
        }
    }

    // === FASE UPDATE DATABASE ===
    const foundNewVersion = (highestMajor !== currentMajor || highestMinor !== currentMinor);

    if (foundNewVersion) {
        parts[parts.length - 2] = highestMajor.toString();
        parts[parts.length - 1] = highestMinor.toString();
        const newFullVer = parts.join('.');

        db.sClientVersion = newFullVer;
        
        const now = new Date().toISOString();
        db.lastUpdated = now;
        
        if (!db.updateHistory) db.updateHistory = [];
        
        db.updateHistory.push({
            version: newFullVer,
            detectedAt: now
        });
        
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
        console.log(`[+] Sukses! Database diperbarui ke versi tertinggi: ${newFullVer}`);
    } else {
        console.log(`[*] Tidak ada update baru. Versi saat ini tetap: ${currentFullVer}`);
    }
}

run();
