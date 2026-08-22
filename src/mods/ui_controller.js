/**
 * UI Controller Hook Module - Aggressive Blocking & Redirection
 */

import { debugLog } from "../tools/utils";

export function setupUIHooks(Assembly) {
  const BaseFrame = Assembly.class("BaseFrame");
  const UIMgr = Assembly.class("UIMgr");
  const ILog = Assembly.class("ILog");
  const BridgeClass = Assembly.class("MobaScriptBridge");

  let isGMActivating = false;
  let lastActivationTime = 0;

  // 1. Hook BaseFrame.Active (Level Instance)
  if (BaseFrame) {
    const Active = BaseFrame.method("Active");
    if (Active) {
      Active.implementation = function (arg) {
        try {
          const nameField = this.field("name");
          if (nameField) {
            const name = nameField.value.toString();
            if (name.indexOf("UI_GM_MainInterface") !== -1) {
              debugLog("UI Mod", ">>> BLOCKING BaseFrame.Active for: " + name + " <<<");
              triggerGMAktivasi();
              return; 
            }
          }
        } catch (e) {}
        return this.method("Active").invoke(arg);
      };
    }
  }

  // 2. Hook UIMgr._TryCreateBasePanelByName (Level Manager - Gerbang Utama)
  if (UIMgr) {
    const tryCreate = UIMgr.method("_TryCreateBasePanelByName");
    if (tryCreate) {
      tryCreate.implementation = function (name) {
        try {
          const nameStr = name.toString();
          if (nameStr.indexOf("UI_GM_MainInterface") !== -1) {
            debugLog("UI Mod", ">>> BLOCKING UIMgr Creation: " + nameStr + " Redirecting... <<<");
            triggerGMAktivasi();
            return; // Jangan buat panel aslinya
          }
        } catch (e) {}
        return this.method("_TryCreateBasePanelByName").invoke(name);
      };
    }
  }

  // Fungsi untuk memicu aktivasi UI_GM
  function triggerGMAktivasi() {
    const now = Date.now();
    if (now - lastActivationTime < 5000) return; // Debounce 5 detik
    lastActivationTime = now;

    Il2Cpp.mainThread.schedule(() => {
      try {
        debugLog("UI Mod", "Attempting to force UI_GM via Bridge...");
        const bridgeInstance = BridgeClass.method("GetInstance").invoke();
        if (bridgeInstance && !bridgeInstance.isNull()) {
          bridgeInstance.method("ToUIFrame").invoke(Il2Cpp.string("UI_GM"));
          debugLog("UI Mod", "ToUIFrame('UI_GM') invoked.");
        } else {
          debugLog("UI Mod", "Bridge instance not found.");
        }
      } catch (e) {
        debugLog("UI Mod", "Trigger activation failed: " + e.message);
      }
    });
  }

  // 3. Monitor Log Sistem
  if (ILog) {
    const infoLogAct = ILog.method("InfoLogAct");
    if (infoLogAct) {
      infoLogAct.implementation = function (strContent, eReportName, bReport) {
        const content = strContent.toString();
        if (content.indexOf("UI_GM") !== -1) {
          debugLog("UI Mod", "[System Log] " + content);
        }
        return this.method("InfoLogAct").invoke(strContent, eReportName, bReport);
      };
    }
  }

  debugLog("UI Mod", "Aggressive UI Blocker & Redirector Active.");
}
