/**
 * MLBB Core Hook Implementation - Modular & Debuggable
 */

import "frida-il2cpp-bridge";
import { sessionState } from "./config";
import { debugLog } from "./utils";
import { sendRoomData } from "./telemetry";
import { verifyUserWithRestApiAsync } from "./auth";
import { loadAuthCache } from "./cache";

// Load auth cache immediately at global startup to determine user role
try {
  loadAuthCache();
} catch (e) {
  // Ignore
}

const TARGET_LIB = "liblogic.so";

debugLog("Bootstrap", "Menunggu library liblogic.so termuat...");
function main() {
  debugLog("Bootstrap", "Waiting for EGL Rendering to be ready...");

  let eglSwapBuffers = null;
  const libEGL =
    Process.findModuleByName("libEGL.so") ||
    Process.findModuleByName("libGLESv2.so");

  if (libEGL) {
    try {
      eglSwapBuffers = libEGL.getExportByName("eglSwapBuffers");
    } catch (e) {
      eglSwapBuffers = null;
    }
  }

  if (!eglSwapBuffers) {
    try {
      eglSwapBuffers = Module.findExportByName(null, "eglSwapBuffers");
    } catch (e) {
      eglSwapBuffers = null;
    }
  }

  if (eglSwapBuffers) {
    let frameCount = 0;
    const eglHook = Interceptor.attach(eglSwapBuffers, {
      onEnter: function (args) {
        frameCount++;
        if (frameCount >= 2) {
          eglHook.detach();
          debugLog("Bootstrap", "EGL Rendering is READY.");
          waitForLogicLib();
        }
      },
    });
  } else {
    setTimeout(main, 50);
  }
}

function waitForLogicLib() {
  debugLog("Bootstrap", `Monitoring for ${TARGET_LIB}...`);

  const mod = Process.findModuleByName(TARGET_LIB);
  if (mod) {
    setupIl2CppHook(mod);
  } else {
    let dlopen = null;
    try {
      dlopen =
        Module.findExportByName(null, "android_dlopen_ext") ||
        Module.findExportByName(null, "dlopen");
    } catch (e) {
      const libc = Process.findModuleByName("libc.so");
      if (libc) {
        try {
          dlopen =
            libc.getExportByName("android_dlopen_ext") ||
            libc.getExportByName("dlopen");
        } catch (e2) {
          dlopen = null;
        }
      }
    }

    if (dlopen) {
      const monitor = Interceptor.attach(dlopen, {
        onEnter: function (args) {
          this.path = args[0].readUtf8String();
        },
        onLeave: function (retval) {
          if (this.path && this.path.indexOf(TARGET_LIB) !== -1) {
            monitor.detach();
            const targetMod = Process.getModuleByName(TARGET_LIB);
            setupIl2CppHook(targetMod);
          }
        },
      });
    } else {
      debugLog("Bootstrap", "Error: Could not find dlopen to monitor.");
      setTimeout(waitForLogicLib);
    }
  }
}

function setupIl2CppHook(targetMod) {
  const il2cpp_init = targetMod.findExportByName
    ? targetMod.findExportByName("il2cpp_init")
    : targetMod.getExportByName("il2cpp_init");
  if (il2cpp_init) {
    const il2cpp_domain_get = targetMod.findExportByName
      ? targetMod.findExportByName("il2cpp_domain_get")
      : targetMod.getExportByName("il2cpp_domain_get");
    let isInitialized = false;
    if (il2cpp_domain_get) {
      const get_domain = new NativeFunction(il2cpp_domain_get, "pointer", []);
      if (!get_domain().isNull()) {
        isInitialized = true;
      }
    }

    if (isInitialized) {
      debugLog(
        "Bootstrap",
        `${targetMod.name} is ALREADY initialized. Executing hooks now...`,
      );
      executeSimpleHooks(targetMod);
    } else {
      Interceptor.attach(il2cpp_init, {
        onLeave: function (retval) {
          debugLog(
            "Bootstrap",
            `${targetMod.name} (il2cpp_init) finished. Executing hooks...`,
          );
          executeSimpleHooks(targetMod);
        },
      });
    }
  } else {
    debugLog("Bootstrap", `Error: il2cpp_init not found in ${targetMod.name}`);
  }
}

