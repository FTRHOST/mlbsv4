/**
 * MLBB Core Hook Implementation - Modular & Debuggable (Stealth Bootstrap)
 *
 * Inisiasi PASIF + single-shot frame gate:
 *  - TIDAK ada hook android_dlopen_ext/dlopen (linker monitor dihapus)
 *  - TIDAK ada hook il2cpp_init
 *  - TIDAK ada Process.enumerateModules diagnostik
 *  - SATU hook eglSwapBuffers single-shot yang dipasang TELAT (hanya setelah
 *    runtime ready) dan langsung detach setelah frame ke-2, agar eksekusi
 *    tidak terlalu dini saat rendering belum stabil.
 *
 * Sebagai gantinya polling ringan berjitter di src/tools/stealth_bootstrap.js:
 * cek lib ter-map (prefer native /proc/self/maps via is_target_lib_mapped_native)
 * + Assembly-CSharp tersedia, lalu tepat-sekali Il2Cpp.perform(execute).
 * Seluruh string sensitif juga dienkripsi-at-rest (XOR hook_bytes.h) oleh pipeline
 * native-patcher/encrypt.py, jadi tidak ada plaintext di .so.
 */

import "frida-il2cpp-bridge";
import { sessionState } from "./tools/config";
import { debugLog } from "./tools/utils";
import { loadAuthCache } from "./tools/cache";
import { verifyUserWithRestApiAsync } from "./tools/auth";
import { startStealthBootstrap } from "./tools/stealth_bootstrap";
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

debugLog("Bootstrap", "Memulai Frida Il2Cpp Stealth Agent...");

startStealthBootstrap((Assembly) => {
  executeSimpleHooks(Assembly);
});

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

function executeSimpleHooks(Assembly) {
  try {
    loadAuthCache();
  } catch (e) {
    debugLog("Bootstrap", `Failed loading startup auth cache: ${e.message}`);
  }

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
