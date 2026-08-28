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
  hookSandboxMethod("SDKCommon", "IsSandbox");
  //hookSandboxMethod("PingServerData", "CheckInTestServer");
  // hookSandboxMethod("PingServerData", "CheckIsTestServer");
  // hookSandboxMethod("GMVideoPlayer", "IsGMBackend");
  // hookSandboxMethod("LogicExtension", "IsAdjustSandBox");
  //

  const GameServerConfig = Assembly.class("GameServerConfig");
  const loadVersionCompelte = GameServerConfig.method("loadVersionCompelte");

  Interceptor.attach(loadVersionCompelte.virtualAddress, {
    onEnter(args) {
      // Berdasarkan log trace:
      // args[0] = this (GameServerConfig)
      // args[1] = strXmlData (String XML)
      const xmlPtr = args[1];

      if (xmlPtr.isNull()) return;

      try {
        // 1. Ambil konten XML asli
        const il2cppStr = new Il2Cpp.String(xmlPtr);
        let xmlData = il2cppStr.content;

        // 2. Daftar perubahan yang diinginkan (Key: Value)
        const replacements = {
          adjust: "sand",
          channel: "and_usa",
          //'version': '2.2.14.1230.1' // Contoh tambahan jika ingin sekalian ganti versi
        };

        let isModified = false;

        // 3. Proses penggantian menggunakan Regex
        for (const [key, newValue] of Object.entries(replacements)) {
          const regex = new RegExp(`${key}="[^"]*"`, "g");
          if (xmlData.match(regex)) {
            xmlData = xmlData.replace(regex, `${key}="${newValue}"`);
            isModified = true;
          }
        }

        if (isModified) {
          // 4. Alokasikan string baru di heap Unity dan timpa args[1]
          // Menggunakan Il2Cpp.string() adalah cara paling aman di bridge terbaru
          args[1] = Il2Cpp.string(xmlData);

          console.log("[Spoof] XML data modified and injected successfully:");
          console.log(" -> New adjust : " + replacements.adjust);
          console.log(" -> New channel: " + replacements.channel);
        }
      } catch (e) {
        // Menggunakan console.error agar tidak memutus eksekusi script utama
        console.error("[Error] Gagal memanipulasi XML: " + e.message);
      }
    },
  });

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
