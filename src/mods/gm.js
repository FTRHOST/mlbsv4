/**
 * GM / Sandbox Mode Hook Module
 */

import { sessionState } from "../tools/config";
import { debugLog } from "../tools/utils";

export function setupGMHooks(Assembly) {
  const hookSandboxMethod = (className, methodName) => {
    const cls = Assembly.class(className);
    if (!cls || cls.handle.isNull()) return;

    const method = cls.method(methodName);
    if (method) {
      Interceptor.attach(method.virtualAddress, {
        onLeave: function (retval) {
          if (
            sessionState.isAuthorized &&
            sessionState.permissions.allowGMMode
          ) {
            retval.replace(ptr(1));
            debugLog(
              "GM Mod",
              `${className}.${methodName} hook applied. Returning true.`,
            );
          }
        },
      });
    }
  };

  // Base Trigger
  hookSandboxMethod("GameInit", "IsSandBoxIp");
  // hookSandboxMethod("LuaHelper", "IsEditor");

  // --- EXTENDED GM UI & PROFILER HOOKS ---

  if (sessionState.isAuthorized && sessionState.permissions.allowGMMode) {
    // 1. Hook GameServerConfig (System Gatekeeper)
    const GameServerConfig = Assembly.class("GameServerConfig");
    if (GameServerConfig && !GameServerConfig.handle.isNull()) {
      // Set static fields via .cctor or wait for instance
      const cctor = GameServerConfig.method(".cctor");
      if (cctor) {
        Interceptor.attach(cctor.virtualAddress, {
          onLeave: function () {
            try {
              const instance = GameServerConfig.field("Instance").value;
              if (instance && !instance.isNull()) {
                instance.field("m_bGSDKSandBox").value = true;
                instance.field("m_bAdjustSandBox").value = true;
                debugLog(
                  "GM Mod",
                  "GameServerConfig Instance fields set to true.",
                );
              }
            } catch (e) {}
          },
        });
      }

      // Fallback: Try setting instance directly if already exists
      try {
        const instance = GameServerConfig.field("Instance").value;
        if (instance && !instance.isNull()) {
          instance.field("m_bGSDKSandBox").value = true;
          instance.field("m_bAdjustSandBox").value = true;
          debugLog(
            "GM Mod",
            "GameServerConfig Instance (direct) fields set to true.",
          );
        }
      } catch (e) {}
    }

    // 2. Hook LoginCLibraryUtils (Native Sandbox Flag)
    const LoginCLibraryUtils = Assembly.class("LoginCLibraryUtils");
    if (LoginCLibraryUtils && !LoginCLibraryUtils.handle.isNull()) {
      try {
        const field = LoginCLibraryUtils.field("mStaticIsSandBox");
        if (field) {
          field.value = true;
          debugLog(
            "GM Mod",
            "LoginCLibraryUtils.mStaticIsSandBox set to true.",
          );
        }
      } catch (e) {}
    }

    // 3. Hook AdrenoStatistics (Profiler UI)
    const AdrenoStats = Assembly.class("AdrenoStatistics");
    if (AdrenoStats && !AdrenoStats.handle.isNull()) {
      try {
        const instance = AdrenoStats.field("_instance").value;
        if (instance && !instance.isNull()) {
          instance.field("_isQprofilerInited").value = true;
          instance.field("isInit").value = true;
          debugLog("GM Mod", "AdrenoStatistics (Profiler) enabled.");
        }
      } catch (e) {}

      // Hook .ctor to catch it early
      const ctor = AdrenoStats.method(".ctor");
      if (ctor) {
        Interceptor.attach(ctor.virtualAddress, {
          onLeave: function (retval) {
            const instance = this.handle;
            if (instance && !instance.isNull()) {
              instance.field("_isQprofilerInited").value = true;
              instance.field("isInit").value = true;
              debugLog(
                "GM Mod",
                "AdrenoStatistics (Profiler) enabled in .ctor.",
              );
            }
          },
        });
      }
    }

    // 4. Hook GameInit for Login GM UI
    const GameInit = Assembly.class("GameInit");
    if (GameInit && !GameInit.handle.isNull()) {
      // Set some static flags that might help
      try {
        const opLog = GameInit.field("IsOpenEditorLoadLog");
        if (opLog) opLog.value = true;
      } catch (e) {}

      // Hook constructor to set instance field _bGmLogin
      const ctor = GameInit.method(".ctor");
      if (ctor) {
        Interceptor.attach(ctor.virtualAddress, {
          onLeave: function () {
            try {
              this.handle.field("_bGmLogin").value = true;
              debugLog("GM Mod", "GameInit._bGmLogin set to true in .ctor.");
            } catch (e) {}
          },
        });
      }
    }
  }
}
