/**
 * UI Controller Hook Module - Aggressive Blocking & Forced Asset Loading
 */

import { debugLog } from "../tools/utils";

export function setupUIHooks(Assembly) {
  const BaseFrame = Assembly.class("BaseFrame");
  const UIMgr = Assembly.class("UIMgr");
  const BridgeClass = Assembly.class("MobaScriptBridge");
  const LoadUtil = Assembly.class("LoadUtil");
  const UFResUseType = Assembly.class("ResMgr.Resource.UFResUseType");

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

  // Fungsi untuk memicu aktivasi UI_GM dengan Pemuatan Aset
  function triggerGMAktivasi() {
    const now = Date.now();
    if (now - lastActivationTime < 5000) return;
    lastActivationTime = now;

    Il2Cpp.mainThread.schedule(() => {
      try {
        debugLog("UI Mod", "--- STARTING FORCED ACTIVATION: UI_GM ---");
        
        // LANGKAH 1: Paksa Load Aset
        if (LoadUtil && UFResUseType) {
            const prefabUiVal = UFResUseType.field("Prefab_UI").value;
            debugLog("UI Mod", "Force loading AssetBundle: UI_GM");
            // LoadAssetBundle(resName, resUseType, frameId, autoUnload)
            LoadUtil.method("LoadAssetBundle").invoke(Il2Cpp.string("UI_GM"), prefabUiVal, 0, false);
        }

        // LANGKAH 2: Panggil Bridge
        const bridgeInstance = BridgeClass.method("GetInstance").invoke();
        if (bridgeInstance && !bridgeInstance.isNull()) {
          debugLog("UI Mod", "Bridge found, invoking ToUIFrame('UI_GM')");
          const toUIFrame = bridgeInstance.method("ToUIFrame");
          if (toUIFrame) {
            toUIFrame.invoke(Il2Cpp.string("UI_GM"));
          }
        } else {
          debugLog("UI Mod", "Bridge instance not found.");
        }
      } catch (e) {
        debugLog("UI Mod", "Trigger activation failed: " + e.message);
      }
    });
  }

  debugLog("UI Mod", "Aggressive Blocker & Forced Asset Loader Active.");
}
