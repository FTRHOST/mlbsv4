/** Battle Command Line Mod Module (stealth + crash-safe) */
import { debugLog } from "../tools/utils";

let cachedBridgeHandle = null;

function safeClass(Assembly, name) {
  try {
    const cls =
      (Assembly.tryClass && Assembly.tryClass(name)) || Assembly.class(name);
    if (!cls || !cls.handle || cls.handle.isNull()) return null;
    return cls;
  } catch (e) {
    return null;
  }
}

function safeMethod(cls, name) {
  try {
    if (!cls) return null;
    const m =
      (cls.tryMethod && cls.tryMethod(name)) || cls.method(name);
    if (!m || !m.virtualAddress || m.virtualAddress.isNull()) return null;
    return m;
  } catch (e) {
    return null;
  }
}

function getBridgeInstance(BattleBridge) {
  try {
    if (cachedBridgeHandle && !cachedBridgeHandle.isNull()) {
      return new Il2Cpp.Object(cachedBridgeHandle);
    }
  } catch (e) {
    cachedBridgeHandle = null;
  }
  try {
    const arr = Il2Cpp.gc.choose(BattleBridge);
    if (arr && arr.length > 0 && arr[0] && !arr[0].handle.isNull()) {
      cachedBridgeHandle = arr[0].handle;
      return arr[0];
    }
  } catch (e) {}
  return null;
}

export function setupBattleCommands(Assembly) {
  const BattleBridge = safeClass(Assembly, "BattleBridge");
  const EntityBaseGlobalVar = safeClass(Assembly, "Battle.EntityBaseGlobalVar");
  const TrainingGuide = safeClass(Assembly, "TrainingGuide");
  const UIMiniMapToolButton = safeClass(Assembly, "UIMiniMapToolButton");

  if (!BattleBridge) return;

  // OnGM: panggil original via NativeFunction (anti-rekursi), resolve bridge lazy
  try {
    const onGm = safeMethod(UIMiniMapToolButton, "OnGM");
    if (onGm) {
      const addr = onGm.virtualAddress;
      const sig = onGm.returnType && onGm.returnType.name === "Void" ? "void" : "pointer";
      const origOnGm = new NativeFunction(addr, sig, ["pointer", "pointer"]);
      onGm.implementation = function (go) {
        let ret = null;
        try {
          const goH = go && go.handle ? go.handle : go;
          ret = origOnGm(this.handle, goH);
        } catch (e) {}
        try {
          const bridge = getBridgeInstance(BattleBridge);
          if (bridge) {
            const toggle = safeMethod(bridge.class, "ToggleAllUIShow");
            if (toggle) bridge.method("ToggleAllUIShow").invoke();
          }
        } catch (e) {}
        return ret;
      };
    }
  } catch (e) {
    debugLog("Battle", "OnGM hook skipped: " + e.message);
  }

  // OnCoolDown: mirror bState ke m_bCloseCD tanpa crash bila field/class hilang
  try {
    const onCd = safeMethod(TrainingGuide, "OnCoolDown");
    if (onCd && EntityBaseGlobalVar) {
      const addr = onCd.virtualAddress;
      const origOnCd = new NativeFunction(addr, "void", ["pointer", "int", "bool"]);
      onCd.implementation = function (iParam, bState) {
        try {
          const p = iParam && iParam.value !== undefined ? Number(iParam.value || iParam) : 0;
          const b = bState === true || bState === 1 || String(bState) === "true" ? 1 : 0;
          origOnCd(this.handle, p, b);
        } catch (e) {}
        try {
          EntityBaseGlobalVar.field("m_bCloseCD").value = bState;
        } catch (e) {}
      };
    }
  } catch (e) {
    debugLog("Battle", "OnCoolDown hook skipped: " + e.message);
  }
}
