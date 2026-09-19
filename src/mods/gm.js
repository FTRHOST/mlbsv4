/**
 * GM / Sandbox Mode Hook Module
 */

import { sessionState } from "../tools/config";
import { debugLog } from "../tools/utils";
import { safeClass } from "../tools/hooking.js";

export function setupGMHooks(Assembly) {

  const hookSandboxMethod = (className, methodName) => {
    try {
      const cls = safeClass(Assembly, className);
      if (!cls) return;
      const method =
        (cls.tryMethod && cls.tryMethod(methodName)) || cls.method(methodName);
      if (!method || !method.virtualAddress || method.virtualAddress.isNull())
        return;
      Interceptor.attach(method.virtualAddress, {
        onLeave: function (retval) {
          if (
            sessionState.isAuthorized &&
            sessionState.permissions.allowGMMode
          ) {
            retval.replace(ptr(1));
          }
        },
      });
    } catch (e) {}
  };

  // Base Triggers
  hookSandboxMethod("GameInit", "IsSandBoxIp");
}
