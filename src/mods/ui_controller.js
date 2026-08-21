/**
 * UI Controller Hook Module - Advanced Blocking & Activation
 * Digunakan untuk mengontrol, memblokir, dan mengaktifkan Frame UI tertentu.
 */

import { debugLog } from "../tools/utils";

export function setupUIHooks(Assembly) {
  const BaseFrame = Assembly.class("BaseFrame");
  const UIMgr = Assembly.class("UIMgr");
  const ILog = Assembly.class("ILog");
  const BridgeClass = Assembly.class("MobaScriptBridge");

  let uiMgrInstance = null;

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
              
              // Coba aktifkan UI_GM sebagai ganti
              activateGMUI();
              return;
            }
          }
        } catch (e) {
          debugLog("UI Mod", "Error in BaseFrame.Active hook: " + e.message);
        }
        return this.method("Active").invoke(arg);
      };
    }
  }

  // 2. Hook UIMgr._TryCreateBasePanelByName (Level Manager)
  if (UIMgr) {
    const tryCreate = UIMgr.method("_TryCreateBasePanelByName");
    if (tryCreate) {
      tryCreate.implementation = function (name) {
        try {
          uiMgrInstance = this; // Capture instance
          const nameStr = name.toString();
          if (nameStr.indexOf("UI_GM_MainInterface") !== -1) {
            debugLog("UI Mod", ">>> REDIRECTING UIMgr creation for: " + nameStr + " to UI_GM <<<");
            
            // Panggil pembuatan UI_GM secara internal
            this.method("_TryCreateBasePanelByName").invoke(Il2Cpp.string("UI_GM"));
            return;
          }
        } catch (e) {
          debugLog("UI Mod", "Error in UIMgr hook: " + e.message);
        }
        return this.method("_TryCreateBasePanelByName").invoke(name);
      };
    }
  }

  // Fungsi pembantu untuk mengaktifkan GM UI
  function activateGMUI() {
    try {
      if (BridgeClass) {
        const getInstance = BridgeClass.method("GetInstance");
        const bridge = getInstance.invoke();
        if (bridge && !bridge.isNull()) {
          debugLog("UI Mod", "Bridge found, calling ToUIFrame('UI_GM')...");
          const toUIFrame = bridge.method("ToUIFrame");
          if (toUIFrame) {
            toUIFrame.invoke(Il2Cpp.string("UI_GM"));
            return;
          }
        }
      }

      if (uiMgrInstance) {
        debugLog("UI Mod", "Using captured UIMgr to create UI_GM...");
        uiMgrInstance.method("_TryCreateBasePanelByName").invoke(Il2Cpp.string("UI_GM"));
      }
    } catch (e) {
      debugLog("UI Mod", "Failed to activate GM UI: " + e.message);
    }
  }

  // 3. Hook ILog.InfoLogAct (Monitoring)
  if (ILog) {
    const infoLogAct = ILog.method("InfoLogAct");
    if (infoLogAct) {
      infoLogAct.implementation = function (strContent, eReportName, bReport) {
        const content = strContent.toString();
        if (content.indexOf("UI_GM") !== -1) {
          debugLog("UI Mod", "UI Log: " + content);
        }
        return this.method("InfoLogAct").invoke(strContent, eReportName, bReport);
      };
    }
  }

  debugLog("UI Mod", "Advanced UI Controller & Activator hooks installed.");
}
