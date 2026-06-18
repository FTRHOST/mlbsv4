/**
 * MLBB ALL-IN-ONE JSON SCRAPER (DRAFT + MATCH DATA + HYBRID TIMER + CLASSIC SUPPORT)
 */

import "frida-il2cpp-bridge";

const TARGET_LIB = "liblogic.so"

console.log("[*] Menunggu library liblogic.so termuat...");
function main() {
  console.log("[*] Waiting for EGL Rendering to be ready...");

  // Deteksi EGL Ready (eglSwapBuffers)
  let eglSwapBuffers = null;
  const libEGL = Process.findModuleByName("libEGL.so") || Process.findModuleByName("libGLESv2.so");

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
        if (frameCount >= 2) { // Tunggu 2 frame rendering stabil
          eglHook.detach();
          console.log("[+] EGL Rendering is READY.");
          waitForLogicLib();
        }
      }
    });
  } else {
    setTimeout(main, 50);
  }
}

function waitForLogicLib() {
  console.log(`[*] Monitoring for ${TARGET_LIB}...`);

  const mod = Process.findModuleByName(TARGET_LIB);
  if (mod) {
    setupIl2CppHook(mod);
  } else {
    let dlopen = null;
    try {
      dlopen = Module.findExportByName(null, "android_dlopen_ext") ||
        Module.findExportByName(null, "dlopen");
    } catch (e) {
      const libc = Process.findModuleByName("libc.so");
      if (libc) {
        try {
          dlopen = libc.getExportByName("android_dlopen_ext") || libc.getExportByName("dlopen");
        } catch (e2) {
          dlopen = null;
        }
      }
    }

    if (dlopen) {
      const monitor = Interceptor.attach(dlopen, {
        onEnter: function (args) { this.path = args[0].readUtf8String(); },
        onLeave: function (retval) {
          if (this.path && this.path.indexOf(TARGET_LIB) !== -1) {
            monitor.detach();
            const targetMod = Process.getModuleByName(TARGET_LIB);
            setupIl2CppHook(targetMod);
          }
        }
      });
    } else {
      console.log("[!] Error: Could not find dlopen to monitor.");
      setTimeout(waitForLogicLib);
    }
  }
}

function setupIl2CppHook(targetMod) {
  const il2cpp_init = targetMod.findExportByName ? targetMod.findExportByName("il2cpp_init") : targetMod.getExportByName("il2cpp_init");
  if (il2cpp_init) {
    const il2cpp_domain_get = targetMod.findExportByName ? targetMod.findExportByName("il2cpp_domain_get") : targetMod.getExportByName("il2cpp_domain_get");
    let isInitialized = false;
    if (il2cpp_domain_get) {
      const get_domain = new NativeFunction(il2cpp_domain_get, 'pointer', []);
      if (!get_domain().isNull()) {
        isInitialized = true;
      }
    }

    if (isInitialized) {
      console.log(`[+] ${targetMod.name} is ALREADY initialized. Executing hooks now...`);
      setTimeout(() => executeSimpleHooks(targetMod));
    } else {
      Interceptor.attach(il2cpp_init, {
        onLeave: function (retval) {
          console.log(`[+] ${targetMod.name} (il2cpp_init) finished. Executing hooks...`);
          executeSimpleHooks(targetMod);
        }
      });
    }
  } else {
    console.log(`[!] Error: il2cpp_init not found in ${targetMod.name}`);
  }
}

