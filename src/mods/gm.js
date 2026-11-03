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

  // Base Triggers
  hookSandboxMethod("GameInit", "IsSandBoxIp");
  // hookSandboxMethod("LuaHelper", "IsEditor");
  // hookSandboxMethod("LuaHelper", "IsTestChannel");
  // hookSandboxMethod("SDKCommon", "IsSandbox");
  //hookSandboxMethod("PingServerData", "CheckInTestServer");
  // hookSandboxMethod("PingServerData", "CheckIsTestServer");
  // hookSandboxMethod("GMVideoPlayer", "IsGMBackend");
  // hookSandboxMethod("LogicExtension", "IsAdjustSandBox");
  //

  const GameServerConfig = Assembly.class("GameServerConfig");

  GameServerConfig.method("loadRealVersionCompelte").implementation = function (
    xml,
  ) {
    // console.log("berhasil");
    // this.field("m_bGSDKSandBox").value = true;
    this.field("m_bAdjustSandBox").value = true;
    this.field("m_uiZoneID").value = 57001;
    this.field("_curZoneId").value = 57001;

    /*this.field("m_strLogServerIP").value = Il2Cpp.string("119.81.89.27");
      this.field("m_strLoginServerIP").value = Il2Cpp.string(
        "login.ml.youngjoygame.com",
      );
      this.field("m_iLoginServerPort").value = 30021;*/
    // const getver = this.field("m_strLogServerIP").value;
    // console.log(`GetVer: ${getver}`);
    return this.method("loadRealVersionCompelte").invoke(xml);
  };

  // --- EXTENDED GM UI & PROFILER HOOKS ---

  if (sessionState.isAuthorized && sessionState.permissions.allowGMMode) {
    // 4. Hook GameInit for Login GM UI
    const GameInit = Assembly.class("GameInit");
    if (GameInit && !GameInit.handle.isNull()) {
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
