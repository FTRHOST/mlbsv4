/**
 * GM / Sandbox Mode Hook Module
 */

import { sessionState } from "../tools/config";
import { debugLog } from "../tools/utils";

export function setupGMHooks(Assembly) {
  const GameInit = Assembly.class("GameInit");
  if (!GameInit || GameInit.handle.isNull()) return;

  const IsSandBoxIp = GameInit.method("IsSandBoxIp");
  if (IsSandBoxIp) {
    Interceptor.attach(IsSandBoxIp.virtualAddress, {
      onLeave: function (retval) {
        if (sessionState.isAuthorized && sessionState.permissions.allowGMMode) {
          retval.replace(ptr(1));
          debugLog("GM Mod", "GM Mode/Sandbox IP hook applied.");
        }
      },
    });
  }
}