// ====================================================================
// SECTION 4: IL2CPP REFLECTION HOOK ENGINE
// ====================================================================
function executeSimpleHooks() {
  Il2Cpp.$config.moduleName = "liblogic.so";
  const Assembly = Il2Cpp.domain.assembly("Assembly-CSharp").image;

  // Class Init
  const ChooseHeroMgr = Assembly.class("ChooseHeroMgr");
  const SystemData = Assembly.class("SystemData");
  const RoomData = Assembly.class("SystemData/RoomData");
  const CompetitionData = Assembly.class("CompetitionData");
  const MapTypeData = Assembly.class("Battle.MapTypeData");

  // Hook
  const BActFreeSkin = ChooseHeroMgr.method("BActFreeSkin");
  Interceptor.attach(BActFreeSkin.virtualAddress, {
    onLeave: function (retval) {
      retval.replace(ptr(1));
    }
  });

  const CanRepotCompetitonData = MapTypeData.method("CanRepotCompetitonData");
  Interceptor.attach(CanRepotCompetitonData.virtualAddress, {
    onLeave: function (retval) {
      retval.replace(ptr(1));
    }
  });

  let lastMapDraw = 0;
  const LogicBattleManager = Assembly.tryClass("LogicBattleManager");
  if (LogicBattleManager && !LogicBattleManager.handle.isNull()) {
    const get_m_iNext2025Feature = LogicBattleManager.tryMethod("get_m_iNext2025Feature");
    if (get_m_iNext2025Feature) {
      Interceptor.attach(get_m_iNext2025Feature.virtualAddress, {
        onLeave: function (retval) {
          try {
            const val = retval.toInt32();
            console.log(`[Next2025] get_m_iNext2025Feature returned: ${val}`);
            lastMapDraw = val;
          } catch (err) {
            console.log(`[Next2025] Error reading get_m_iNext2025Feature: ${err.message}`);
          }
        }
      });
    }
  }

  // Local Cache untuk menyimpan status player agar tidak terhapus di Firestore saat key absen
  const playersCache = new Map();

  // Helper function untuk mengambil data terbaru dari memory & melakukan merging dengan cache
  function getMergedPlayers(activeUid, updateFn) {
    const instances = Il2Cpp.gc.choose(RoomData);
    const slotsMap = new Map();

    instances.forEach((roomObject) => {
      try {
        const iPosVal = roomObject.field("iPos").value;
        const iPos = iPosVal ? Number(iPosVal.toString()) : 0;

        // Filter: Hanya pos 1 sampai 10 yang aktif di dalam Room Draft
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

        // Ambil data cache lama atau inisialisasi default
        let cached = playersCache.get(uid);
        if (!cached) {
          cached = {
            pickPhase: false,
            banPhase: false,
            SelHeroID: 0,
            banHero: 0
          };
        }

        // Terapkan update jika ada fungsi updateFn khusus untuk hook ini
        if (updateFn) {
          updateFn(uid, cached);
        }

        // Dapatkan string nama yang bersih tanpa tanda kutip ganda pembungkus
        const nameStr = Name ? (Name.content || "") : "";

        // Verifikasi Team secara ketat berdasarkan iPos
        let verifiedTeam = 0;
        if (iPos >= 1 && iPos <= 5) {
          verifiedTeam = 1; // Team 1 (Blue Team)
        } else if (iPos >= 6 && iPos <= 10) {
          verifiedTeam = 2; // Team 2 (Red Team)
        } else {
          return; // Skip jika iPos diluar range 1-10 (aman karena sudah di-filter di atas)
        }

        // Verifikasi kesesuaian antara iPos dan Team (iCamp) di memory GC
        const actualTeam = Team ? Number(Team.toString()) : 0;
        if (actualTeam !== verifiedTeam) {
          return; // Skip jika data tidak valid (misal iPos = 2 tetapi Team = 2)
        }

        // Parse Emblem & Skills Dictionary
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
                id: value ? Number(value.toString()) : 0
              });
            }
          } catch (err) {
            console.log(`[getMergedPlayers] Gagal membaca emblemSkil: ${err.message}`);
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
          banHero: cached.banHero
        };

        // Simpan kembali ke cache
        playersCache.set(uid, cached);

        // Simpan playerObj ke dalam slot posisinya untuk menghilangkan duplikasi
        slotsMap.set(iPos, playerObj);
      } catch (err) {
        console.log(`[getMergedPlayers] Gagal mengambil field: ${err.message}`);
      }
    });

    return Array.from(slotsMap.values());
  }


  const ReportPlayerInfoEx = CompetitionData.method("ReportPlayerInfoEx");
  Interceptor.attach(ReportPlayerInfoEx.virtualAddress, {
    onLeave: function (args) {
      try {
        const OpID = SystemData.field("m_uiID").value;
        console.log(`ID dari akun operator adalah ${OpID}`);

        // Reset cache room karena kita membaca room info baru
        playersCache.clear();

        const players = getMergedPlayers(null, null);

        // Kirim data ke host script (run.js)
        send({
          type: "ROOM_DATA",
          payload: {
            operatorId: OpID ? OpID.toString() : "",
            players: players,
            draftPhase: 0,
            draftTime: 0,
            caption: "",
            mapDraw: lastMapDraw,
            timestamp: new Date().toISOString()
          }
        });

      } catch (e) {
        console.log(`[!] Error di ReportPlayerInfoEx hook: ${e.message}`);
      }
    }
  });

  const ReportPickHeroStart = CompetitionData.method("ReportPickHeroStart");
  Interceptor.attach(ReportPickHeroStart.virtualAddress, {
    onEnter: function (args) {
      try {
        const playerDataPtr = args[1];
        const pickTimeSpan = args[2].toInt32();

        // Wrap pointer RoomData ke objek IL2CPP
        const playerDataObj = new Il2Cpp.Object(playerDataPtr);
        const activeUid = playerDataObj.field("lUid").value.toString();
        console.log(`[ReportPickHeroStart] Hook terpanggil. Active Player UID: ${activeUid}, pickTimeSpan: ${pickTimeSpan}`);

        const OpID = SystemData.field("m_uiID").value;
        const players = getMergedPlayers(activeUid, (uid, cached) => {
          if (uid === activeUid) {
            cached.pickPhase = true;
          }
        });

        const activePlayer = players.find(p => p.id === activeUid);
        const activeTeam = activePlayer ? activePlayer.team : 0;

        // Logika caption dinamis untuk simultaneous pick
        const isBluePicking = players.some(p => p.team === 1 && p.pickPhase);
        const isRedPicking = players.some(p => p.team === 2 && p.pickPhase);
        let caption = "";
        if (isBluePicking && isRedPicking) {
          caption = "Both Teams Pick";
        } else if (isBluePicking) {
          caption = "Blue Team Pick";
        } else if (isRedPicking) {
          caption = "Red Team Pick";
        }

        // Kirim data ter-update ke host script (host.js)
        send({
          type: "ROOM_DATA",
          payload: {
            operatorId: OpID ? OpID.toString() : "",
            players: players,
            draftPhase: activeTeam,
            draftTime: pickTimeSpan,
            caption: caption,
            mapDraw: lastMapDraw,
            timestamp: new Date().toISOString()
          }
        });

      } catch (e) {
        console.log(`[!] Error di ReportPickHeroStart hook: ${e.message}`);
      }
    }
  });

  const ReportPickHero = CompetitionData.method("ReportPickHero");
  Interceptor.attach(ReportPickHero.virtualAddress, {
    onEnter: function (args) {
      try {
        const playerDataPtr = args[1];
        const pickHeroID = args[2].toInt32();

        // Wrap pointer RoomData ke objek IL2CPP
        const playerDataObj = new Il2Cpp.Object(playerDataPtr);
        const activeUid = playerDataObj.field("lUid").value.toString();
        console.log(`[ReportPickHero] Hook terpanggil. Active Player UID: ${activeUid}, pickHeroID: ${pickHeroID}`);

        const OpID = SystemData.field("m_uiID").value;
        const players = getMergedPlayers(activeUid, (uid, cached) => {
          if (uid === activeUid) {
            cached.pickPhase = false; // Set false karena sudah pick hero
            cached.SelHeroID = pickHeroID;
          }
        });

        const activePlayer = players.find(p => p.id === activeUid);
        const activeTeam = activePlayer ? activePlayer.team : 0;

        // Logika caption dinamis untuk simultaneous pick
        const isBluePicking = players.some(p => p.team === 1 && p.pickPhase);
        const isRedPicking = players.some(p => p.team === 2 && p.pickPhase);
        let caption = "";
        if (isBluePicking && isRedPicking) {
          caption = "Both Teams Pick";
        } else if (isBluePicking) {
          caption = "Blue Team Pick";
        } else if (isRedPicking) {
          caption = "Red Team Pick";
        }

        // Kirim data ter-update ke host script (host.js)
        send({
          type: "ROOM_DATA",
          payload: {
            operatorId: OpID ? OpID.toString() : "",
            players: players,
            draftPhase: activeTeam,
            draftTime: 0,
            caption: caption,
            mapDraw: lastMapDraw,
            timestamp: new Date().toISOString()
          }
        });

      } catch (e) {
        console.log(`[!] Error di ReportPickHero hook: ${e.message}`);
      }
    }
  });

  const ReportBanStart = CompetitionData.method("ReportBanStart");
  Interceptor.attach(ReportBanStart.virtualAddress, {
    onEnter: function (args) {
      try {
        const playerDataPtr = args[1];
        const banTimeSpan = args[2].toInt32();

        // Wrap pointer RoomData ke objek IL2CPP
        const playerDataObj = new Il2Cpp.Object(playerDataPtr);
        const activeUid = playerDataObj.field("lUid").value.toString();
        console.log(`[ReportBanStart] Hook terpanggil. Active Player UID: ${activeUid}, banTimeSpan: ${banTimeSpan}`);

        const OpID = SystemData.field("m_uiID").value;
        const players = getMergedPlayers(activeUid, (uid, cached) => {
          if (uid === activeUid) {
            cached.banPhase = true;
          }
        });

        const activePlayer = players.find(p => p.id === activeUid);
        const activeTeam = activePlayer ? activePlayer.team : 0;

        // Logika caption dinamis untuk simultaneous ban
        const isBlueBanning = players.some(p => p.team === 1 && p.banPhase);
        const isRedBanning = players.some(p => p.team === 2 && p.banPhase);
        let caption = "";
        if (isBlueBanning && isRedBanning) {
          caption = "Both Teams Ban";
        } else if (isBlueBanning) {
          caption = "Blue Team Ban";
        } else if (isRedBanning) {
          caption = "Red Team Ban";
        }

        // Kirim data ter-update ke host script (host.js)
        send({
          type: "ROOM_DATA",
          payload: {
            operatorId: OpID ? OpID.toString() : "",
            players: players,
            draftPhase: activeTeam,
            draftTime: banTimeSpan,
            caption: caption,
            mapDraw: lastMapDraw,
            timestamp: new Date().toISOString()
          }
        });

      } catch (e) {
        console.log(`[!] Error di ReportBanStart hook: ${e.message}`);
      }
    }
  });

  const ReportBanHero = CompetitionData.method("ReportBanHero");
  Interceptor.attach(ReportBanHero.virtualAddress, {
    onEnter: function (args) {
      try {
        const playerDataPtr = args[1];
        const banHeroID = args[2].toInt32();

        // Wrap pointer RoomData ke objek IL2CPP
        const playerDataObj = new Il2Cpp.Object(playerDataPtr);
        const activeUid = playerDataObj.field("lUid").value.toString();
        console.log(`[ReportBanHero] Hook terpanggil. Active Player UID: ${activeUid}, banHeroID: ${banHeroID}`);

        const OpID = SystemData.field("m_uiID").value;
        const players = getMergedPlayers(activeUid, (uid, cached) => {
          if (uid === activeUid) {
            cached.banPhase = false; // Set false karena sudah ban hero
            cached.banHero = banHeroID;
          }
        });

        const activePlayer = players.find(p => p.id === activeUid);
        const activeTeam = activePlayer ? activePlayer.team : 0;

        // Logika caption dinamis untuk simultaneous ban
        const isBlueBanning = players.some(p => p.team === 1 && p.banPhase);
        const isRedBanning = players.some(p => p.team === 2 && p.banPhase);
        let caption = "";
        if (isBlueBanning && isRedBanning) {
          caption = "Both Teams Ban";
        } else if (isBlueBanning) {
          caption = "Blue Team Ban";
        } else if (isRedBanning) {
          caption = "Red Team Ban";
        }

        // Kirim data ter-update ke host script (host.js)
        send({
          type: "ROOM_DATA",
          payload: {
            operatorId: OpID ? OpID.toString() : "",
            players: players,
            draftPhase: activeTeam,
            draftTime: 0,
            caption: caption,
            mapDraw: lastMapDraw,
            timestamp: new Date().toISOString()
          }
        });

      } catch (e) {
        console.log(`[!] Error di ReportBanHero hook: ${e.message}`);
      }
    }
  });

  const GetBattlePlayerInfo = SystemData.method("GetBattlePlayerInfo");
  Interceptor.attach(GetBattlePlayerInfo.virtualAddress, {
    onEnter: function (args) {
      console.log("test terpanggil")





    }
  });

  const ANext2025Config = Assembly.class("ANext2025Config");






  const instances = Il2Cpp.gc.choose(ANext2025Config);

  instances.forEach((roomObject) => {
    const Name = roomObject.field("m_iMapId").value;

    console.log(`Ini adalah nama: ${Name}`)
  });









}

setImmediate(main);



