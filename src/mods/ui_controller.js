/**
 * UI Controller Hook Module - Advanced Debugging & Activation
 */

import { debugLog } from "../tools/utils";

export function setupUIHooks(Assembly) {
  const BaseFrame = Assembly.class("BaseFrame");
  const UIMgr = Assembly.class("UIMgr");
  const BridgeClass = Assembly.class("MobaScriptBridge");
  const GMUIClass = Assembly.class("UI_GMUI");

  let uiMgrInstance = null;
  let lastActivationTime = 0;

  // Hook UIMgr.Update
  if (UIMgr) {
    const update = UIMgr.method("Update");
    if (update) {
      update.implementation = function () {
        uiMgrInstance = this;
        return this.method("Update").invoke();
      };
    }
  }

  // Hook BaseFrame.Active
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

  // Hook UI_GMUI.InitView to see if it triggers
  if (GMUIClass) {
    const initView = GMUIClass.method("InitView");
    if (initView) {
      initView.implementation = function () {
        debugLog("UI Mod", ">>> UI_GMUI.InitView triggered! <<<");
        return this.method("InitView").invoke();
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
        debugLog("UI Mod", "Attempting force activate UI_GM variants...");
        
        const bridgeInstance = BridgeClass.method("GetInstance").invoke();
        if (bridgeInstance && !bridgeInstance.isNull()) {
          // Coba semua variasi nama yang mungkin
          const names = ["UI_GM", "UI_GMUI", "UI_GM_MainInterface"];
          names.forEach(name => {
              debugLog("UI Mod", "Bridge: ToUIFrame('" + name + "')");
              bridgeInstance.method("ToUIFrame").invoke(Il2Cpp.string(name));
          });
        }
      } catch (e) {
        debugLog("UI Mod", "Trigger activation failed: " + e.message);
      }
    });
  }

  debugLog("UI Mod", "Advanced UI Controller & Activator Active.");
}
