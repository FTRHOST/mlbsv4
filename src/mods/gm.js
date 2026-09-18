/**
 * GM / Sandbox Mode Hook Module
 */

import { sessionState } from "../tools/config";
import { debugLog } from "../tools/utils";

export function setupGMHooks(Assembly) {
  const safeClass = (name) => {
    try {
      const cls =
        (Assembly.tryClass && Assembly.tryClass(name)) || Assembly.class(name);
      if (!cls || !cls.handle || cls.handle.isNull()) return null;
      return cls;
    } catch (e) {
      return null;
    }
  };

  const hookSandboxMethod = (className, methodName) => {
    try {
      const cls = safeClass(className);
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
