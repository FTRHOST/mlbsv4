/**
 * Telemetry Hook Module
 */

import { sessionState } from "../tools/config";
import { debugLog } from "../tools/utils";
import { sendRoomData } from "../tools/telemetry";
import { verifyUserWithRestApiAsync } from "../tools/auth";
import { loadAuthCache } from "../tools/cache";

let cachedOperatorId = "";
let isUserAuthChecked = false;
let lastCaption = "";
let lastDraftPhase = 0;
let lastMapDraw = 0;
const playersCache = new Map();

let lastDraftTime = 0;

function sendRoomDataWithCache(payload) {
  if (!(sessionState.isAuthorized && sessionState.permissions.allowTelemetry)) {
    return;
  }
  if (payload.caption !== undefined) lastCaption = payload.caption;
  if (payload.draftPhase !== undefined) lastDraftPhase = payload.draftPhase;
  if (payload.draftTime !== undefined) {
    lastDraftTime = payload.draftTime;
  } else {
    payload.draftTime = lastDraftTime;
  }
  sendRoomData(payload);
}

export function getOperatorId(SystemData) {
  if (cachedOperatorId) return cachedOperatorId;
  try {
    const OpID = SystemData.field("m_uiID").value;
    const opIdStr = OpID ? OpID.toString() : "";
    if (opIdStr && opIdStr !== "0" && opIdStr !== "undefined") {
      cachedOperatorId = opIdStr;
      if (!isUserAuthChecked) {
        isUserAuthChecked = true;
        loadAuthCache();
        verifyUserWithRestApiAsync(opIdStr);

        setInterval(() => {
          try {
            if (cachedOperatorId) {
              debugLog(
                "Auth Periodic",
                `Performing periodic role verification check for ${cachedOperatorId}...`,
              );
              verifyUserWithRestApiAsync(cachedOperatorId);
            }
          } catch (err) {
            // Ignore
          }
        }, 10000);
      }
      return opIdStr;
    }
  } catch (e) {
    // Ignore
  }
  return "";
}