function executeSimpleHooks() {
  Il2Cpp.$config.moduleName = "liblogic.so";
  let cachedOperatorId = "";
  let isUserAuthChecked = false;

  // Load auth cache immediately at startup so early hooks work instantly
  try {
    loadAuthCache();
  } catch (e) {
    debugLog("Bootstrap", `Failed loading startup auth cache: ${e.message}`);
  }

  const Assembly = Il2Cpp.domain.assembly("Assembly-CSharp").image;

  // Class Init
  const ChooseHeroMgr = Assembly.class("ChooseHeroMgr");
  const SystemData = Assembly.class("SystemData");
  const RoomData = Assembly.class("SystemData/RoomData");
  const CompetitionData = Assembly.class("CompetitionData");
  const MapTypeData = Assembly.class("Battle.MapTypeData");
  const UIRankHero = Assembly.class("UIRankHero");
  const GameInit = Assembly.class("GameInit");

  // Hook 1: Free Skin Mod (Restricted to VIP and Admin)
  const BActFreeSkin = ChooseHeroMgr.method("BActFreeSkin");
  Interceptor.attach(BActFreeSkin.virtualAddress, {
    onLeave: function (retval) {
      if (sessionState.isAuthorized && sessionState.permissions.allowFreeSkin) {
        retval.replace(ptr(1));
      }
    },
  });

  // Hook 2: Competition Report (Restricted to Admin & VIP)
  const CanRepotCompetitonData = MapTypeData.method("CanRepotCompetitonData");
  Interceptor.attach(CanRepotCompetitonData.virtualAddress, {
    onLeave: function (retval) {
      if (
        sessionState.isAuthorized &&
        sessionState.permissions.allowBattleFeatures
      ) {
        retval.replace(ptr(1));
      }
    },
  });

  // Hook 3: Sandbox/GM Mode IP Check (Restricted to Admin only)
  const IsSandBoxIp = GameInit.method("IsSandBoxIp");
  Interceptor.attach(IsSandBoxIp.virtualAddress, {
    onLeave: function (retval) {
      if (sessionState.isAuthorized && sessionState.permissions.allowGMMode) {
        retval.replace(ptr(1));
        debugLog("Hook", "GM Mode/Sandbox IP hook applied.");
      }
    },
  });

  let lastMapDraw = 0;
  const LogicBattleManager = Assembly.tryClass("LogicBattleManager");
  if (LogicBattleManager && !LogicBattleManager.handle.isNull()) {
    const get_m_iNext2025Feature = LogicBattleManager.tryMethod(
      "get_m_iNext2025Feature",
    );
    if (get_m_iNext2025Feature) {
      Interceptor.attach(get_m_iNext2025Feature.virtualAddress, {
        onLeave: function (retval) {
          try {
            const val = retval.toInt32();
            lastMapDraw = val;
          } catch (err) {
            debugLog(
              "Hook",
              `Error reading get_m_iNext2025Feature: ${err.message}`,
            );
          }
        },
      });
    }
  }

  // Local Cache to merge players
  const playersCache = new Map();

  function getMergedPlayers(activeUid, updateFn) {
    const instances = Il2Cpp.gc.choose(RoomData);
    const slotsMap = new Map();

    instances.forEach((roomObject) => {
      try {
        const iPosVal = roomObject.field("iPos").value;
        const iPos = iPosVal ? Number(iPosVal.toString()) : 0;
        if (iPos < 1 || iPos > 10) return;

        const ID = roomObject.field("lUid").value;
        const uid = ID ? ID.toString() : "";
        if (!uid || uid === "0") return;

        const Name = roomObject.field("_sName").value;
        const Role = roomObject.field("iRoad").value;
        const Team = roomObject.field("iCamp").value;
        const BattleSpell = roomObject.field("summonSkillId").value;
        const emblem = roomObject.field("runeId").value;
        const emblemSkil = roomObject.field("mRuneSkill2023").value;

        let cached = playersCache.get(uid);
        if (!cached) {
          cached = {
            pickPhase: false,
            banPhase: false,
            SelHeroID: 0,
            banHero: 0,
          };
        }

        if (updateFn) {
          updateFn(uid, cached);
        }

        const nameStr = Name ? Name.content || "" : "";
        let verifiedTeam = 0;
        if (iPos >= 1 && iPos <= 5) {
          verifiedTeam = 1;
        } else if (iPos >= 6 && iPos <= 10) {
          verifiedTeam = 2;
        } else {
          return;
        }

        const actualTeam = Team ? Number(Team.toString()) : 0;
        if (actualTeam !== verifiedTeam) return;

        const emblemSkills = [];
        if (emblemSkil && !emblemSkil.isNull()) {
          try {
            const enumerator = emblemSkil.method("GetEnumerator").invoke();
            while (enumerator.method("MoveNext").invoke()) {
              const current = enumerator.method("get_Current").invoke();
              const key = current.method("get_Key").invoke();
              const value = current.method("get_Value").invoke();
              emblemSkills.push({
                slot: key ? Number(key.toString()) : 0,
                id: value ? Number(value.toString()) : 0,
              });
            }
          } catch (err) {
            debugLog("Hook", `Failed reading emblemSkil: ${err.message}`);
          }
        }

        const playerObj = {
          ipos: iPos,
          id: uid,
          name: nameStr,
          role: Role ? Number(Role.toString()) : 0,
          team: verifiedTeam,
          battleSpell: BattleSpell ? Number(BattleSpell.toString()) : 0,
          emblem: emblem ? Number(emblem.toString()) : 0,
          emblemSkills: emblemSkills,
          pickPhase: cached.pickPhase,
          banPhase: cached.banPhase,
          SelHeroID: cached.SelHeroID,
          banHero: cached.banHero,
        };

        playersCache.set(uid, cached);
        slotsMap.set(iPos, playerObj);
      } catch (err) {
        debugLog("Hook", `Failed parsing RoomData fields: ${err.message}`);
      }
    });

    return Array.from(slotsMap.values());
  }

  function getOperatorId() {
    if (cachedOperatorId) return cachedOperatorId;
    try {
      const OpID = SystemData.field("m_uiID").value;
      const opIdStr = OpID ? OpID.toString() : "";
      if (opIdStr && opIdStr !== "0" && opIdStr !== "undefined") {
        cachedOperatorId = opIdStr;
        if (!isUserAuthChecked) {
          isUserAuthChecked = true;
          // 1. Immediately load local cached session details so hooks work instantly on boot
          loadAuthCache();
          // 2. Perform async network validation in background
          verifyUserWithRestApiAsync(opIdStr);
        }
        return opIdStr;
      }
    } catch (e) {
      // Ignore
    }
    return "";
  }

  // Hook 4: Player Info Telemetry Hook
  const ReportPlayerInfoEx = CompetitionData.method("ReportPlayerInfoEx");
  Interceptor.attach(ReportPlayerInfoEx.virtualAddress, {
    onLeave: function (args) {
      try {
        const opIdStr = getOperatorId();
        debugLog("Hook", `Operator account ID: ${opIdStr}`);
        playersCache.clear();
        const players = getMergedPlayers(null, null);

        sendRoomData({
          operatorId: opIdStr,
          players: players,
          draftPhase: 0,
          draftTime: 0,
          caption: "",
          mapDraw: lastMapDraw,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        debugLog("Hook", `Error in ReportPlayerInfoEx: ${e.message}`);
      }
    },
  });

  // Hook 5: Pick Hero Start Hook
  const ReportPickHeroStart = CompetitionData.method("ReportPickHeroStart");
  Interceptor.attach(ReportPickHeroStart.virtualAddress, {
    onEnter: function (args) {
      try {
        const playerDataPtr = args[1];
        const playerDataObj = new Il2Cpp.Object(playerDataPtr);
        const activeUid = playerDataObj.field("lUid").value.toString();
        debugLog("Hook", `ReportPickHeroStart active UID: ${activeUid}`);

        const opIdStr = getOperatorId();
        const players = getMergedPlayers(activeUid, (uid, cached) => {
          if (uid === activeUid) {
            cached.pickPhase = true;
          }
        });

        const activePlayer = players.find((p) => p.id === activeUid);
        const activeTeam = activePlayer ? activePlayer.team : 0;

        const isBluePicking = players.some((p) => p.team === 1 && p.pickPhase);
        const isRedPicking = players.some((p) => p.team === 2 && p.pickPhase);
        let caption = "";
        if (isBluePicking && isRedPicking) {
          caption = "Both Teams Pick";
        } else if (isBluePicking) {
          caption = "Blue Team Pick";
        } else if (isRedPicking) {
          caption = "Red Team Pick";
        }

        sendRoomData({
          operatorId: opIdStr,
          players: players,
          draftPhase: activeTeam,
          caption: caption,
          mapDraw: lastMapDraw,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        debugLog("Hook", `Error in ReportPickHeroStart: ${e.message}`);
      }
    },
  });

  // Hook 6: Pick Hero Submit Hook
  const ReportPickHero = CompetitionData.method("ReportPickHero");
  Interceptor.attach(ReportPickHero.virtualAddress, {
    onEnter: function (args) {
      try {
        const playerDataPtr = args[1];
        const pickHeroID = args[2].toInt32();
        const playerDataObj = new Il2Cpp.Object(playerDataPtr);
        const activeUid = playerDataObj.field("lUid").value.toString();
        debugLog(
          "Hook",
          `ReportPickHero UID: ${activeUid}, heroID: ${pickHeroID}`,
        );

        const opIdStr = getOperatorId();
        const players = getMergedPlayers(activeUid, (uid, cached) => {
          if (uid === activeUid) {
            cached.pickPhase = false;
            cached.SelHeroID = pickHeroID;
          }
        });

        const activePlayer = players.find((p) => p.id === activeUid);
        const activeTeam = activePlayer ? activePlayer.team : 0;

        const isBluePicking = players.some((p) => p.team === 1 && p.pickPhase);
        const isRedPicking = players.some((p) => p.team === 2 && p.pickPhase);
        let caption = "";
        if (isBluePicking && isRedPicking) {
          caption = "Both Teams Pick";
        } else if (isBluePicking) {
          caption = "Blue Team Pick";
        } else if (isRedPicking) {
          caption = "Red Team Pick";
        }

        sendRoomData({
          operatorId: opIdStr,
          players: players,
          draftPhase: activeTeam,
          caption: caption,
          mapDraw: lastMapDraw,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        debugLog("Hook", `Error in ReportPickHero: ${e.message}`);
      }
    },
  });

  // Hook 7: Ban Hero Start Hook
  const ReportBanStart = CompetitionData.method("ReportBanStart");
  Interceptor.attach(ReportBanStart.virtualAddress, {
    onEnter: function (args) {
      try {
        const playerDataPtr = args[1];
        const banTimeSpan = args[2].toInt32();
        const playerDataObj = new Il2Cpp.Object(playerDataPtr);
        const activeUid = playerDataObj.field("lUid").value.toString();
        debugLog(
          "Hook",
          `ReportBanStart UID: ${activeUid}, time: ${banTimeSpan}`,
        );

        const opIdStr = getOperatorId();
        const players = getMergedPlayers(activeUid, (uid, cached) => {
          if (uid === activeUid) {
            cached.banPhase = true;
          }
        });

        const activePlayer = players.find((p) => p.id === activeUid);
        const activeTeam = activePlayer ? activePlayer.team : 0;

        const isBlueBanning = players.some((p) => p.team === 1 && p.banPhase);
        const isRedBanning = players.some((p) => p.team === 2 && p.banPhase);
        let caption = "";
        if (isBlueBanning && isRedBanning) {
          caption = "Both Teams Ban";
        } else if (isBlueBanning) {
          caption = "Blue Team Ban";
        } else if (isRedBanning) {
          caption = "Red Team Ban";
        }

        sendRoomData({
          operatorId: opIdStr,
          players: players,
          draftPhase: activeTeam,
          draftTime: banTimeSpan,
          caption: caption,
          mapDraw: lastMapDraw,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        debugLog("Hook", `Error in ReportBanStart: ${e.message}`);
      }
    },
  });

  // Hook 8: Ban Hero Submit Hook
  const ReportBanHero = CompetitionData.method("ReportBanHero");
  Interceptor.attach(ReportBanHero.virtualAddress, {
    onEnter: function (args) {
      try {
        const playerDataPtr = args[1];
        const banHeroID = args[2].toInt32();
        const playerDataObj = new Il2Cpp.Object(playerDataPtr);
        const activeUid = playerDataObj.field("lUid").value.toString();
        debugLog(
          "Hook",
          `ReportBanHero UID: ${activeUid}, heroID: ${banHeroID}`,
        );

        const opIdStr = getOperatorId();
        const players = getMergedPlayers(activeUid, (uid, cached) => {
          if (uid === activeUid) {
            cached.banPhase = false;
            cached.banHero = banHeroID;
          }
        });

        const activePlayer = players.find((p) => p.id === activeUid);
        const activeTeam = activePlayer ? activePlayer.team : 0;

        const isBlueBanning = players.some((p) => p.team === 1 && p.banPhase);
        const isRedBanning = players.some((p) => p.team === 2 && p.banPhase);
        let caption = "";
        if (isBlueBanning && isRedBanning) {
          caption = "Both Teams Ban";
        } else if (isBlueBanning) {
          caption = "Blue Team Ban";
        } else if (isRedBanning) {
          caption = "Red Team Ban";
        }

        sendRoomData({
          operatorId: opIdStr,
          players: players,
          draftPhase: activeTeam,
          caption: caption,
          mapDraw: lastMapDraw,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        debugLog("Hook", `Error in ReportBanHero: ${e.message}`);
      }
    },
  });

  // Hook 9: Swap Hero Phase Hook
  const ReceStartChange = UIRankHero.method("ReceStartChange");
  Interceptor.attach(ReceStartChange.virtualAddress, {
    onEnter: function (args) {
      try {
        const opIdStr = getOperatorId();
        const players = getMergedPlayers(null, null);
        let phase = 4;
        let caption = "Change";
        let iChangeHeroTimeSpan;

        const instances = Il2Cpp.gc.choose(UIRankHero);
        instances.forEach((uirankObject) => {
          const val = uirankObject.field("iChangeHeroTimeSpan").value;
          iChangeHeroTimeSpan = val;
        });

        sendRoomData({
          operatorId: opIdStr,
          draftPhase: phase,
          players: players,
          draftTime: iChangeHeroTimeSpan,
          caption: caption,
          mapDraw: lastMapDraw,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        debugLog("Hook", `Error in ReceStartChange: ${e.message}`);
      }
    },
  });

  // Hook 10: Operator ID Initialization Hook
  const GetBattlePlayerInfo = SystemData.method("GetBattlePlayerInfo");
  Interceptor.attach(GetBattlePlayerInfo.virtualAddress, {
    onEnter: function (args) {
      try {
        const opIdStr = getOperatorId();
        debugLog("Hook", `GetBattlePlayerInfo op ID: ${opIdStr}`);
      } catch (e) {
        debugLog("Hook", `Error in GetBattlePlayerInfo: ${e.message}`);
      }
    },
  });

  // Startup Auth Polling Loop
  let authChecksCount = 0;
  function pollOperatorIdForVerification() {
    try {
      const opId = getOperatorId();
      if (opId) {
        debugLog(
          "REST API User",
          `Operator ID found during startup poll: ${opId}`,
        );
      } else {
        authChecksCount++;
        if (authChecksCount < 60) {
          setTimeout(pollOperatorIdForVerification, 1000);
        }
      }
    } catch (e) {
      authChecksCount++;
      if (authChecksCount < 60) {
        setTimeout(pollOperatorIdForVerification, 1000);
      }
    }
  }

  pollOperatorIdForVerification();
}

setImmediate(main);
