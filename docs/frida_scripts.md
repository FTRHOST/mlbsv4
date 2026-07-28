# Dokumentasi Script Frida MLBB (mlbsv4/src)

Dokumen ini menjelaskan arsitektur, alur kerja, dan konteks dari script Frida yang terdapat di dalam direktori `src`. Sistem ini dibangun dengan arsitektur modular untuk melakukan *hooking* dan memodifikasi *behavior* game (Mobile Legends: Bang Bang) melalui Frida dan *frida-il2cpp-bridge*.

## Arsitektur & Struktur Direktori

Kode sumber dibagi menjadi tiga bagian utama:

1. **Entry Point (`index.js`)**
2. **Modules/Mods (`mods/`)**
3. **Tools/Utilities (`tools/`)**

### 1. Entry Point (`src/index.js`)
File ini berfungsi sebagai *bootstrap* atau inisialisasi utama. Alur kerjanya adalah sebagai berikut:
- **EGL Waiter**: Menunggu mesin *rendering* grafis (libEGL / libGLESv2) siap sebelum melanjutkan injeksi.
- **Library Monitor**: Memantau dan memuat library target `liblogic.so` yang berisi *engine* IL2CPP game.
- **IL2CPP Initialization**: Memastikan `il2cpp_init` selesai dijalankan sebelum memasang *hooks*.
- **Authentication**: Memuat *cache* autentikasi pengguna secara lokal untuk menentukan peran (*role*) dan fitur (seperti VIP, Admin, dll).
- **Hooks Setup**: Setelah semua siap, script menyuntikkan notifikasi pop-up *(UISystemTip)* ke dalam game dan memanggil semua fungsi pengaturan *hook* dari modul `mods`.

### 2. Direktori Mods (`src/mods/`)
Direktori ini menampung logika *hooking* spesifik untuk masing-masing fitur *cheat* atau modifikasi:

- **`gm.js` (GM Mode)**:
  Me-rekayasa pengecekan fungsi *sandbox* atau Game Master. Jika pengguna memiliki izin `allowGMMode`, *hook* akan memaksa fungsi seperti `IsSandBoxIp` (di `GameInit`) agar me-return `true`.

- **`skins.js` (Free Skin)**:
  Membuka skin secara gratis dengan mencegat (intercept) metode `BActFreeSkin` pada class `ChooseHeroMgr` untuk selalu me-return nilai `1 (true)`.

- **`unreleased.js` (Unreleased Content)**:
  Bertugas untuk mem-bypass filter pembatasan data aktivitas dan hero yang dilarang.
  - Mematikan pengecekan MD5 dan ASTC (`CheckFileMd5_SubThread`, `CheckAndFixASTC_SubThread`).
  - Memanipulasi aktivitas data (seperti ID 626 & 209).
  - Mengabaikan pembatasan pemakaian hero dengan memaksa fungsi `IsForbidHeros` dan `IsActivityForbidHeros` mengembalikan nilai false.

- **`battle_commands.js` (In-Game Commands)**:
  Membaca dan memanipulasi obrolan (*chat*) dalam pertandingan melalui kelas `BattleBridge`. 
  - Jika pesan obrolan sesuai dengan format *command* (misal: `#nocd` atau `#!nocd`), maka skrip akan mengeksekusi instruksi tersebut.
  - `#nocd` menonaktifkan masa tunggu keterampilan (*cooldown* skill) dengan mematikan perhitungan fungsi `EnterCoolDown` pada `Battle.CoolDownData`.

- **`telemetry_hooks.js` (Data & Telemetry Extraction)**:
  Merupakan skrip paling ekstensif untuk memantau, menyalin, dan mengirim (*telemetry*) state pertandingan secara *real-time* ke server eksternal. Fiturnya meliputi:
  - Memonitor fase pemilihan hero (*draft pick/ban phase*).
  - Mengoleksi identitas pemain, tim, *battle spell*, emblem yang dipakai.
  - Merekam data statistik pertempuran (gold, tower, kill, lord, turtle).
  - Melakukan pengecekan ID operator dan validasi *role* pengguna secara berkala melalui API (`verifyUserWithRestApiAsync`).

### 3. Direktori Tools (`src/tools/`)
Berisi utilitas bantuan untuk mendukung logika di `mods` dan `index.js`:

- **`config.js`**: Manajemen *Role* (Admin, VIP, User, Leaker) dan penyimpanan `sessionState` yang digunakan oleh modul-modul lain untuk mengizinkan atau menolak suatu fitur dimuat.
- **`auth.js` & `cache.js`**: Menangani otentikasi REST API dan penyimpanan *cache* data sesi otentikasi.
- **`crypto.js`**: Enkripsi dan dekripsi ringan (jika diperlukan untuk API).
- **`telemetry.js`**: Bertanggung jawab untuk mengirimkan metrik dan laporan pertandingan (Draft & Match Data) menuju server *telemetry*.
- **`utils.js`**: Berfungsi untuk *logging* dan mencetak *debug* dengan format yang rapi di konsol Frida.

## Alur Kerja Keseluruhan (Workflow)
1. **Load Frida Script**: Frida melakukan injeksi terhadap aplikasi game dan menjalankan `index.js`.
2. **Cek Role**: `config.js` mengevaluasi tingkat akses pemain.
3. **Pemasangan Mod**: Modul di `mods/` memeriksa izin pengguna melalui `sessionState.permissions`. Jika diizinkan, Interceptor (Hooks) untuk class IL2CPP yang bersangkutan akan dipasang.
4. **Eksekusi In-Game**: Saat pemain berinteraksi dengan komponen UI/Game (seperti memilih skin atau chat), kode asli game akan tertahan, dan *logic* dari script Frida ini akan dijalankan untuk memanipulasi *return value* atau merubah nilai di memori secara dinamis.
5. **Real-time Telemetry**: Data aktivitas (contohnya *banning* hero, membunuh Lord) disadap oleh `telemetry_hooks.js` dan dilaporkan ke backend secara berkala.
