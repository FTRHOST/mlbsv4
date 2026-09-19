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

// Frame gate: tunggu swap-buffer ke-2 SETELAH runtime ready, agar eksekusi
// hook tidak terlalu dini (rendering belum stabil). Hook dipasang telat dan
// langsung detach — jendela keterdeteksiannya hanya milidetik, tidak seperti
// pola lama yang attach sejak t=0. Selalu selesai via fallback bila EGL
// tidak ada / attach gagal / timeout.
function waitForSecondFrame(onDone) {
  let done = false;
  let hook = null;
  const finish = (reason) => {
    if (done) return;
    done = true;
    try {
      if (hook) hook.detach();
    } catch (e) {}
    hook = null;
    debugLog("Bootstrap", "Frame gate passed (" + reason + ").");
    try {
      onDone();
    } catch (e) {
      debugLog("Bootstrap", "Frame gate onDone failed: " + e.message);
    }
  };

  let addr = null;
  try {
    try {
      const libEGL =
        Process.findModuleByName("libEGL.so") ||
        Process.findModuleByName("libGLESv2.so");
      if (libEGL) {
        try {
          addr = libEGL.getExportByName("eglSwapBuffers");
        } catch (e) {
          addr = null;
        }
      }
    } catch (e) {
      addr = null;
    }
    if (!addr) {
      try {
        addr = Module.findExportByName(null, "eglSwapBuffers");
      } catch (e) {
        addr = null;
      }
    }
  } catch (e) {
    addr = null;
  }

  if (addr && !addr.isNull()) {
    try {
      let frames = 0;
      hook = Interceptor.attach(addr, {
        onEnter() {
          frames++;
          if (frames >= 2) finish("second-frame");
        },
      });
      // Fallback: jangan tergantung selamanya pada frame.
      setTimeout(() => finish("timeout"), 15000);
      return;
    } catch (e) {
      finish("attach-fail");
      return;
    }
  }
  finish("no-egl");
}

/**
 * Stealth bootstrap: pasif selama inisiasi, 1 single-shot hook setelah ready.
 *
 * Fase tunggu (tanpa hook apa pun):
 *  - TIDAK ada monitor android_dlopen_ext/dlopen
 *  - TIDAK ada hook il2cpp_init
 *  - TIDAK ada enumerateModules diagnostik
 *  Hanya polling ringan berjitter:
 *  1. pin Il2Cpp.$config.moduleName ke lib game (wajib sebelum bridge dipakai)
 *  2. cek lib ter-map (prefer native /proc/self/maps check)
 *  3. cek Assembly-CSharp tersedia
 *
 * Fase gate (setelah runtime ready): SATU single-shot hook eglSwapBuffers
 * yang langsung detach setelah frame ke-2, agar hook terpasang hanya
 * milidetik saat rendering sudah berjalan (bukan sejak t=0 seperti dulu).
 * Fallback timeout 15 dtk bila EGL tak kunjung swap (headless/service).
 * Terakhir: Il2Cpp.perform(execute) tepat sekali, timer berhenti total.
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
      debugLog("Bootstrap", "Runtime ready. Waiting for 2nd frame...");
      waitForSecondFrame(() => {
        debugLog("Bootstrap", "Executing hooks...");
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
      });
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
