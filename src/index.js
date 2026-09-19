/**
 * MLBB Core Hook Implementation - Modular & Debuggable
 */

import "frida-il2cpp-bridge";
import { sessionState } from "./tools/config";
import { debugLog } from "./tools/utils";
import { loadAuthCache } from "./tools/cache";
import { verifyUserWithRestApiAsync } from "./tools/auth";
import { GIT_BRANCH, GIT_HASH } from "./env";

// Import Modular Hook Setup Functions
import { patchLibMoba } from "./tools/bypass";
import { setupGMHooks } from "./mods/gm";
import { setupSkinHooks } from "./mods/skins";
import { setupUnreleasedHooks } from "./mods/unreleased";
import { setupBattleCommands } from "./mods/battle_commands";
// Telemetry (hook + kirim data) dimatikan, tapi stub auth-only tetap dipakai:
// tanpa ini sessionState tidak pernah authorized dan semua gate mod mati.
import { setupTelemetryHooks } from "./mods/telemetry_hooks";
// import { setupUIHooks } from "./mods/ui_controller"; // Dinonaktifkan karena tidak work

// Load auth cache immediately at global startup to determine user role
try {
  loadAuthCache();
} catch (e) {
  // Ignore
}

// Trigger initial device registration immediately using android_id (m_uiID = "0")
try {
  verifyUserWithRestApiAsync("0");
} catch (e) {
  debugLog("Bootstrap", "Initial device registration failed: " + e.message);
}

const TARGET_LIB = "liblogic.so";

debugLog("Bootstrap", "Menunggu library liblogic.so termuat...");

// Readiness gate: tunggu frame EGL pertama (single-shot, langsung detach —
// praktis tak terdeteksi), karena lookup export linker di t=0 sering gagal.
// Fallback 15 detik bila EGL tak kunjung swap (headless/service process).
let eglGateDone = false;
function eglGatePass(reason) {
  if (eglGateDone || logicLibResolved) return;
  eglGateDone = true;
  debugLog("Bootstrap", "EGL gate passed (" + reason + ").");
  waitForLogicLib();
}

function main() {
  let eglSwapBuffers = null;
  try {
    const libEGL =
      Process.findModuleByName("libEGL.so") ||
      Process.findModuleByName("libGLESv2.so");
    if (libEGL) {
      try {
        eglSwapBuffers = libEGL.getExportByName("eglSwapBuffers");
      } catch (e) {
        eglSwapBuffers = null;
      }
    }
    if (!eglSwapBuffers) {
      try {
        eglSwapBuffers = Module.findExportByName(null, "eglSwapBuffers");
      } catch (e) {
        eglSwapBuffers = null;
      }
    }
  } catch (e) {
    eglSwapBuffers = null;
  }

  if (eglSwapBuffers) {
    try {
      const eglHook = Interceptor.attach(eglSwapBuffers, {
        onEnter: function (args) {
          try {
            eglHook.detach();
          } catch (e) {}
          eglGatePass("first-frame");
        },
      });
    } catch (e) {
      eglGatePass("egl-attach-fail");
    }
  } else {
    eglGatePass("no-egl-export");
  }
  // Fallback: jangan tergantung selamanya pada frame pertama.
  setTimeout(() => eglGatePass("timeout"), 15000);
  // Jalur cepat: bila lib sudah ter-map sejak awal, langsung resolve.
  waitForLogicLib();
}

let logicLibResolved = false;

function resolveLogicLib() {
  // Once-guard: cegah hook terpasang ganda bila monitor + poll fire bersamaan.
  if (logicLibResolved) return;
  let mod = null;
  try {
    mod = Process.findModuleByName(TARGET_LIB);
  } catch (e) {}
  if (!mod) return;
  logicLibResolved = true;
  try {
    if (logicLibMonitor) {
      logicLibMonitor.detach();
      logicLibMonitor = null;
    }
  } catch (e) {}
  try {
    if (logicLibPoll) {
      clearInterval(logicLibPoll);
      logicLibPoll = null;
    }
  } catch (e) {}
  setupIl2CppHook(mod);
}

