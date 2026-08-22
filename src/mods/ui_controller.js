/**
 * UI Controller Hook Module - Advanced Debugging & Forced Instantiation
 */

import { debugLog } from "../tools/utils";

export function setupUIHooks(Assembly) {
  const BaseFrame = Assembly.class("BaseFrame");
  const UIMgr = Assembly.class("UIMgr");
  const BridgeClass = Assembly.class("MobaScriptBridge");
  const GMUIClass = Assembly.class("UI_GMUI"); // Akan kita cek eksistensinya

  // 1. Hook BaseFrame.Active
  if (BaseFrame) {
    const Active = BaseFrame.method("Active");
    if (Active) {
      Active.implementation = function (arg) {
        try {
          const nameField = this.field("name");
          if (nameField) {
            const name = nameField.value.toString();
            if (name.indexOf("UI_GM_MainInterface") !== -1) {
              debugLog("UI Mod", ">>> BLOCKING: " + name + " <<<");
              triggerGMAktivasi();
              return; 
            }
          }
        } catch (e) {}
        return this.method("Active").invoke(arg);
      };
    }
  }

  // 2. Fungsi untuk memaksa aktivasi
  function triggerGMAktivasi() {
    Il2Cpp.mainThread.schedule(() => {
      try {
        debugLog("UI Mod", "--- STARTING DEEP ACTIVATION ---");
        
        // A. Cek apakah kelas UI_GMUI ada
        if (GMUIClass && !GMUIClass.handle.isNull()) {
            debugLog("UI Mod", "Found class UI_GMUI, attempting to get Instance...");
            // Beberapa UI memiliki get_Instance() statis
            const instance = GMUIClass.method("get_Instance").invoke();
            if (instance && !instance.isNull()) {
                debugLog("UI Mod", "Instance found, calling Active()...");
                instance.method("Active").invoke(null);
            }
        } else {
            debugLog("UI Mod", "Class UI_GMUI not found or not loaded!");
        }

        // B. Coba via Bridge
        const bridgeInstance = BridgeClass.method("GetInstance").invoke();
        if (bridgeInstance && !bridgeInstance.isNull()) {
          bridgeInstance.method("ToUIFrame").invoke(Il2Cpp.string("UI_GM"));
          debugLog("UI Mod", "ToUIFrame('UI_GM') invoked.");
        }
      } catch (e) {
        debugLog("UI Mod", "Activation error: " + e.message);
      }
    });
  }

  debugLog("UI Mod", "Debug Activator Ready.");
}
