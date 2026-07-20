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

  hookSandboxMethod("GameInit", "IsSandBoxIp");

  /*
  hookSandboxMethod("BattleStaticInit", "IsAdjustSandBox");
  hookSandboxMethod("SDKCommon", "IsSandbox");
  hookSandboxMethod("LogicExtension", "IsAdjustSandBox");
  hookSandboxMethod("SdkInit", "IsSandBox");

  // Hook GameServerConfig constructor untuk mengubah nilai field secara dinamis
  const GameServerConfig = Assembly.class("GameServerConfig");
  if (GameServerConfig && !GameServerConfig.handle.isNull()) {
    const ctor = GameServerConfig.method(".ctor");
    const fieldGSDKSandbox = GameServerConfig.field("m_bGSDKSandBox");
    const fieldAdjustSandbox = GameServerConfig.field("m_bAdjustSandBox");

    if (ctor) {
      Interceptor.attach(ctor.virtualAddress, {
        onEnter: function (args) {
          this.instance = args[0];
        },
        onLeave: function () {
          if (this.instance && !this.instance.isNull()) {
            if (sessionState.isAuthorized && sessionState.permissions.allowGMMode) {
              if (fieldGSDKSandbox) {
                this.instance.add(fieldGSDKSandbox.offset).writeU8(1);
              }
              if (fieldAdjustSandbox) {
                this.instance.add(fieldAdjustSandbox.offset).writeU8(1);
              }
              debugLog("GM Mod", "GameServerConfig sandbox fields set to true dynamically.");
            }
          }
        }
      });
    }
  }

  // Hook LoginCLibraryUtils static field mStaticIsSandBox
  const LoginCLibraryUtils = Assembly.class("LoginCLibraryUtils");
  if (LoginCLibraryUtils && !LoginCLibraryUtils.handle.isNull()) {
    const cctor = LoginCLibraryUtils.method(".cctor");
    if (cctor) {
      Interceptor.attach(cctor.virtualAddress, {
        onLeave: function () {
          if (sessionState.isAuthorized && sessionState.permissions.allowGMMode) {
            const field = LoginCLibraryUtils.field("mStaticIsSandBox");
            if (field) {
              field.value = true;
              debugLog("GM Mod", "LoginCLibraryUtils mStaticIsSandBox set to true.");
            }
          }
        }
      });
    }
  } */
}
