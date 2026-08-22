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

  // 2. Fungsi untuk memaksa aktivasi dengan Registrasi
  function triggerGMAktivasi() {
    const now = Date.now();
    if (now - lastActivationTime < 5000) return;
    lastActivationTime = now;

    Il2Cpp.mainThread.schedule(() => {
      try {
        debugLog("UI Mod", "Attempting manual registration and activation of UI_GM...");
        
        // A. Coba mendaftarkan UI_GM ke UIMgr sebelum memanggilnya
        if (UIMgr && Enum_PrefabName && FrameID) {
            const prefabName = Enum_PrefabName.field("UI_GM").value;
            const frameGM = FrameID.field("FRAME_GM").value;
            
            // Mencoba mendaftarkan aksi inisialisasi yang tertunda
            // Signature: AddInitUIDelayAction(FrameID frameId, Enum_PrefabName ePrefabName, eUIPrioType _impower, eUIResType resType)
            // Menggunakan tipe eUIPrioType(0) dan eUIResType(0) sebagai default
            UIMgr.method("AddInitUIDelayAction").invoke(frameGM, prefabName, 0, 0);
            debugLog("UI Mod", "Registered UI_GM delay action.");
        }

        // B. Coba via Bridge
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
