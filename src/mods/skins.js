/**
 * Free Skin Hook Module
 */

import { sessionState } from "../tools/config";
import { debugLog } from "../tools/utils";

export function setupSkinHooks(Assembly) {
  const ChooseHeroMgr = Assembly.class("ChooseHeroMgr");
  if (!ChooseHeroMgr || ChooseHeroMgr.handle.isNull()) return;

  const BActFreeSkin = ChooseHeroMgr.method("BActFreeSkin");
  if (BActFreeSkin) {
    Interceptor.attach(BActFreeSkin.virtualAddress, {
      onLeave: function (retval) {
        if (sessionState.isAuthorized && sessionState.permissions.allowFreeSkin) {
          retval.replace(ptr(1));
        }
      },
    });
  }
}
