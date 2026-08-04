export function patchLibMoba(Assembly) {
  const moduleName = "libmoba.so";

  // 1. Tunggu sampai libmoba.so dimuat di memori
  console.log("[Bypass] Waiting for libmoba.so...");
  let libmoba = null;

  // Gunakan interval untuk memeriksa modul secara berkala (setiap 2 detik)
  const checkModule = setInterval(() => {
    libmoba = Process.findModuleByName(moduleName);

    if (libmoba !== null) {
      clearInterval(checkModule); // Hentikan perulangan jika ditemukan
      console.log(
        `[Bypass] ${moduleName} found at ${libmoba.base}. Applying patches...`,
      );

      // 2. Daftar offset dan hex bytes yang akan dipatch
      const patches = [
        {
          offset: 0x709b8,
          bytes: [0x00, 0x00, 0x80, 0xd2, 0xc0, 0x03, 0x5f, 0xd6],
        }, // mov x0, #0; ret
        {
          offset: 0xcedd0,
          bytes: [0x20, 0x00, 0x80, 0xd2, 0xc0, 0x03, 0x5f, 0xd6],
        }, // mov x0, #1; ret
        {
          offset: 0xcef50,
          bytes: [0x20, 0x00, 0x80, 0xd2, 0xc0, 0x03, 0x5f, 0xd6],
        },
        {
          offset: 0xe5010,
          bytes: [0x20, 0x00, 0x80, 0xd2, 0xc0, 0x03, 0x5f, 0xd6],
        },
        {
          offset: 0x558fc,
          bytes: [0x00, 0x00, 0x80, 0xd2, 0xc0, 0x03, 0x5f, 0xd6],
        },
      ];

      // 3. Eksekusi patch ke memori
      patches.forEach((p) => {
        const targetAddress = libmoba.base.add(p.offset);

        // Ubah izin memori menjadi Read-Write-Execute agar bisa ditulis
        Memory.protect(targetAddress, p.bytes.length, "rwx");

        // Tulis byte baru ke alamat tujuan
        targetAddress.writeByteArray(p.bytes);

        console.log(
          `[Bypass] Patched offset 0x${p.offset.toString(16).toUpperCase()} at ${targetAddress}`,
        );
      });

      console.log("[Bypass] Successfully applied 5 patches to libmoba.so");
    }
  }, 100);

  const GameMain = Assembly.class("GameMain");
  const PlugInTesting = GameMain.method("PlugInTesting");
  PlugInTesting.implementation = function () {};

  const APKSignature = Assembly.class("APKSignature");
  const IsSignatureSame = APKSignature.method("IsSignatureSame");
  IsSignatureSame.implementation = function (kSignature) {
    return true;
  };
}
