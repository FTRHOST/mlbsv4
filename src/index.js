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
// Telemetry dimatikan (stealth): modul tidak di-bundle.
// import { setupTelemetryHooks } from "./mods/telemetry_hooks";
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
// Stealth: tanpa hook eglSwapBuffers (mudah terdeteksi). Langsung monitor
// liblogic.so secara pasif; Il2Cpp hook dipasang sekali via il2cpp_init.
function main() {
  waitForLogicLib();
}

function waitForLogicLib() {
  debugLog("Bootstrap", `Monitoring for ${TARGET_LIB}...`);

  const mod = Process.findModuleByName(TARGET_LIB);
  if (mod) {
    setupIl2CppHook(mod);
  } else {
    let dlopen = null;
    try {
      dlopen =
        Module.findExportByName(null, "android_dlopen_ext") ||
        Module.findExportByName(null, "dlopen");
    } catch (e) {
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
    }

    if (dlopen) {
      const monitor = Interceptor.attach(dlopen, {
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
              monitor.detach();
              const targetMod = Process.getModuleByName(TARGET_LIB);
              setupIl2CppHook(targetMod);
            }
          } catch (e) {
            // ignore
          }
        },
      });
    } else {
      debugLog("Bootstrap", "Error: Could not find dlopen to monitor.");
      setTimeout(waitForLogicLib, 1000);
    }
  }
}

function setupIl2CppHook(targetMod) {
  const il2cpp_init = targetMod.findExportByName
    ? targetMod.findExportByName("il2cpp_init")
    : targetMod.getExportByName("il2cpp_init");
  if (il2cpp_init) {
    const il2cpp_domain_get = targetMod.findExportByName
      ? targetMod.findExportByName("il2cpp_domain_get")
      : targetMod.getExportByName("il2cpp_domain_get");
    let isInitialized = false;
    if (il2cpp_domain_get) {
      const get_domain = new NativeFunction(il2cpp_domain_get, "pointer", []);
      if (!get_domain().isNull()) {
        isInitialized = true;
      }
    }

    if (isInitialized) {
      debugLog(
        "Bootstrap",
        `${targetMod.name} is ALREADY initialized. Executing hooks now...`,
      );
      executeSimpleHooks(targetMod);
    } else {
      Interceptor.attach(il2cpp_init, {
        onLeave: function (retval) {
          debugLog(
            "Bootstrap",
            `${targetMod.name} (il2cpp_init) finished. Executing hooks...`,
          );
          executeSimpleHooks(targetMod);
        },
      });
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

  // Setup Modular Mod Functions
  patchLibMoba(Assembly);
  setupGMHooks(Assembly);
  setupSkinHooks(Assembly);
  setupUnreleasedHooks(Assembly);
  setupBattleCommands(Assembly);
  // setupTelemetryHooks(Assembly);
  // setupUIHooks(Assembly); // Dinonaktifkan karena tidak work
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