let logicLibMonitor = null;
let logicLibPoll = null;

// Diagnostik (admin-only): daftar .so ter-map yang relevan agar dari logcat
// ketahuan nama lib sebenarnya bila TARGET_LIB tak kunjung muncul.
function dumpInterestingModules() {
  try {
    const names = [];
    const mods = Process.enumerateModules();
    for (let i = 0; i < mods.length; i++) {
      const n = mods[i].name;
      if (
        n.indexOf(".so") !== -1 &&
        (n.indexOf("logic") !== -1 ||
          n.indexOf("unity") !== -1 ||
          n.indexOf("Unity") !== -1 ||
          n.indexOf("il2cpp") !== -1 ||
          n.indexOf("moba") !== -1 ||
          n.indexOf("game") !== -1 ||
          n.indexOf("GLES") !== -1 ||
          n.indexOf("EGL") !== -1)
      ) {
        names.push(n);
      }
    }
    return names.join(",");
  } catch (e) {
    return "enum-fail:" + e.message;
  }
}

function ensureDlopenMonitor() {
  if (logicLibMonitor || logicLibResolved) return true;
  let dlopen = null;
  try {
    dlopen =
      Module.findExportByName(null, "android_dlopen_ext") ||
      Module.findExportByName(null, "dlopen");
  } catch (e) {
    try {
      const libc = Process.findModuleByName("libc.so");
      if (libc) {
        try {
          dlopen =
            libc.getExportByName("android_dlopen_ext") ||
            libc.getExportByName("dlopen");
        } catch (e2) {
          dlopen = null;
        }
      }
    } catch (e3) {}
  }

  if (!dlopen) return false;
  try {
    logicLibMonitor = Interceptor.attach(dlopen, {
      onEnter: function (args) {
        try {
          if (args[0]) {
            this.path = Memory.readCString(args[0]);
          }
        } catch (e) {
          this.path = null;
        }
      },
      onLeave: function (retval) {
        try {
          if (
            this.path &&
            typeof this.path === "string" &&
            this.path.indexOf(TARGET_LIB) !== -1
          ) {
            resolveLogicLib();
          }
        } catch (e) {
          // ignore
        }
      },
    });
    return true;
  } catch (e) {
    logicLibMonitor = null;
    return false;
  }
}

function waitForLogicLib() {
  if (logicLibResolved) return;
  debugLog("Bootstrap", `Monitoring for ${TARGET_LIB}...`);

  resolveLogicLib();
  if (logicLibResolved) return;

  const monOk = ensureDlopenMonitor();
  debugLog(
    "Bootstrap",
    `dlopen monitor: ${monOk ? "attached" : "NOT-FOUND"} | mapped: [${dumpInterestingModules()}]`,
  );

  // Anti-race fallback: poll pasif tiap 2 detik + coba ulang attach monitor
  // (lookup export di t=0 bisa gagal, sukses belakangan). Tiap ~10 detik
  // log sekali (admin-only) agar progres terpantau dari logcat.
  if (!logicLibPoll) {
    let tries = 0;
    logicLibPoll = setInterval(() => {
      tries++;
      try {
        resolveLogicLib();
        if (!logicLibResolved && !logicLibMonitor) ensureDlopenMonitor();
      } catch (e) {}
      if (tries % 5 === 0 && !logicLibResolved) {
        debugLog(
          "Bootstrap",
          `still waiting ${TARGET_LIB} (t=${tries * 2}s) mon=${logicLibMonitor ? "on" : "off"} mapped: [${dumpInterestingModules()}]`,
        );
      }
      if (logicLibResolved || tries >= 90) {
        try {
          clearInterval(logicLibPoll);
        } catch (e) {}
        logicLibPoll = null;
        if (!logicLibResolved) {
          debugLog("Bootstrap", `${TARGET_LIB} not found after 180s.`);
        }
      }
    }, 2000);
  }
}

