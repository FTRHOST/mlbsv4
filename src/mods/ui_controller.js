/**
 * UI Controller Hook Module - Advanced Blocking & Force Activation
 */

import { debugLog } from "../tools/utils";

export function setupUIHooks(Assembly) {
  const BaseFrame = Assembly.class("BaseFrame");
  const UIMgr = Assembly.class("UIMgr");
  const ILog = Assembly.class("ILog");
  const BridgeClass = Assembly.class("MobaScriptBridge");
  const LoadUtil = Assembly.class("LoadUtil");
  const UFResUseType = Assembly.class("ResMgr.Resource.UFResUseType");

  let isGMActivating = false;

  // 1. Hook BaseFrame.Active (Level Instance)
  if (BaseFrame) {
    const Active = BaseFrame.method("Active");
    if (Active) {
      Active.implementation = function (arg) {
        try {
          const nameField = this.field("name");
          if (nameField) {
            const name = nameField.value.toString();
            if (name === "UI_GM_MainInterface") {
              debugLog("UI Mod", ">>> BLOCKING UI_GM_MainInterface, Redirecting to UI_GM... <<<");
              forceActivateGM();
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

  // Fungsi untuk memaksa aktivasi UI_GM di Main Thread
  function forceActivateGM() {
    if (isGMActivating) return;
    isGMActivating = true;

    Il2Cpp.mainThread.schedule(() => {
      try {
        debugLog("UI Mod", "Starting Force Activation sequence for UI_GM...");

        // A. Pastikan AssetBundle terload
        if (LoadUtil && UFResUseType) {
          const prefabUiVal = UFResUseType.field("Prefab_UI").value;
          debugLog("UI Mod", "Pre-loading AssetBundle: UI_GM");
          // LoadAssetBundle(resName, resUseType, frameId, autoUnload)
          LoadUtil.method("LoadAssetBundle").invoke(Il2Cpp.string("UI_GM"), prefabUiVal, 0, false);
        }

        // B. Gunakan Bridge untuk pindah Frame
        if (BridgeClass) {
          const bridge = BridgeClass.method("GetInstance").invoke();
          if (bridge && !bridge.isNull()) {
            debugLog("UI Mod", "Bridge found, invoking ToUIFrame('UI_GM')");
            const toUIFrame = bridge.method("ToUIFrame");
            if (toUIFrame) {
              toUIFrame.invoke(Il2Cpp.string("UI_GM"));
            }
          }
        }

        // C. Fallback via UIMgr jika bridge gagal (menggunakan string prefab name)
        if (UIMgr) {
          debugLog("UI Mod", "UIMgr fallback: _TryCreateBasePanelByName('UI_GM')");
          // Kita butuh instance UIMgr, biasanya didapat dari static field atau GUIRoot
          // Untuk saat ini kita asumsikan ToUIFrame sudah cukup kuat.
        }

      } catch (e) {
        debugLog("UI Mod", "Force activation failed: " + e.message);
      } finally {
        // Reset flag setelah delay agar tidak spamming
        setTimeout(() => { isGMActivating = false; }, 3000);
      }
    });
  }

  // 2. Monitoring Log
  if (ILog) {
    const infoLogAct = ILog.method("InfoLogAct");
    if (infoLogAct) {
      infoLogAct.implementation = function (strContent, eReportName, bReport) {
        const content = strContent.toString();
        if (content.indexOf("UI_GM") !== -1) {
          debugLog("UI Mod", "UI System Log: " + content);
        }
        return this.method("InfoLogAct").invoke(strContent, eReportName, bReport);
      };
    }
  }

  debugLog("UI Mod", "Force Activator & Blocker system ready.");
}
