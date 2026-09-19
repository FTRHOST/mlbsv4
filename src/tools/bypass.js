import { debugLog } from "./utils";
import { findNativeExport } from "./hooking";

let bypassRequested = false;

// Stealth: patch libmoba.so dikerjakan di native (cfg_patch).
// JS hanya mendelegasikan sekali, tanpa Memory.protect/writeByteArray,
// tanpa console.log, tanpa interval agresif.
export function patchLibMoba(Assembly) {
  if (bypassRequested) return;
  bypassRequested = true;
  try {
    const ptr = findNativeExport(["cfg_patch", "patch_libmoba_native"]);
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
        const p = findNativeExport(["cfg_patch", "patch_libmoba_native"]);
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