function isAssemblyReady() {
  // Domain non-null BELUM berarti init selesai (Assembly-CSharp dibuat
  // belakangan). Cek langsung assembly-nya; ini yang dulu melempar
  // "couldn't find assembly Assembly-CSharp" dan membunuh script.
  try {
    const asm = Il2Cpp.domain.assembly("Assembly-CSharp");
    return !!(asm && asm.image);
  } catch (e) {
    return false;
  }
}

let hooksExecuted = false;

function executeWhenReady(reason) {
  if (hooksExecuted) return;
  if (isAssemblyReady()) {
    hooksExecuted = true;
    debugLog("Bootstrap", `Assemblies ready (${reason}). Executing hooks...`);
    try {
      executeSimpleHooks();
    } catch (e) {
      hooksExecuted = false;
      debugLog("Bootstrap", "executeSimpleHooks failed: " + e.message);
    }
    return;
  }
  // Belum siap: retry pasif tiap 1 detik (maks 60x), tanpa log per-tick.
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    try {
      if (isAssemblyReady() && !hooksExecuted) {
        hooksExecuted = true;
        clearInterval(timer);
        debugLog("Bootstrap", `Assemblies ready (${reason}, retry). Executing...`);
        executeSimpleHooks();
        return;
      }
    } catch (e) {}
    if (tries >= 60) {
      clearInterval(timer);
      debugLog("Bootstrap", "Assembly-CSharp never appeared, hooks skipped.");
    }
  }, 1000);
}

function setupIl2CppHook(targetMod) {
  const il2cpp_init = targetMod.findExportByName
    ? targetMod.findExportByName("il2cpp_init")
    : targetMod.getExportByName("il2cpp_init");
  if (il2cpp_init) {
    const il2cpp_domain_get = targetMod.findExportByName
      ? targetMod.findExportByName("il2cpp_domain_get")
      : targetMod.getExportByName("il2cpp_domain_get");
    let domainExists = false;
    if (il2cpp_domain_get) {
      try {
        const get_domain = new NativeFunction(il2cpp_domain_get, "pointer", []);
        if (!get_domain().isNull()) {
          domainExists = true;
        }
      } catch (e) {}
    }

    if (domainExists && isAssemblyReady()) {
      debugLog(
        "Bootstrap",
        `${targetMod.name} is ALREADY initialized. Executing hooks now...`,
      );
      executeWhenReady("already-initialized");
    } else {
      try {
        Interceptor.attach(il2cpp_init, {
          onLeave: function (retval) {
            executeWhenReady("il2cpp_init");
          },
        });
      } catch (e) {
        debugLog("Bootstrap", "il2cpp_init attach failed: " + e.message);
      }
      // Bila domain sudah ada tapi assembly belum (kasus 06:52), onLeave
      // tidak akan fire lagi — retry pasif yang meng-cover.
      if (domainExists) executeWhenReady("domain-exists");
    }
  } else {
    debugLog("Bootstrap", `Error: il2cpp_init not found in ${targetMod.name}`);
  }
}

export function showGameNotification(title, message) {
  Il2Cpp.mainThread.schedule(() => {
    const dataClass = Il2Cpp.domain
      .assembly("Assembly-CSharp")
      .image.class("SystemTipData");
    const uiClass = Il2Cpp.domain
      .assembly("Assembly-CSharp")
      .image.class("UISystemTip");
    const enumClass = Il2Cpp.domain
      .assembly("Assembly-CSharp")
      .image.class("eSystemTipType");

    if (!dataClass || !uiClass || !enumClass) {
      debugLog("UI", "UISystemTip classes not found.");
      return;
    }

    let uiInstance = uiClass.method("get_Instance").invoke();
    if (!uiInstance || uiInstance.handle.isNull()) {
      uiInstance = uiClass.field("_install").value;
    }

    if (!uiInstance || uiInstance.handle.isNull()) {
      debugLog("UI", "UISystemTip instance not active in current scene.");
      return;
    }

    const data = dataClass.alloc();
    data.method(".ctor").invoke();
    data.field("strTip").value = Il2Cpp.string(message);
    data.field("strCmd").value = Il2Cpp.string("OK");
    data.field("strCancel").value = Il2Cpp.string("Cancel");

    const enumValue = enumClass.field("SimpleTxt_Confirm").value;
    data.field("type").value = enumValue;

    const titleField =
      uiInstance.field("strTitile") || uiInstance.field("strTitle");
    if (titleField) titleField.value = Il2Cpp.string(title);

    const dataField = uiInstance.field("data");
    if (dataField) dataField.value = data;

    uiInstance.method("Active").invoke(data);
    debugLog("UI", `Notification: [${title}] ${message}`);
  });
}

