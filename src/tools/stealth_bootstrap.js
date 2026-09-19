import { debugLog } from "./utils";

// Target lib direkonstruksi saat runtime agar tidak tersimpan sebagai
// satu literal utuh di memory (evasi string-scan naif). Nilai aktual:
// "liblogic.so". Di-rest tetap terenkripsi XOR di dalam .so via hook_bytes.h.
const LIB_PARTS = ["lib", "logic", ".so"];
function targetLib() {
  return LIB_PARTS.join("");
}

const ASSEMBLY_NAME_PARTS = ["Assembly", "-CSharp"];
function assemblyName() {
  return ASSEMBLY_NAME_PARTS.join("");
}

// Max ~180 detik polling pasif (90 x ~2s + jitter).
const MAX_TRIES = 90;
const BASE_INTERVAL_MS = 1800;
const JITTER_MS = 700;

let started = false;
let fired = false;
let timer = null;

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

let nativeIsMapped = null;

function isLibMappedNative(libName) {
  try {
    if (nativeIsMapped === null) {
      const ptr = findNativeExport("is_target_lib_mapped_native");
      if (ptr) {
        try {
          nativeIsMapped = new NativeFunction(ptr, "int", ["pointer"]);
        } catch (e) {
          nativeIsMapped = null;
        }
      }
      if (!ptr) {
        // Tandai negatif agar tidak lookup tiap tick (hemat + stealth).
        nativeIsMapped = false;
      }
    }
    if (nativeIsMapped && nativeIsMapped !== false) {
      const namePtr = Memory.allocUtf8String(libName);
      const rc = nativeIsMapped(namePtr);
      return rc === 1;
    }
  } catch (e) {}
  return null; // unknown -> fallback ke JS check
}

function isLibMapped(libName) {
  const viaNative = isLibMappedNative(libName);
  if (viaNative === true) return true;
  if (viaNative === false) {
    // Native bilang belum ada — percaya (hasil /proc/self/maps),
    // tapi tetap verifikasi ringan via Frida sebagai fallback agar tidak
    // miss bila native belum siap.
  }
  try {
    const mod = Process.findModuleByName(libName);
    return !!(mod && !mod.isNull());
  } catch (e) {
    return false;
  }
}

function isAssemblyReady() {
  // Domain non-null BELUM berarti init selesai (Assembly-CSharp dibuat
  // belakangan). Cek langsung assembly-nya.
  try {
    const asm = Il2Cpp.domain.assembly(assemblyName());
    return !!(asm && asm.image);
  } catch (e) {
    return false;
  }
}

function stop() {
  try {
    if (timer) clearTimeout(timer);
  } catch (e) {}
  timer = null;
}

/**
 * Stealth bootstrap: 100% pasif, NOL Interceptor.attach selama inisiasi.
 *
 * Menggantikan 3 vektor deteksi lama:
 *  - hook eglSwapBuffers (EGL frame gate)
 *  - hook android_dlopen_ext/dlopen (linker monitor)
 *  - hook il2cpp_init (onLeave)
 * serta enumerateModules diagnostik.
 *
 * Sebagai gantinya hanya polling ringan dengan jitter:
 *  1. cek lib ter-map (prefer native /proc/self/maps check)
 *  2. cek Assembly-CSharp tersedia
 *  3. Il2Cpp.perform(execute) tepat sekali, lalu timer berhenti total.
 */
export function startStealthBootstrap(onReady) {
  if (started) return;
  started = true;
  const lib = targetLib();
  debugLog("Bootstrap", "Stealth init: passive wait (no hooks).");

  let tries = 0;

  const tick = () => {
    if (fired) {
      stop();
      return;
    }
    tries++;

    let ready = false;
    try {
      if (isLibMapped(lib) && isAssemblyReady()) {
        ready = true;
      }
    } catch (e) {
      ready = false;
    }

    if (ready) {
      fired = true;
      stop();
      debugLog("Bootstrap", "Runtime ready. Executing hooks...");
      try {
        Il2Cpp.$config.moduleName = lib;
        Il2Cpp.perform(() => {
          try {
            onReady(Il2Cpp.domain.assembly(assemblyName()).image);
          } catch (e) {
            debugLog("Bootstrap", "onReady failed: " + e.message);
          }
        });
      } catch (e) {
        fired = false;
        debugLog("Bootstrap", "Il2Cpp.perform failed: " + e.message);
      }
      return;
    }

    if (tries >= MAX_TRIES) {
      stop();
      debugLog("Bootstrap", "Runtime never appeared, hooks skipped.");
      return;
    }

    // Log progres hemat: tiap ~20 detik sekali (admin-only).
    if (tries % 10 === 0) {
      debugLog("Bootstrap", "still waiting (t~" + tries * 2 + "s).");
    }

    const delay = BASE_INTERVAL_MS + Math.floor(Math.random() * JITTER_MS);
    timer = setTimeout(tick, delay);
  };

  // Tick pertama sedikit ditunda + jitter agar tidak berpola di t=0.
  timer = setTimeout(tick, 1200 + Math.floor(Math.random() * 800));
}
