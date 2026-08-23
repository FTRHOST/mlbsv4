/**
 * UI Controller Hook Module - Aggressive Blocking & Manual Registration
 */

import { debugLog } from "../tools/utils";

export function setupUIHooks(Assembly) {
  const BaseFrame = Assembly.class("BaseFrame");
  const UIMgr = Assembly.class("UIMgr");
  const BridgeClass = Assembly.class("MobaScriptBridge");
  const Enum_PrefabName = Assembly.class("Enum_PrefabName");
  const FrameID = Assembly.class("FrameID");
  const GUIRoot = Assembly.class("GUIRoot");

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

  // Helper untuk mendapatkan UIMgr instance
  function getUIMgrInstance() {
      try {
          if (GUIRoot) {
              const root = GUIRoot.method("get_Instance").invoke();
              if (root && !root.isNull()) {
                  // Coba cari field yang bertipe UIMgr di GUIRoot
                  // Berdasarkan dump, tidak terlihat jelas field UIMgr. 
                  // Kita mungkin perlu mencari objek di memori.
                  debugLog("UI Mod", "GUIRoot instance found.");
              }
          }
          // Fallback: Jika tidak bisa lewat GUIRoot, kita cari UIMgr di memori (jika ada singleton)
          if (UIMgr) {
             // Beberapa class memiliki static field berupa instance-nya sendiri
             const fields = UIMgr.fields;
             for (let i = 0; i < fields.length; i++) {
                 if (fields[i].type.name === "UIMgr" && fields[i].isStatic) {
                     return fields[i].value;
                 }
             }
          }
      } catch(e) {
          debugLog("UI Mod", "getUIMgrInstance failed: " + e.message);
      }
      return null;
  }

  // 2. Fungsi untuk memicu aktivasi dengan Registrasi
  function triggerGMAktivasi() {
    const now = Date.now();
    if (now - lastActivationTime < 5000) return;
    lastActivationTime = now;

    Il2Cpp.mainThread.schedule(() => {
      try {
        debugLog("UI Mod", "Attempting manual registration and activation of UI_GM...");
        
        const uiMgrInstance = getUIMgrInstance();
        
        if (uiMgrInstance && !uiMgrInstance.isNull() && Enum_PrefabName && FrameID) {
            const prefabName = Enum_PrefabName.field("UI_GM").value;
            const frameGM = FrameID.field("FRAME_GM").value;
            
            uiMgrInstance.method("AddInitUIDelayAction").invoke(frameGM, prefabName, 0, 0);
            debugLog("UI Mod", "Registered UI_GM delay action.");
        }

        const bridgeInstance = BridgeClass.method("GetInstance").invoke();
        if (bridgeInstance && !bridgeInstance.isNull()) {
          bridgeInstance.method("ToUIFrame").invoke(Il2Cpp.string("UI_GM"));
          debugLog("UI Mod", "Bridge ToUIFrame('UI_GM') invoked.");
        }
      } catch (e) {
        debugLog("UI Mod", "Activation error: " + e.message);
      }
    });
  }

  debugLog("UI Mod", "Aggressive UI Controller Active.");
}
