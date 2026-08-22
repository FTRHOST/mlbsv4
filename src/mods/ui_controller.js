/**
 * UI Controller Hook Module - Aggressive Blocking & Redirection
 */

import { debugLog } from "../tools/utils";

export function setupUIHooks(Assembly) {
  const BaseFrame = Assembly.class("BaseFrame");
  const UIMgr = Assembly.class("UIMgr");
  const BridgeClass = Assembly.class("MobaScriptBridge");

  let lastActivationTime = 0;

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

  // 2. Hook UIMgr._TryCreateBasePanelByName
  if (UIMgr) {
    const tryCreate = UIMgr.method("_TryCreateBasePanelByName");
    if (tryCreate) {
      tryCreate.implementation = function (name) {
        try {
          const nameStr = name.toString();
          if (nameStr.indexOf("UI_GM_MainInterface") !== -1) {
            debugLog("UI Mod", ">>> BLOCKING UIMgr Creation: " + nameStr + " Redirecting... <<<");
            triggerGMAktivasi();
            return;
          }
        } catch (e) {}
        return this.method("_TryCreateBasePanelByName").invoke(name);
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
        
        const bridgeInstance = BridgeClass.method("GetInstance").invoke();
        if (bridgeInstance && !bridgeInstance.isNull()) {
          // Coba kedua variasi nama
          bridgeInstance.method("ToUIFrame").invoke(Il2Cpp.string("UI_GMUI"));
          bridgeInstance.method("ToUIFrame").invoke(Il2Cpp.string("UI_GM"));
          debugLog("UI Mod", "Bridge ToUIFrame invoked for UI_GMUI and UI_GM.");
        } else {
          debugLog("UI Mod", "Bridge instance not found.");
        }
      } catch (e) {
        debugLog("UI Mod", "Trigger activation failed: " + e.message);
      }
    });
  }

  debugLog("UI Mod", "Aggressive UI Blocker & Redirector Active.");
}
