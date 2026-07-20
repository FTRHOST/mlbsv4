/**
 * Unreleased Content & Activity Filter Module
 */

import { sessionState } from "../tools/config";
import { debugLog } from "../tools/utils";

// --- ACTIVITY OVERRIDE CONFIGURATION ---

const TYPES_TO_OVERRIDE = [];

const ActivityPatchConfig = {
  MasterConfig: {
    enabled: true,
    debug: false,
    applyGlobal: false,
  },
  GlobalPatch: {
    bShowInList: true,
    iBeginTime: 0,
    iEndTime: 2147483647,
    bShowOnLogin: true,
  },
  TypePatches: {
    // Tetap meng-override 626 dan 209 menjadi 0 sesuai permintaan sebelumnya
    626: {
      bShowInList: true,
      iBeginTime: 0,
      iEndTime: 2147483647,
      bShowOnLogin: true,
      iActivityType: 0,
    },
    209: {
      bShowInList: true,
      iBeginTime: 0,
      iEndTime: 2147483647,
      bShowOnLogin: true,
      iActivityType: 0,
    },
  },
  IdPatches: {
    // Contoh: "2604201856": { sTitle: "Custom Activity Title" }
  },
};

// Inisialisasi TypePatches otomatis dari daftar types (jika ada isi di masa depan)
TYPES_TO_OVERRIDE.forEach((type) => {
  if (!ActivityPatchConfig.TypePatches[type]) {
    ActivityPatchConfig.TypePatches[type] = ActivityPatchConfig.GlobalPatch;
  }
});

/**
 * Menerapkan patch pada instance CmdActivityData menggunakan Il2Cpp Bridge.
 */
function applyActivityPatch(instance) {
  if (!ActivityPatchConfig.MasterConfig.enabled) return;

  try {
    const idField = instance.field("iActivityId").value;
    if (!idField) return;
    const id = idField.toString();
    const type = Number(instance.field("iActivityType").value);

    let patchToApply = null;

    // Hirarki: ID > Type > Global
    if (ActivityPatchConfig.IdPatches[id]) {
      patchToApply = ActivityPatchConfig.IdPatches[id];
    } else if (ActivityPatchConfig.TypePatches[type]) {
      patchToApply = ActivityPatchConfig.TypePatches[type];
    } else if (ActivityPatchConfig.MasterConfig.applyGlobal) {
      patchToApply = ActivityPatchConfig.GlobalPatch;
    }

    if (patchToApply) {
      Object.entries(patchToApply).forEach(([key, value]) => {
        try {
          const field = instance.field(key);
          if (typeof value === "string") {
            field.value = Il2Cpp.string(value);
          } else {
            field.value = value;
          }
        } catch (e) {}
      });
    }
  } catch (e) {}
}

/**
 * Menerapkan patch ke List aktivitas.
 */
function applyToActivityList(listPtr) {
  if (listPtr.isNull()) return;
  try {
    const list = new Il2Cpp.Object(listPtr);
    // Asumsi ini adalah System.Collections.Generic.List<CmdActivityData>
    const count = list.method("get_Count").invoke().toInt32();
    for (let i = 0; i < count; i++) {
      const act = list.method("get_Item").invoke(i);
      applyActivityPatch(act);
    }
  } catch (e) {
    // Fallback ke iterasi manual jika Bridge gagal (misal jika bukan standard List)
    debugLog("Unreleased", `Manual list fallback needed: ${e.message}`);
  }
}

// --- HOOKS ---

export function setupUnreleasedHooks(Assembly) {
  const ActLclCfgMgr = Assembly.class("ActLclCfgMgr");
  const GameInit = Assembly.class("GameInit");
  const NewPackageMgr = Assembly.class("NewPackageMgr");
  const SystemData = Assembly.class("SystemData");

  // --- NOP / FORCE FIXES ---

  /* const IsCloseAstcInPackVar = NewPackageMgr.method("IsCloseAstcInPackVar");
  if (IsCloseAstcInPackVar) {
    Interceptor.replace(
      IsCloseAstcInPackVar.virtualAddress,
      new NativeCallback(() => 0, "int", [])
    );
  }*/

  /* const get_bAstcInPack = GameInit.method("get_bAstcInPack");
  if (get_bAstcInPack) {
    Interceptor.replace(
      get_bAstcInPack.virtualAddress,
      new NativeCallback(() => 0, "int", []),
    );
  } */

  const CheckFileMd5_SubThread = SystemData.method("CheckFileMd5_SubThread");
  if (CheckFileMd5_SubThread) {
    Interceptor.replace(
      CheckFileMd5_SubThread.virtualAddress,
      new NativeCallback(() => {}, "void", []),
    );
  }

  // --- ACTIVITY OVERRIDE (STATIC) ---

  /*
  if (ActLclCfgMgr) {
    const ReadActLclCfgByStage = ActLclCfgMgr.method("ReadActLclCfgByStage");
    if (ReadActLclCfgByStage) {
      Interceptor.attach(ReadActLclCfgByStage.virtualAddress, {
        onLeave: function (retval) {
          if (sessionState.isAuthorized && sessionState.permissions.allowUnreleased) {
            if (!retval.isNull()) {
              // Di MLBB, vActivity biasanya di offset 0x18 dari ActLclCfgData
              const vActivity = retval.add(0x18).readPointer();
              applyToActivityList(vActivity);
            }
          }
        },
      });
    }
  }
  */

  // --- ACTIVITY OVERRIDE (DYNAMIC) ---

  const CmdActivityDataClass =
    Assembly.tryClass("MTTDProto.CmdActivityData") ||
    Assembly.tryClass("CmdActivityData");
  if (CmdActivityDataClass) {
    CmdActivityDataClass.methods
      .filter((m) => m.name === "visit")
      .forEach((method) => {
        const originalVisitAddr = method.virtualAddress;
        method.implementation = function (sdp, flag) {
          // Panggil fungsi asli native agar data terisi dari Sdp
          const originalVisit = new NativeFunction(originalVisitAddr, "void", [
            "pointer",
            "pointer",
            "int",
          ]);
          originalVisit(this.handle, sdp.handle, flag ? 1 : 0);

          if (
            sessionState.isAuthorized &&
            sessionState.permissions.allowUnreleased
          ) {
            applyActivityPatch(this);
          }
        };
      });
  }

  // --- FORBIDDEN CONTENT BYPASS ---

  if (SystemData) {
    ["IsForbidHeros", "IsActivityForbidHeros"].forEach((mName) => {
      const method = SystemData.method(mName);
      if (method) {
        Interceptor.attach(method.virtualAddress, {
          onLeave: function (retval) {
            if (
              sessionState.isAuthorized &&
              sessionState.permissions.allowUnreleased
            ) {
              retval.replace(ptr(0));
            }
          },
        });
      }
    });

    const CheckMapSkinAvailable = SystemData.method("CheckMapSkinAvailable");
    if (CheckMapSkinAvailable) {
      Interceptor.attach(CheckMapSkinAvailable.virtualAddress, {
        onLeave: function (retval) {
          if (
            sessionState.isAuthorized &&
            sessionState.permissions.allowUnreleased
          ) {
            retval.replace(ptr(1));
          }
        },
      });
    }
  }
}
