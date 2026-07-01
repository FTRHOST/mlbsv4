/**
 * Unreleased Content & Activity Filter Module
 */

import { sessionState } from "../tools/config";
import { debugLog } from "../tools/utils";

const REDIRECT_ACTIVITY_TYPES = {
  626: 0, // Mengubah tipe 626 (aktivitas rilis fitur/skin) menjadi tipe 0 di memori
  209: 0,
};

function filterActivityList(listPtr) {
  if (listPtr.isNull()) return;

  const itemsArray = listPtr.add(0x10).readPointer();
  if (itemsArray.isNull()) return;

  let size = listPtr.add(0x18).readS32();
  for (let i = 0; i < size; i++) {
    const activityPtr = itemsArray.add(0x20 + i * 8).readPointer();
    if (activityPtr.isNull()) continue;

    const iActivityId = activityPtr.add(0x10).readU32();
    let iActivityType = activityPtr.add(0x14).readU32();

    // Ubah tipe di memori RAM jika terdaftar di REDIRECT_ACTIVITY_TYPES
    if (REDIRECT_ACTIVITY_TYPES.hasOwnProperty(iActivityType)) {
      const targetType = REDIRECT_ACTIVITY_TYPES[iActivityType];
      activityPtr.add(0x14).writeU32(targetType);
    }
  }
}

export function setupUnreleasedHooks(Assembly) {
  if (!(sessionState.isAuthorized && sessionState.permissions.allowUnreleased)) return;

  const ActLclCfgMgr = Assembly.class("ActLclCfgMgr");
  const SystemData = Assembly.class("SystemData");

  if (ActLclCfgMgr) {
    const ReadActLclCfgByStage = ActLclCfgMgr.method("ReadActLclCfgByStage");
    if (ReadActLclCfgByStage) {
      Interceptor.attach(ReadActLclCfgByStage.virtualAddress, {
        onLeave: function (retval) {
          if (!retval.isNull()) {
            const vActivity = retval.add(0x18).readPointer();
            filterActivityList(vActivity);
          }
        },
      });
    }
  }

  if (SystemData) {
    const IsForbidHeros = SystemData.method("IsForbidHeros");
    if (IsForbidHeros) {
      Interceptor.attach(IsForbidHeros.virtualAddress, {
        onLeave: function (retval) {
          retval.replace(ptr(0));
        },
      });
    }

    const IsActivityForbidHeros = SystemData.method("IsActivityForbidHeros");
    if (IsActivityForbidHeros) {
      Interceptor.attach(IsActivityForbidHeros.virtualAddress, {
        onLeave: function (retval) {
          retval.replace(ptr(0));
        },
      });
    }

    const CheckMapSkinAvailable = SystemData.method("CheckMapSkinAvailable");
    if (CheckMapSkinAvailable) {
      Interceptor.attach(CheckMapSkinAvailable.virtualAddress, {
        onLeave: function (retval) {
          retval.replace(ptr(1));
        },
      });
    }
  }
}