function getMergedPlayers(activeUid, updateFn) {
  const RoomData = Il2Cpp.domain
    .assembly(Assembly - CSharp)
    .image.class("SystemData/RoomData");
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

export function setupTelemetryHooks(Assembly) {
  const SystemData = Assembly.class("SystemData");
  const RoomData = Assembly.class("SystemData/RoomData");
  const CompetitionData = Assembly.class("CompetitionData");
  const MapTypeData = Assembly.class("Battle.MapTypeData");
  const UIRankHero = Assembly.class("UIRankHero");

  const CanRepotCompetitonData = MapTypeData.method("CanRepotCompetitonData");
  if (CanRepotCompetitonData) {
    Interceptor.attach(CanRepotCompetitonData.virtualAddress, {
      onLeave: function (retval) {
        retval.replace(ptr(1));
      },
    });
  }

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

  const ReportPlayerInfoEx = CompetitionData.method("ReportPlayerInfoEx");
  if (ReportPlayerInfoEx) {
    Interceptor.attach(ReportPlayerInfoEx.virtualAddress, {
      onLeave: function (args) {
        try {
          const opIdStr = getOperatorId(SystemData);
          debugLog("Hook", `Operator account ID: ${opIdStr}`);
          playersCache.clear();
          const players = getMergedPlayers(RoomData, null, null);

          sendRoomDataWithCache({
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
  }

  const ReportPickHeroStart = CompetitionData.method("ReportPickHeroStart");
  if (ReportPickHeroStart) {
    Interceptor.attach(ReportPickHeroStart.virtualAddress, {
      onEnter: function (args) {
        try {
          const playerDataPtr = args[1];
          const playerDataObj = new Il2Cpp.Object(playerDataPtr);
          const activeUid = playerDataObj.field("lUid").value.toString();
          debugLog("Hook", `ReportPickHeroStart active UID: ${activeUid}`);

          const opIdStr = getOperatorId(SystemData);
          const players = getMergedPlayers(
            RoomData,
            activeUid,
            (uid, cached) => {
              if (uid === activeUid) {
                cached.pickPhase = true;
              }
            },
          );

          const activePlayer = players.find((p) => p.id === activeUid);
          const activeTeam = activePlayer ? activePlayer.team : 0;

          const isBluePicking = players.some(
            (p) => p.team === 1 && p.pickPhase,
          );
          const isRedPicking = players.some((p) => p.team === 2 && p.pickPhase);
          let caption = "";
          if (isBluePicking && isRedPicking) {
            caption = "Both Teams Pick";
          } else if (isBluePicking) {
            caption = "Blue Team Pick";
          } else if (isRedPicking) {
            caption = "Red Team Pick";
          }

          sendRoomDataWithCache({
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
  }

  const ReportPickHero = CompetitionData.method("ReportPickHero");
  if (ReportPickHero) {
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

          const opIdStr = getOperatorId(SystemData);
          const players = getMergedPlayers(
            RoomData,
            activeUid,
            (uid, cached) => {
              if (uid === activeUid) {
                cached.pickPhase = false;
                cached.SelHeroID = pickHeroID;
              }
            },
          );

          const activePlayer = players.find((p) => p.id === activeUid);
          const activeTeam = activePlayer ? activePlayer.team : 0;

          const isBluePicking = players.some(
            (p) => p.team === 1 && p.pickPhase,
          );
          const isRedPicking = players.some((p) => p.team === 2 && p.pickPhase);
          let caption = "";
          if (isBluePicking && isRedPicking) {
            caption = "Both Teams Pick";
          } else if (isBluePicking) {
            caption = "Blue Team Pick";
          } else if (isRedPicking) {
            caption = "Red Team Pick";
          }

          sendRoomDataWithCache({
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
  }

  const ReportBanStart = CompetitionData.method("ReportBanStart");
  if (ReportBanStart) {
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

          const opIdStr = getOperatorId(SystemData);
          const players = getMergedPlayers(
            RoomData,
            activeUid,
            (uid, cached) => {
              if (uid === activeUid) {
                cached.banPhase = true;
              }
            },
          );

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

          sendRoomDataWithCache({
            operatorId: opIdStr,
            players: players,
            draftPhase: activeTeam,
            caption: caption,
            mapDraw: lastMapDraw,
            timestamp: new Date().toISOString(),
          });
        } catch (e) {
          debugLog("Hook", `Error in ReportBanStart: ${e.message}`);
        }
      },
    });
  }

  const ReportBanHero = CompetitionData.method("ReportBanHero");
  if (ReportBanHero) {
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

          const opIdStr = getOperatorId(SystemData);
          const players = getMergedPlayers(
            RoomData,
            activeUid,
            (uid, cached) => {
              if (uid === activeUid) {
                cached.banPhase = false;
                cached.banHero = banHeroID;
              }
            },
          );

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

          sendRoomDataWithCache({
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
  }

  const ReceStartChange = UIRankHero.method("ReceStartChange");
  if (ReceStartChange) {
    Interceptor.attach(ReceStartChange.virtualAddress, {
      onEnter: function (args) {
        try {
          const opIdStr = getOperatorId(SystemData);
          const players = getMergedPlayers(RoomData, null, null);
          let phase = 4;
          let caption = "Change";
          let iChangeHeroTimeSpan;

          const instances = Il2Cpp.gc.choose(UIRankHero);
          instances.forEach((uirankObject) => {
            const val = uirankObject.field("iChangeHeroTimeSpan").value;
            iChangeHeroTimeSpan = val;
          });

          sendRoomDataWithCache({
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
  }

  const ReceStartBanTogether = UIRankHero.method("ReceStartBanTogether");
  if (ReceStartBanTogether) {
    Interceptor.attach(ReceStartBanTogether.virtualAddress, {
      onEnter: function (args) {
        try {
          const opIdStr = getOperatorId(SystemData);
          const players = getMergedPlayers(RoomData, null, null);
          let iBanTimeSpan;

          const instances = Il2Cpp.gc.choose(UIRankHero);
          instances.forEach((uirankObject) => {
            const val = uirankObject.field("iBanTimeSpan").value;
            iBanTimeSpan = val;
          });

          sendRoomDataWithCache({
            operatorId: opIdStr,
            draftPhase: lastDraftPhase,
            players: players,
            draftTime: iBanTimeSpan,
            caption: lastCaption,
            mapDraw: lastMapDraw,
            timestamp: new Date().toISOString(),
          });
        } catch (e) {
          debugLog("Hook", `Error in ReceStartChange: ${e.message}`);
        }
      },
    });
  }

  // Hooks for receiving pick and ban phases with proper timing fields
  UIRankHero.methods
    .filter((m) => m.name === "ReceStartBanState")
    .forEach((method) => {
      Interceptor.attach(method.virtualAddress, {
        onEnter: function (args) {
          try {
            const opIdStr = getOperatorId(SystemData);
            const players = getMergedPlayers(RoomData, null, null);
            let iBanTimeSpan;

            const instances = Il2Cpp.gc.choose(UIRankHero);
            instances.forEach((uirankObject) => {
              const val = uirankObject.field("iBanTimeSpan").value;
              iBanTimeSpan = val;
            });

            sendRoomDataWithCache({
              operatorId: opIdStr,
              players: players,
              draftTime: iBanTimeSpan,
              mapDraw: lastMapDraw,
              timestamp: new Date().toISOString(),
            });
          } catch (e) {
            debugLog("Hook", `Error in ReceStartBanState: ${e.message}`);
          }
        },
      });
    });

  UIRankHero.methods
    .filter((m) => m.name === "ReceStartSecondBanState")
    .forEach((method) => {
      Interceptor.attach(method.virtualAddress, {
        onEnter: function (args) {
          try {
            const opIdStr = getOperatorId(SystemData);
            const players = getMergedPlayers(RoomData, null, null);
            let iSecondBanTimeSpan;

            const instances = Il2Cpp.gc.choose(UIRankHero);
            instances.forEach((uirankObject) => {
              const val = uirankObject.field("iSecondBanTimeSpan").value;
              iSecondBanTimeSpan = val;
            });

            sendRoomDataWithCache({
              operatorId: opIdStr,
              players: players,
              draftTime: iSecondBanTimeSpan,
              mapDraw: lastMapDraw,
              timestamp: new Date().toISOString(),
            });
          } catch (e) {
            debugLog("Hook", `Error in ReceStartSecondBanState: ${e.message}`);
          }
        },
      });
    });

  UIRankHero.methods
    .filter((m) => m.name === "ReceStartPickState")
    .forEach((method) => {
      Interceptor.attach(method.virtualAddress, {
        onEnter: function (args) {
          try {
            const opIdStr = getOperatorId(SystemData);
            const players = getMergedPlayers(RoomData, null, null);
            let iPickTimeSpan;

            const instances = Il2Cpp.gc.choose(UIRankHero);
            instances.forEach((uirankObject) => {
              const val = uirankObject.field("iPickTimeSpan").value;
              iPickTimeSpan = val;
            });

            sendRoomDataWithCache({
              operatorId: opIdStr,
              players: players,
              draftTime: iPickTimeSpan,
              mapDraw: lastMapDraw,
              timestamp: new Date().toISOString(),
            });
          } catch (e) {
            debugLog("Hook", `Error in ReceStartPickState: ${e.message}`);
          }
        },
      });
    });

  UIRankHero.methods
    .filter((m) => m.name === "ReceStartSecondPickState")
    .forEach((method) => {
      Interceptor.attach(method.virtualAddress, {
        onEnter: function (args) {
          try {
            const opIdStr = getOperatorId(SystemData);
            const players = getMergedPlayers(RoomData, null, null);
            let iPickTimeSpan;

            const instances = Il2Cpp.gc.choose(UIRankHero);
            instances.forEach((uirankObject) => {
              const val = uirankObject.field("iPickTimeSpan").value;
              iPickTimeSpan = val;
            });

            sendRoomDataWithCache({
              operatorId: opIdStr,
              players: players,
              draftTime: iPickTimeSpan,
              mapDraw: lastMapDraw,
              timestamp: new Date().toISOString(),
            });
          } catch (e) {
            debugLog("Hook", `Error in ReceStartSecondPickState: ${e.message}`);
          }
        },
      });
    });

  const GetBattlePlayerInfo = SystemData.method("GetBattlePlayerInfo");
  if (GetBattlePlayerInfo) {
    Interceptor.attach(GetBattlePlayerInfo.virtualAddress, {
      onEnter: function (args) {
        try {
          const opIdStr = getOperatorId(SystemData);
          debugLog("Hook", `GetBattlePlayerInfo op ID: ${opIdStr}`);
        } catch (e) {
          debugLog("Hook", `Error in GetBattlePlayerInfo: ${e.message}`);
        }
      },
    });
  }

  // Startup Auth Polling Loop
  let authChecksCount = 0;
  function pollOperatorIdForVerification() {
    try {
      const opId = getOperatorId(SystemData);
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
