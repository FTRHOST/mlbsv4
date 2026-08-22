/**
 * UI Controller Hook Module - Advanced Debugging & Activation
 */

import { debugLog } from "../tools/utils";

export function setupUIHooks(Assembly) {
  const BaseFrame = Assembly.class("BaseFrame");
  const UIMgr = Assembly.class("UIMgr");
  const BridgeClass = Assembly.class("MobaScriptBridge");

  let uiMgrInstance = null;
  let lastActivationTime = 0;

  // Hook UIMgr.Update untuk mendapatkan instance
  if (UIMgr) {
    const update = UIMgr.method("Update");
    if (update) {
      update.implementation = function () {
        uiMgrInstance = this;
        return this.method("Update").invoke();
      };
    }
  }

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

  // Fungsi untuk memicu aktivasi UI_GM
  function triggerGMAktivasi() {
    const now = Date.now();
    if (now - lastActivationTime < 5000) return;
    lastActivationTime = now;

    Il2Cpp.mainThread.schedule(() => {
      try {
        debugLog("UI Mod", "Attempting force activate UI_GM...");
        
        // Coba via Bridge
        const bridgeInstance = BridgeClass.method("GetInstance").invoke();
        if (bridgeInstance && !bridgeInstance.isNull()) {
          bridgeInstance.method("ToUIFrame").invoke(Il2Cpp.string("UI_GM"));
          debugLog("UI Mod", "Bridge ToUIFrame invoked for UI_GM.");
        }

        // Coba via UIMgr instance jika ada
        if (uiMgrInstance) {
          debugLog("UI Mod", "UIMgr instance found, attempting direct activation...");
          // Coba panggil metode aktivasi di UIMgr jika ada yang relevan
          // Berdasarkan dump, ada `ActiveEnd`, `ShowHistoryView`
        }
      } catch (e) {
        debugLog("UI Mod", "Trigger activation failed: " + e.message);
      }
    });
  }

  debugLog("UI Mod", "Advanced UI Controller & Activator Active.");
}
