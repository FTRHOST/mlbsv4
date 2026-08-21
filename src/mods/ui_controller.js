/**
 * UI Controller Hook Module - Advanced Blocking
 * Digunakan untuk mengontrol dan memblokir aktivasi Frame UI tertentu.
 */

import { debugLog } from "../tools/utils";

export function setupUIHooks(Assembly) {
  const BaseFrame = Assembly.class("BaseFrame");
  const UIMgr = Assembly.class("UIMgr");
  const ILog = Assembly.class("ILog");

  // 1. Hook BaseFrame.Active (Level Instance)
  if (BaseFrame) {
    const Active = BaseFrame.method("Active");
    if (Active) {
      Active.implementation = function (arg) {
        try {
          const nameField = this.field("name");
          if (nameField) {
            const name = nameField.value.toString();
            // debugLog("UI Mod", "BaseFrame.Active: " + name); // Un-comment untuk melihat semua UI
            if (name.indexOf("UI_GM_MainInterface") !== -1) {
              debugLog("UI Mod", ">>> BLOCKING BaseFrame.Active for: " + name + " <<<");
              return;
            }
          }
        } catch (e) {
          // ignore error to prevent crash
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
          const nameStr = name.toString();
          debugLog("UI Mod", "UIMgr attempting to create: " + nameStr);
          if (nameStr.indexOf("UI_GM_MainInterface") !== -1) {
            debugLog("UI Mod", ">>> BLOCKING UIMgr creation for: " + nameStr + " <<<");
            return;
          }
        } catch (e) {}
        return this.method("_TryCreateBasePanelByName").invoke(name);
      };
    }
  }

  // 3. Hook ILog.InfoLogAct (Level Logging)
  // Memantau log: [UIFrame][Active]UI_GM_MainInterface
  if (ILog) {
    const infoLogAct = ILog.method("InfoLogAct");
    if (infoLogAct) {
      infoLogAct.implementation = function (strContent, eReportName, bReport) {
        const content = strContent.toString();
        if (content.indexOf("UI_GM_MainInterface") !== -1) {
          debugLog("UI Mod", "Detected Activation Log: " + content);
          // Kita tidak memblokir log, tapi ini membantu konfirmasi pemicunya
        }
        return this.method("InfoLogAct").invoke(strContent, eReportName, bReport);
      };
    }
  }

  debugLog("UI Mod", "Advanced UI Controller hooks installed.");
}