function executeSimpleHooks() {
  Il2Cpp.$config.moduleName = "liblogic.so";

  try {
    loadAuthCache();
  } catch (e) {
    debugLog("Bootstrap", `Failed loading startup auth cache: ${e.message}`);
  }

  const Assembly = Il2Cpp.domain.assembly("Assembly-CSharp").image;

  const mlleakVer =
    GIT_BRANCH === "testing" ? `MLLEAK TESTING (${GIT_HASH})` : "MLLEAK v.0.8";

  // Setup StartGame delay hook first to wait for OTA/Auth readiness
  // setupGameStartDelay(Assembly);

  // Setup Modular Mod Functions — tiap modul dibungkus agar satu modul
  // yang gagal tidak membunuh modul lain (kasus Assembly-CSharp kemarin).
  const safeSetup = (name, fn) => {
    try {
      fn(Assembly);
    } catch (e) {
      debugLog("Bootstrap", `${name} skipped: ${e.message}`);
    }
  };
  safeSetup("patchLibMoba", patchLibMoba);
  safeSetup("setupGMHooks", setupGMHooks);
  safeSetup("setupSkinHooks", setupSkinHooks);
  safeSetup("setupUnreleasedHooks", setupUnreleasedHooks);
  safeSetup("setupBattleCommands", setupBattleCommands);
  // Auth-only (poll operator ID untuk lisensi; tanpa hook/pengiriman data)
  safeSetup("setupTelemetryHooks", setupTelemetryHooks);
  // setupUIHooks(Assembly); // Dinonaktifkan karena tidak work
  debugLog("Bootstrap", "All hook modules installed.");
}

function setupGameStartDelay(Assembly) {
  try {
    const GameStart = Assembly.class("GameStart");
    if (!GameStart) {
      debugLog(
        "GameStart",
        "Class GameStart tidak ditemukan di Assembly-CSharp.",
      );
      return;
    }
    const startGameMethod = GameStart.method("StartGame");
    if (!startGameMethod) {
      debugLog(
        "GameStart",
        "Method StartGame tidak ditemukan pada class GameStart.",
      );
      return;
    }

    const targetPointer = startGameMethod.virtualAddress;
    if (targetPointer && !targetPointer.isNull()) {
      Interceptor.attach(targetPointer, {
        onEnter: function (args) {
          debugLog("GameStart", "StartGame terpicu, menunggu OTA & Auth...");

          const maxTimeoutSec = 50;
          const pollIntervalSec = 0.2;
          const maxLoops = Math.floor(maxTimeoutSec / pollIntervalSec);
          let loops = 0;

          while (loops < maxLoops) {
            if (sessionState.isFullyReady) {
              debugLog(
                "GameStart",
                `OTA & Auth selesai dalam ${(loops * pollIntervalSec).toFixed(1)} detik.`,
              );
              break;
            }
            Thread.sleep(pollIntervalSec);
            loops++;
          }

          if (loops >= maxLoops) {
            debugLog("GameStart", "Timeout 50 detik, melanjutkan StartGame...");
          }
        },
      });
      debugLog(
        "GameStart",
        "Hook penundaan GameStart.StartGame berhasil dipasang.",
      );
    } else {
      debugLog("GameStart", "Alamat fungsi StartGame tidak ditemukan.");
    }
  } catch (err) {
    debugLog(
      "GameStart",
      `Error pada hook penundaan GameStart: ${err.message}`,
    );
  }
}

setImmediate(main);
