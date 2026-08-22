/**
 * UI Controller Hook Module - Force Activator UI_GMUI
 */

import { debugLog } from "../tools/utils";

export function setupUIHooks(Assembly) {
  const BaseFrame = Assembly.class("BaseFrame");
  const UIMgr = Assembly.class("UIMgr");
  const BridgeClass = Assembly.class("MobaScriptBridge");
  const GMUIClass = Assembly.class("UI_GMUI");

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

  // 2. Fungsi untuk memicu aktivasi UI_GMUI
  function triggerGMAktivasi() {
    const now = Date.now();
    if (now - lastActivationTime < 5000) return;
    lastActivationTime = now;

    Il2Cpp.mainThread.schedule(() => {
      try {
        debugLog("UI Mod", "--- STARTING MANUAL ACTIVATION: UI_GMUI ---");
        
        // A. Mencoba mencari dan mengaktifkan GameObject m_RootPanel
        if (GMUIClass && !GMUIClass.handle.isNull()) {
            // Karena tidak ada get_Instance, kita akan mencoba membuat instance baru
            // atau mencari instance yang sudah ada di memori via UIMgr atau Bridge
            debugLog("UI Mod", "Attempting manual instantiation of UI_GMUI...");
            const gmInstance = GMUIClass.alloc();
            gmInstance.method(".ctor").invoke();
            
            // Panggil InitView
            gmInstance.method("InitView").invoke();
            
            // Aktifkan RootPanel
            const rootPanel = gmInstance.field("m_RootPanel").value;
            if (rootPanel && !rootPanel.isNull()) {
                rootPanel.method("SetActive").invoke(true);
                debugLog("UI Mod", "UI_GMUI RootPanel SetActive(true) success.");
            } else {
                debugLog("UI Mod", "m_RootPanel not found.");
            }
        }
      } catch (e) {
        debugLog("UI Mod", "Activation error: " + e.message);
      }
    });
  }

  debugLog("UI Mod", "Debug Activator Ready.");
}
