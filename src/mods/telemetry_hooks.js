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
let lastTimestamp = new Date().toISOString();

let battleData = {
  battleState: "",
  waktuPertandingan: 0,
  blueTeamKill: 0,
  redTeamKill: 0,
  blueTeamGold: 0,
  redTeamGold: 0,
  blueTeamKillLord: 0,
  redTeamKillLord: 0,
  blueTeamKillTurtle: 0,
  redTeamKillTurtle: 0,
  blueTeamDestroyTuret: 0,
  redTeamDestroyTuret: 0
};

function clearAllPhases() {
  playersCache.forEach((cached) => {
    cached.pickPhase = false;
    cached.banPhase = false;
  });
}

function sendRoomDataWithCache(payload) {
  if (!(sessionState.isAuthorized && sessionState.permissions.allowTelemetry)) {
    return;
  }
  if (payload.caption !== undefined) {
    lastCaption = payload.caption;
  } else {
    payload.caption = lastCaption;
  }
  if (payload.draftPhase !== undefined) {
    lastDraftPhase = payload.draftPhase;
  } else {
    payload.draftPhase = lastDraftPhase;
  }
  if (payload.draftTime !== undefined) {
    lastDraftTime = payload.draftTime;
  } else {
    payload.draftTime = lastDraftTime;
  }
  if (payload.timestamp !== undefined) {
    lastTimestamp = payload.timestamp;
  } else {
    payload.timestamp = lastTimestamp;
  }
  
  if (payload.Battle === undefined) {
    payload.Battle = battleData;
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
    .assembly("Assembly-CSharp")
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
      debugLog(
        "Hook",
        `Failed parsing RoomData fields: ${err.stack || err.message}`,
      );
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
          const players = getMergedPlayers(null, null);

          sendRoomDataWithCache({
            operatorId: opIdStr,
            players: players,
            draftPhase: 0,
            draftTime: 0,
            caption: "",
            mapDraw: lastMapDraw,
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
          const players = getMergedPlayers(activeUid, (uid, cached) => {
            if (uid === activeUid) {
              cached.pickPhase = true;
            }
          });

          const activePlayer = players.find((p) => p.id === activeUid);
          const activeTeam = activePlayer ? activePlayer.team : 0;

          const isBluePicking = players.some(
            (p) => p.team === 1 && p.pickPhase,
          );
          const isRedPicking = players.some((p) => p.team === 2 && p.pickPhase);
          let caption = "";
          let phaseToSend = 0;
          if (isBluePicking && isRedPicking) {
            caption = "Both Teams Pick";
            phaseToSend = 6;
          } else if (isBluePicking) {
            caption = "Blue Team Pick";
            phaseToSend = 4;
          } else if (isRedPicking) {
            caption = "Red Team Pick";
            phaseToSend = 5;
          }

          sendRoomDataWithCache({
            operatorId: opIdStr,
            players: players,
            draftPhase: phaseToSend,
            caption: caption,
            mapDraw: lastMapDraw,
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
          const players = getMergedPlayers(activeUid, (uid, cached) => {
            if (uid === activeUid) {
              cached.pickPhase = false;
              cached.SelHeroID = pickHeroID;
            }
          });

          const activePlayer = players.find((p) => p.id === activeUid);
          const activeTeam = activePlayer ? activePlayer.team : 0;

          const isBluePicking = players.some(
            (p) => p.team === 1 && p.pickPhase,
          );
          const isRedPicking = players.some((p) => p.team === 2 && p.pickPhase);
          let caption = "";
          let phaseToSend = 0;
          if (isBluePicking && isRedPicking) {
            caption = "Both Teams Pick";
            phaseToSend = 6;
          } else if (isBluePicking) {
            caption = "Blue Team Pick";
            phaseToSend = 4;
          } else if (isRedPicking) {
            caption = "Red Team Pick";
            phaseToSend = 5;
          }

          sendRoomDataWithCache({
            operatorId: opIdStr,
            players: players,
            draftPhase: phaseToSend,
            caption: caption,
            mapDraw: lastMapDraw,
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
          let phaseToSend = 0;
          if (isBlueBanning && isRedBanning) {
            caption = "Both Teams Ban";
            phaseToSend = 3;
          } else if (isBlueBanning) {
            caption = "Blue Team Ban";
            phaseToSend = 1;
          } else if (isRedBanning) {
            caption = "Red Team Ban";
            phaseToSend = 2;
          }

          sendRoomDataWithCache({
            operatorId: opIdStr,
            players: players,
            draftPhase: phaseToSend,
            caption: caption,
            mapDraw: lastMapDraw,
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
          let phaseToSend = 0;
          if (isBlueBanning && isRedBanning) {
            caption = "Both Teams Ban";
            phaseToSend = 3;
          } else if (isBlueBanning) {
            caption = "Blue Team Ban";
            phaseToSend = 1;
          } else if (isRedBanning) {
            caption = "Red Team Ban";
            phaseToSend = 2;
          }

          sendRoomDataWithCache({
            operatorId: opIdStr,
            players: players,
            draftPhase: phaseToSend,
            caption: caption,
            mapDraw: lastMapDraw,
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
          clearAllPhases();
          const opIdStr = getOperatorId(SystemData);
          const players = getMergedPlayers(null, null);
          let phase = 7;
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
          clearAllPhases();
          const opIdStr = getOperatorId(SystemData);
          const players = getMergedPlayers(null, null);
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
            clearAllPhases();
            const opIdStr = getOperatorId(SystemData);
            const players = getMergedPlayers(null, null);
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
            clearAllPhases();
            const opIdStr = getOperatorId(SystemData);
            const players = getMergedPlayers(null, null);
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
    .filter((m) => m.name === "ShowPicking")
    .forEach((method) => {
      Interceptor.attach(method.virtualAddress, {
        onEnter: function (args) {
          try {
            clearAllPhases();
            const opIdStr = getOperatorId(SystemData);
            const players = getMergedPlayers(null, null);
            let iPickTimeSpan;

            let duration = args[1].toInt32();

            iPickTimeSpan = duration;

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

  // --- BATTLE TELEMETRY HOOKS ---
  try {
    const ShowFightDataTiny = Assembly.class("ShowFightDataTiny");
    const PlayerData = Assembly.class("PlayerData");
    const TimerBase = Assembly.class("TimerBase");
    
    const GetElapsedTimeSinceBattleStart = TimerBase.method("GetElapsedTimeSinceBattleStart");
    const ReportKillEvent = CompetitionData.method("ReportKillEvent");
    const ReportCampBossKillTimes = CompetitionData.method("ReportCampBossKillTimes");
    const CountTowerKillTimes = CompetitionData.method("CountTowerKillTimes");
    
    const BattleManagerClass = Assembly.class("LogicBattleManager");
    const SetBattleState = BattleManagerClass.method("set_m_eState");

    const eBState_Play = "eBState_Play"; // Memastikan cocok dengan nilai string dari Il2Cpp
    let isHookActive = false;
    let Objek = null;

    const originalReportKill = ReportKillEvent.implementation;
    const originalSetGold = PlayerData.method("set_m_Gold").implementation;
    const originalReportBoss = ReportCampBossKillTimes.implementation;
    const originalCountTower = CountTowerKillTimes.implementation;
    const originalGetTime = GetElapsedTimeSinceBattleStart.implementation;

    function updateAndSendBattleData() {
      try {
        const opIdStr = getOperatorId(SystemData);
        const players = getMergedPlayers(null, null);
        sendRoomDataWithCache({
          operatorId: opIdStr,
          players: players,
          Battle: battleData
        });
      } catch (e) {
        debugLog("Battle", `Error sending battle data: ${e.message}`);
      }
    }

    function aktifkanFitur() {
      if (isHookActive) return;
      debugLog("Battle", "Mengaktifkan Fitur Pertandingan...");

      const instance = Il2Cpp.gc.choose(ShowFightDataTiny);
      if (instance.length === 0) {
        debugLog("Battle", "Instance ShowFightDataTiny belum siap!");
        return;
      }
      
      Objek = instance[0];
      isHookActive = true;

      ReportKillEvent.implementation = function (killer, deader, assitID, bFirstBoold, eventType, multKill, contiKill) {
        setTimeout(() => {
          if (!Objek) return;
          battleData.blueTeamKill = Objek.field("m_iCampAKill").value;
          battleData.redTeamKill = Objek.field("m_iCampBKill").value;
          updateAndSendBattleData();
        }, 500);
        return this.method("ReportKillEvent").invoke(killer, deader, assitID, bFirstBoold, eventType, multKill, contiKill);
      };

      PlayerData.method("set_m_Gold").implementation = function (value) {
        this.method("set_m_Gold").invoke(value);
        if (Objek) {
          battleData.blueTeamGold = Objek.field("m_CampAGold").value;
          battleData.redTeamGold = Objek.field("m_CampBGold").value;
        }
      };

      ReportCampBossKillTimes.implementation = function (killerCamp, wildType) {
        setTimeout(() => {
          if (!Objek) return;
          battleData.blueTeamKillLord = Objek.field("m_CampAKillLingZhu").value;
          battleData.redTeamKillLord = Objek.field("m_CampBKillLingZhu").value;
          battleData.blueTeamKillTurtle = Objek.field("m_CampAKillShenGui").value;
          battleData.redTeamKillTurtle = Objek.field("m_CampBKillShenGui").value;
          updateAndSendBattleData();
        }, 500);
        return this.method("ReportCampBossKillTimes").invoke(killerCamp, wildType);
      };

      CountTowerKillTimes.implementation = function (type) {
        setTimeout(() => {
          if (!Objek) return;
          battleData.blueTeamDestroyTuret = Objek.field("m_CampAKillTower").value;
          battleData.redTeamDestroyTuret = Objek.field("m_CampBKillTower").value;
          updateAndSendBattleData();
        }, 500);
        return this.method("CountTowerKillTimes").invoke(type);
      };

      let lastWaktuKirim = 0;
      GetElapsedTimeSinceBattleStart.implementation = function () {
        const waktu = this.method("GetElapsedTimeSinceBattleStart").invoke();
        battleData.waktuPertandingan = waktu;
        
        // Membatasi pengiriman API agar hanya 1 kali setiap 1 detik (1000 milidetik)
        if (waktu - lastWaktuKirim >= 1000 || waktu < lastWaktuKirim) {
          lastWaktuKirim = waktu;
          updateAndSendBattleData();
        }
        
        return waktu;
      };
    }

    function nonaktifkanFitur() {
      if (!isHookActive) return;
      debugLog("Battle", "Mematikan Fitur Pertandingan (Kembali ke Normal)...");

      ReportKillEvent.implementation = originalReportKill;
      PlayerData.method("set_m_Gold").implementation = originalSetGold;
      ReportCampBossKillTimes.implementation = originalReportBoss;
      CountTowerKillTimes.implementation = originalCountTower;
      GetElapsedTimeSinceBattleStart.implementation = originalGetTime;

      Objek = null;
      isHookActive = false;
    }

    SetBattleState.implementation = function (value) {
      this.method("set_m_eState").invoke(value);

      const stateStr = value.toString();
      debugLog("Battle", `[State Changed] BattleState bernilai: ${stateStr}`);
      battleData.battleState = stateStr;

      if (stateStr === eBState_Play) {
        aktifkanFitur();
      } else {
        nonaktifkanFitur();
      }
      
      updateAndSendBattleData();
    };
  } catch (err) {
    debugLog("Battle", `Failed setting up Battle hooks: ${err.message}`);
  }
}
