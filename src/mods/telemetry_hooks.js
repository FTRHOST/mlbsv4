/**
 * Telemetry Hook Module
 */

import { sessionState } from "../tools/config";
import { debugLog } from "../tools/utils";
import { sendRoomData, sendBattleStats } from "../tools/telemetry";
import { verifyUserWithRestApiAsync } from "../tools/auth";
import { loadAuthCache } from "../tools/cache";

let cachedOperatorId = "";
let isUserAuthChecked = false;
let lastCaption = "";
let lastDraftPhase = 0;
let lastMapDraw = 0;
const playersCache = new Map();
let lastKnownPlayers = [];

let lastDraftTime = 0;
let lastTimestamp = new Date().toISOString();

let lastWinCamp = 0;

let battleData = {
  battleState: "",
  winCamp: 0,
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
  redTeamDestroyTuret: 0,
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

function getMergedPlayers(activeUid, updateFn, forceScan = false) {
  if (!forceScan && lastKnownPlayers && lastKnownPlayers.length > 0) {
    if (activeUid && updateFn) {
      let cached = playersCache.get(activeUid);
      if (!cached) {
        cached = {
          pickPhase: false,
          banPhase: false,
          SelHeroID: 0,
          banHero: 0,
        };
        playersCache.set(activeUid, cached);
      }
      updateFn(activeUid, cached);

      const pIndex = lastKnownPlayers.findIndex((p) => p.id === activeUid);
      if (pIndex !== -1) {
        lastKnownPlayers[pIndex].pickPhase = cached.pickPhase;
        lastKnownPlayers[pIndex].banPhase = cached.banPhase;
        lastKnownPlayers[pIndex].SelHeroID = cached.SelHeroID;
        lastKnownPlayers[pIndex].banHero = cached.banHero;
      }
    }
    return lastKnownPlayers;
  }

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

  lastKnownPlayers = Array.from(slotsMap.values());
  return lastKnownPlayers;
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

  const LogicBattleEndCtrl = Assembly.tryClass("LogicBattleEndCtrl");
  if (LogicBattleEndCtrl && !LogicBattleEndCtrl.handle.isNull()) {
    const StartEndBattle = LogicBattleEndCtrl.tryMethod("StartEndBattle");
    if (StartEndBattle) {
      StartEndBattle.implementation = function (targetPos, failCamp, endType) {
        try {
            const opIdStr = getOperatorId(SystemData);
            
            // 1. Hitung winCamp
            const val = failCamp.field("value__").value;
            const winCamp = (val === 1) ? 2 : ((val === 2) ? 1 : 0);
            
            // 2. Buat clone data untuk dikirim agar tidak terpengaruh oleh reset
            const finalBattleData = { ...battleData, winCamp: winCamp };
            
            // 3. Kirim payload lengkap (Battle + Players)
            if (opIdStr) {
                debugLog("Battle", "Saving final battle data before reset...");
                sendBattleStats(opIdStr, {
                    Battle: finalBattleData,
                    players: lastKnownPlayers,
                    timestamp: new Date().toISOString()
                });
            }

            // 4. Update lastWinCamp
            lastWinCamp = winCamp;
            debugLog("lastWinCamp", `Team yang menang dengan id : ${lastWinCamp}`);
            
            // 5. Reset battleData setelah data dipastikan tersalin
            battleData = {
              battleState: "",
              winCamp: 0,
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
              redTeamDestroyTuret: 0,
            };
        } catch (err) {
            debugLog("Hook", `Error in StartEndBattle hook: ${err.message}`);
        }
        
        // Selalu jalankan fungsi asli
        return this.method("StartEndBattle").invoke(targetPos, failCamp, endType);
      };
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
          const players = getMergedPlayers(null, null, true);

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
          let iChangeHeroTimeSpan = 0;

          try {
            const uirankObject = new Il2Cpp.Object(args[0]);
            iChangeHeroTimeSpan = uirankObject.field(
              "iChangeHeroTimeSpan",
            ).value;
          } catch (e) {}

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
          let iBanTimeSpan = 0;

          try {
            const uirankObject = new Il2Cpp.Object(args[0]);
            iBanTimeSpan = uirankObject.field("iBanTimeSpan").value;
          } catch (e) {}

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
            let iBanTimeSpan = 0;

            try {
              const uirankObject = new Il2Cpp.Object(args[0]);
              iBanTimeSpan = uirankObject.field("iBanTimeSpan").value;
            } catch (e) {}

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
            let iSecondBanTimeSpan = 0;

            try {
              const uirankObject = new Il2Cpp.Object(args[0]);
              iSecondBanTimeSpan =
                uirankObject.field("iSecondBanTimeSpan").value;
            } catch (e) {}

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

    const GetElapsedTimeSinceBattleStart = TimerBase.tryMethod(
      "GetElapsedTimeSinceBattleStart",
    );
    const ReportKillEvent = CompetitionData.tryMethod("ReportKillEvent");
    const ReportCampBossKillTimes = CompetitionData.tryMethod(
      "ReportCampBossKillTimes",
    );
    const CountTowerKillTimes = CompetitionData.tryMethod(
      "CountTowerKillTimes",
    );

    const BattleManagerClass = Assembly.class("LogicBattleManager");
    const SetBattleState = BattleManagerClass.method("set_m_eState");

    const eBState_Play = "eBState_Play";
    let isHookActive = false;
    let Objek = null;
    let lastWaktuKirim = 0;

    function updateAndSendBattleData() {
      try {
        const opIdStr = getOperatorId(SystemData);
        // Jangan panggil getMergedPlayers() lagi untuk mencegah stutter!
        // Gunakan cache dari array lastKnownPlayers yang sudah di-set sebelumnya saat draft.
        sendRoomDataWithCache({
          operatorId: opIdStr,
          players: lastKnownPlayers,
          Battle: battleData,
        });
      } catch (e) {
        debugLog("Battle", `Error sending battle data: ${e.message}`);
      }
    }

    function aktifkanFitur() {
      if (isHookActive && Objek) return; 
      debugLog("Battle", "Mengaktifkan/Memperbarui Fitur Pertandingan...");
      isHookActive = true;

      try {
        const instance = Il2Cpp.gc.choose(ShowFightDataTiny);
        if (instance.length > 0) {
          Objek = instance[0];
          debugLog("Battle", "Instance ShowFightDataTiny ditemukan!");
        } else {
          debugLog("Battle", "Instance ShowFightDataTiny belum siap!");
        }
      } catch (e) {
        debugLog("Battle", `Error gc.choose: ${e.message}`);
      }
    }

    function nonaktifkanFitur() {
      if (!isHookActive) return;
      debugLog("Battle", "Mematikan Fitur Pertandingan (Kembali ke Normal)...");
      isHookActive = false;
      Objek = null;
    }

    // Menggunakan Interceptor.attach untuk fungsi yang dipanggil sangat sering agar tidak freeze
    if (ReportKillEvent) {
      Interceptor.attach(ReportKillEvent.virtualAddress, {
        onLeave: function (retval) {
          if (!isHookActive || !Objek) return;
          setTimeout(() => {
            try {
              battleData.blueTeamKill = Objek.field("m_iCampAKill").value;
              battleData.redTeamKill = Objek.field("m_iCampBKill").value;
              updateAndSendBattleData();
            } catch (e) {}
          }, 500);
        },
      });
    }

    const set_m_Gold = PlayerData.tryMethod("set_m_Gold");
    if (set_m_Gold) {
      Interceptor.attach(set_m_Gold.virtualAddress, {
        onLeave: function (retval) {
          if (!isHookActive || !Objek) return;
          try {
            battleData.blueTeamGold = Objek.field("m_CampAGold").value;
            battleData.redTeamGold = Objek.field("m_CampBGold").value;
          } catch (e) {}
        },
      });
    }

    if (ReportCampBossKillTimes) {
      Interceptor.attach(ReportCampBossKillTimes.virtualAddress, {
        onLeave: function (retval) {
          if (!isHookActive || !Objek) return;
          setTimeout(() => {
            try {
              battleData.blueTeamKillLord =
                Objek.field("m_CampAKillLingZhu").value;
              battleData.redTeamKillLord =
                Objek.field("m_CampBKillLingZhu").value;
              battleData.blueTeamKillTurtle =
                Objek.field("m_CampAKillShenGui").value;
              battleData.redTeamKillTurtle =
                Objek.field("m_CampBKillShenGui").value;
              updateAndSendBattleData();
            } catch (e) {}
          }, 500);
        },
      });
    }

    if (CountTowerKillTimes) {
      Interceptor.attach(CountTowerKillTimes.virtualAddress, {
        onLeave: function (retval) {
          if (!isHookActive || !Objek) return;
          setTimeout(() => {
            try {
              battleData.blueTeamDestroyTuret =
                Objek.field("m_CampAKillTower").value;
              battleData.redTeamDestroyTuret =
                Objek.field("m_CampBKillTower").value;
              updateAndSendBattleData();
            } catch (e) {}
          }, 500);
        },
      });
    }

    if (GetElapsedTimeSinceBattleStart) {
      Interceptor.attach(GetElapsedTimeSinceBattleStart.virtualAddress, {
        onLeave: function (retval) {
          if (!isHookActive) return;
          try {
            const waktu = retval.toInt32();
            battleData.waktuPertandingan = waktu;

            if (waktu - lastWaktuKirim >= 1000 || waktu < lastWaktuKirim) {
              lastWaktuKirim = waktu;
              updateAndSendBattleData();
            }
          } catch (e) {}
        },
      });
    }

    // SetBattleState tetap menggunakan implementation karena jarang dipanggil & kita butuh argumen object enum-nya
    SetBattleState.implementation = function (value) {
      this.method("set_m_eState").invoke(value);

      try {
        const stateStr = value.toString();
        debugLog("Battle", `[State Changed] BattleState bernilai: ${stateStr}`);
        battleData.battleState = stateStr;

        if (stateStr === eBState_Play) {
          aktifkanFitur();
        } else {
          nonaktifkanFitur();
        }

        updateAndSendBattleData();
      } catch (e) {
        debugLog("Battle", `Error in SetBattleState hook: ${e.message}`);
      }
    };
  } catch (err) {
    debugLog("Battle", `Failed setting up Battle hooks: ${err.message}`);
  }
}
