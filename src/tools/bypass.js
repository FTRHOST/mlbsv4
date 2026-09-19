import { debugLog } from "./utils";

let bypassRequested = false;

function findNativeExport(name) {
  try {
    const modules = Process.enumerateModules();
    for (let i = 0; i < modules.length; i++) {
      if (modules[i].name.indexOf("mypatch") !== -1) {
        try {
          const exp = modules[i].findExportByName(name);
          if (exp && !exp.isNull()) return exp;
        } catch (e) {}
      }
    }
  } catch (e) {}
  try {
    const exp = Module.findExportByName(null, name);
    if (exp && !exp.isNull()) return exp;
  } catch (e) {}
  return null;
}

// Stealth: patch libmoba.so dikerjakan di native (cfg_patch).
// JS hanya mendelegasikan sekali, tanpa Memory.protect/writeByteArray,
// tanpa console.log, tanpa interval agresif.
export function patchLibMoba(Assembly) {
  if (bypassRequested) return;
  bypassRequested = true;
  try {
    const ptr = findNativeExport("cfg_patch");
    if (ptr) {
      try {
        const patchNative = new NativeFunction(ptr, "int", []);
        const rc = patchNative();
        debugLog("Bypass", "Native libmoba patch delegated (rc=" + rc + ").");
      } catch (e) {
        debugLog("Bypass", "Native patch call failed: " + e.message);
      }
      return;
    }
    // Native belum tersedia (mis. fallback script): poll pasif, maks 30x/500ms,
    // lalu diam. Tidak ada patch dari JS agar tidak meninggalkan jejak RWX.
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      try {
        const p = findNativeExport("cfg_patch");
        if (p) {
          try {
            new NativeFunction(p, "int", [])();
            debugLog("Bypass", "Native libmoba patch applied (deferred).");
          } catch (e) {}
          clearInterval(timer);
          return;
        }
        if (Process.findModuleByName("libmoba.so")) {
          debugLog("Bypass", "libmoba present, waiting for native patcher.");
        }
      } catch (e) {}
      if (tries >= 30) {
        clearInterval(timer);
        debugLog("Bypass", "Native patcher unavailable, skipping JS patch (stealth).");
      }
    }, 500);
  } catch (e) {
    debugLog("Bypass", "patchLibMoba skipped: " + e.message);
  }
}
