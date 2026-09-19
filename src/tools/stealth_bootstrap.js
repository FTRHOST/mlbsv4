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

// WAJIB sebelum akses bridge apa pun: tanpa ini frida-il2cpp-bridge
// mencari modul default "libil2cpp.so" (getExpectedModuleNames) yang tidak
// ada di proses ini, sehingga Il2Cpp.domain.assembly() selalu melempar
// "Could not find IL2CPP module" dan readiness tak pernah true.
// Idempoten — aman dipanggil tiap tick.
function ensureBridgeModule(lib) {
  try {
    if (Il2Cpp.$config.moduleName !== lib) {
      Il2Cpp.$config.moduleName = lib;
    }
  } catch (e) {}
}

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

function isLibMappedFrida(libName) {
  try {
    const mod = Process.findModuleByName(libName);
    return !!(mod && !mod.isNull());
  } catch (e) {
    return false;
  }
}

function probeAssembly() {
  // Domain non-null BELUM berarti init selesai (Assembly-CSharp dibuat
  // belakangan). Cek langsung assembly-nya; kembalikan error agar
  // diagnostik admin bisa menunjukkan penyebab pasti.
  try {
    const asm = Il2Cpp.domain.assembly(assemblyName());
    if (asm && asm.image) return { ok: true, err: "" };
    return { ok: false, err: "assembly-null" };
  } catch (e) {
    return { ok: false, err: String((e && e.message) || e).slice(0, 120) };
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
 *  1. pin Il2Cpp.$config.moduleName ke lib game (wajib sebelum bridge dipakai)
 *  2. cek lib ter-map (prefer native /proc/self/maps check)
 *  3. cek Assembly-CSharp tersedia
 *  4. Il2Cpp.perform(execute) tepat sekali, lalu timer berhenti total.
 */
export function startStealthBootstrap(onReady) {
  if (started) return;
  started = true;
  const lib = targetLib();
  ensureBridgeModule(lib);
  debugLog("Bootstrap", "Stealth init: passive wait (no hooks).");

  let tries = 0;

  const scheduleNext = () => {
    const delay = BASE_INTERVAL_MS + Math.floor(Math.random() * JITTER_MS);
    timer = setTimeout(tick, delay);
  };

  const tick = () => {
    if (fired) {
      stop();
      return;
    }
    tries++;
    ensureBridgeModule(lib);

    let libNative = null;
    let libFrida = false;
    let asmErr = "";
    let ready = false;
    try {
      libNative = isLibMappedNative(lib);
      libFrida = libNative === true ? true : isLibMappedFrida(lib);
      if (libNative === true || libFrida) {
        const probe = probeAssembly();
        asmErr = probe.err;
        ready = probe.ok;
      } else {
        asmErr = "lib-not-mapped";
      }
    } catch (e) {
      asmErr = String((e && e.message) || e).slice(0, 120);
      ready = false;
    }

    if (ready) {
      fired = true;
      stop();
      debugLog("Bootstrap", "Runtime ready. Executing hooks...");
      try {
        Il2Cpp.perform(() => {
          try {
            onReady(Il2Cpp.domain.assembly(assemblyName()).image);
          } catch (e) {
            debugLog("Bootstrap", "onReady failed: " + e.message);
          }
        });
      } catch (e) {
        // Gagal sync: buka lagi agar polling lanjut (jangan mati diam-diam).
        fired = false;
        debugLog("Bootstrap", "Il2Cpp.perform failed: " + e.message);
        scheduleNext();
      }
      return;
    }

    if (tries >= MAX_TRIES) {
      stop();
      debugLog(
        "Bootstrap",
        "Runtime never appeared, hooks skipped. diag libN=" +
          libNative +
          " libF=" +
          (libFrida ? 1 : 0) +
          " asm=" +
          asmErr,
      );
      return;
    }

    // Log progres hemat: tiap ~20 detik sekali (admin-only), sertakan
    // status nyata agar kegagalan di device bisa didiagnosis dari logcat.
    if (tries % 10 === 0) {
      debugLog(
        "Bootstrap",
        "still waiting (t~" +
          tries * 2 +
          "s) diag libN=" +
          libNative +
          " libF=" +
          (libFrida ? 1 : 0) +
          " asm=" +
          asmErr,
      );
    }

    scheduleNext();
  };

  // Tick pertama sedikit ditunda + jitter agar tidak berpola di t=0.
  timer = setTimeout(tick, 1200 + Math.floor(Math.random() * 800));
}
