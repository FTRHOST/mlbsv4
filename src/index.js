/**
 * MLBB Core Hook Implementation - Modular & Debuggable
 */

import "frida-il2cpp-bridge";
import { sessionState } from "./tools/config";
import { debugLog } from "./tools/utils";
import { loadAuthCache } from "./tools/cache";

// Import Modular Hook Setup Functions
import { setupGMHooks } from "./mods/gm";
import { setupSkinHooks } from "./mods/skins";
import { setupUnreleasedHooks } from "./mods/unreleased";
import { setupBattleCommands } from "./mods/battle_commands";
import { setupTelemetryHooks } from "./mods/telemetry_hooks";

// Load auth cache immediately at global startup to determine user role
try {
  loadAuthCache();
} catch (e) {
  // Ignore
}

const TARGET_LIB = "liblogic.so";

debugLog("Bootstrap", "Menunggu library liblogic.so termuat...");
function main() {
  debugLog("Bootstrap", "Waiting for EGL Rendering to be ready...");

  let eglSwapBuffers = null;
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

  if (eglSwapBuffers) {
    let frameCount = 0;
    const eglHook = Interceptor.attach(eglSwapBuffers, {
      onEnter: function (args) {
        frameCount++;
        if (frameCount >= 2) {
          eglHook.detach();
          debugLog("Bootstrap", "EGL Rendering is READY.");
          waitForLogicLib();
        }
      },
    });
  } else {
    setTimeout(main, 50);
  }
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
          this.path = args[0].readUtf8String();
        },
        onLeave: function (retval) {
          if (this.path && this.path.indexOf(TARGET_LIB) !== -1) {
            monitor.detach();
            const targetMod = Process.getModuleByName(TARGET_LIB);
            setupIl2CppHook(targetMod);
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
      console.log("[-] UISystemTip classes not found.");
      return;
    }

    let uiInstance = uiClass.method("get_Instance").invoke();
    if (!uiInstance || uiInstance.handle.isNull()) {
      uiInstance = uiClass.field("_install").value;
    }

    if (!uiInstance || uiInstance.handle.isNull()) {
      console.log("[-] UISystemTip instance not active in current scene.");
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
    console.log(`[UI] Notification: [${title}] ${message}`);
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

  const mlleakVer = "MLLEAK v.0.5";
  setTimeout(() => {
    showGameNotification(
      mlleakVer,
      "Hi Leaker, now you can run chat command on battle. [00FF00]#help[-]: for see all command in game chat. stay tuned for the new feature. from mlleak dev :)",
    );
  }, 2000);

  // Setup Modular Mod Functions
  setupGMHooks(Assembly);
  setupSkinHooks(Assembly);
  setupUnreleasedHooks(Assembly);
  setupBattleCommands(Assembly);
  setupTelemetryHooks(Assembly);
}

setImmediate(main);
