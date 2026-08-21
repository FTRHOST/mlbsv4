/**
 * UI Controller Hook Module
 * Digunakan untuk mengontrol aktivasi Frame UI tertentu.
 */

import { debugLog } from "../tools/utils";

export function setupUIHooks(Assembly) {
  const BaseFrame = Assembly.class("BaseFrame");
  if (!BaseFrame || BaseFrame.handle.isNull()) {
    debugLog("UI Mod", "Error: BaseFrame class not found.");
    return;
  }

  const Active = BaseFrame.method("Active");
  if (Active) {
    Active.implementation = function (arg) {
      try {
        const nameField = this.field("name");
        if (nameField) {
          const name = nameField.value.toString();
          if (name === "UI_GM_MainInterface") {
            debugLog("UI Mod", ">>> BLOCKING UI_GM_MainInterface <<<");
            return; // Kembalikan tanpa menjalankan logika Active
          }
        }
      } catch (e) {
        debugLog("UI Mod", "Error in Active hook: " + e.message);
      }
      
      // Jalankan fungsi original untuk Frame lainnya
      return this.method("Active").invoke(arg);
    };
    
    debugLog("UI Mod", "BaseFrame.Active hook installed.");
  } else {
    debugLog("UI Mod", "Error: BaseFrame.Active method not found.");
  }
}
