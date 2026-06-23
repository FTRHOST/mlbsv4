/**
 * MLBB ALL-IN-ONE JSON SCRAPER (DRAFT + MATCH DATA + HYBRID TIMER + CLASSIC SUPPORT)
 */

import "frida-il2cpp-bridge";

const TARGET_LIB = "liblogic.so";

// Using native C# (IL2CPP) HTTP requests for user verification, no Java initialization needed.

console.log("[*] Menunggu library liblogic.so termuat...");
function main() {
  console.log("[*] Waiting for EGL Rendering to be ready...");

  // Deteksi EGL Ready (eglSwapBuffers)
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
          // Tunggu 2 frame rendering stabil
          eglHook.detach();
          console.log("[+] EGL Rendering is READY.");
          waitForLogicLib();
        }
      },
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
      console.log("[!] Error: Could not find dlopen to monitor.");
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
      console.log(
        `[+] ${targetMod.name} is ALREADY initialized. Executing hooks now...`,
      );
      setTimeout(() => executeSimpleHooks(targetMod));
    } else {
      Interceptor.attach(il2cpp_init, {
        onLeave: function (retval) {
          console.log(
            `[+] ${targetMod.name} (il2cpp_init) finished. Executing hooks...`,
          );
          executeSimpleHooks(targetMod);
        },
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
  let cachedOperatorId = "";
  let isUserAuthChecked = false;
  let isAuthorized = false; // Licensing guard, defaults to false
  const Assembly = Il2Cpp.domain.assembly("Assembly-CSharp").image;

  // Class Init
  const ChooseHeroMgr = Assembly.class("ChooseHeroMgr");
  const SystemData = Assembly.class("SystemData");
  const RoomData = Assembly.class("SystemData/RoomData");
  const CompetitionData = Assembly.class("CompetitionData");
  const MapTypeData = Assembly.class("Battle.MapTypeData");
  const UIRankHero = Assembly.class("UIRankHero");
  const GameInit = Assembly.class("GameInit");

  // Hook
  const BActFreeSkin = ChooseHeroMgr.method("BActFreeSkin");
  Interceptor.attach(BActFreeSkin.virtualAddress, {
    onLeave: function (retval) {
      if (isAuthorized) {
        retval.replace(ptr(1));
      }
    },
  });

  const CanRepotCompetitonData = MapTypeData.method("CanRepotCompetitonData");
  Interceptor.attach(CanRepotCompetitonData.virtualAddress, {
    onLeave: function (retval) {
      if (isAuthorized) {
        retval.replace(ptr(1));
      }
    },
  });

  const IsSandBoxIp = GameInit.method("IsSandBoxIp");
  Interceptor.attach(IsSandBoxIp.virtualAddress, {
    onLeave: function (retval) {
      if (isAuthorized) {
        retval.replace(ptr(1));
        console.log("GM Mode aktif test up");
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
            // console.log(`[Next2025] get_m_iNext2025Feature returned: ${val}`);
            lastMapDraw = val;
          } catch (err) {
            console.log(
              `[Next2025] Error reading get_m_iNext2025Feature: ${err.message}`,
            );
          }
        },
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
            banHero: 0,
          };
        }

        // Terapkan update jika ada fungsi updateFn khusus untuk hook ini
        if (updateFn) {
          updateFn(uid, cached);
        }

        // Dapatkan string nama yang bersih tanpa tanda kutip ganda pembungkus
        const nameStr = Name ? Name.content || "" : "";

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
                id: value ? Number(value.toString()) : 0,
              });
            }
          } catch (err) {
            console.log(
              `[getMergedPlayers] Gagal membaca emblemSkil: ${err.message}`,
            );
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

  function getIndonesianDateTime() {
    const months = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    const d = new Date();

    // Indonesian Timezone (WIB is UTC+7)
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    const wibDate = new Date(utc + 3600000 * 7);

    const day = wibDate.getDate();
    const month = months[wibDate.getMonth()];
    const year = wibDate.getFullYear();
    const hours = String(wibDate.getHours()).padStart(2, "0");
    const minutes = String(wibDate.getMinutes()).padStart(2, "0");
    const seconds = String(wibDate.getSeconds()).padStart(2, "0");

    return `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`;
  }

  function sendToRestApi(payload) {
    if (typeof Java === "undefined" || !Java.available) {
      console.log("[REST API] Java not available");
      return;
    }
    Java.perform(() => {
      try {
        const Thread = Java.use("java.lang.Thread");
        const dynamicClassName =
          "com.mobilelegends.ApiRunnable_" +
          Math.floor(Math.random() * 1000000);
        const ApiRunnable = Java.registerClass({
          name: dynamicClassName,
          implements: [Java.use("java.lang.Runnable")],
          methods: {
            run: function () {
              try {
                const URL = Java.use("java.net.URL");
                const HttpURLConnection = Java.use(
                  "java.net.HttpURLConnection",
                );
                const DataOutputStream = Java.use("java.io.DataOutputStream");

                const apiUrl = "https://mlbsv4.vercel.app/api/rooms";
                const urlObj = URL.$new(apiUrl);
                const conn = Java.cast(
                  urlObj.openConnection(),
                  HttpURLConnection,
                );
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("x-api-key", "mlbs_secret_token_2026");
                conn.setRequestProperty(
                  "User-Agent",
                  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
                );
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                conn.setDoOutput(true);

                const jsonBody = JSON.stringify(payload);

                const os = conn.getOutputStream();
                const writer = DataOutputStream.$new(os);
                writer.writeBytes(jsonBody);
                writer.flush();
                writer.close();

                const responseCode = conn.getResponseCode();
                console.log(
                  `[REST API] Data sent to Vercel. Response Code: ${responseCode}`,
                );
                conn.disconnect();
              } catch (err) {
                console.log(`[REST API] Error: ${err.message}`);
              }
            },
          },
        });
        const runnable = ApiRunnable.$new();
        const apiThread = Thread.$new(runnable);
        apiThread.start();
      } catch (err) {
        console.log(`[REST API] Thread start error: ${err.message}`);
      }
    });
  }

  function verifyUserWithRestApi(uid) {
    console.log(`[REST API User] Verifying operator ID ${uid} using native call...`);
    try {
      let register_user_native_ptr = null;
      
      // Systematically search loaded modules for our patch library exports
      const modules = Process.enumerateModules();
      for (let i = 0; i < modules.length; i++) {
        const mod = modules[i];
        if (mod.name.indexOf("mypatch") !== -1) {
          try {
            const exp = mod.findExportByName("register_user_native");
            if (exp && !exp.isNull()) {
              register_user_native_ptr = exp;
              console.log(`[REST API User] Found export register_user_native in module ${mod.name} at ${exp}`);
              break;
            }
          } catch (e) {
            // Ignore
          }
        }
      }

      if (!register_user_native_ptr) {
        const exp = Module.findExportByName(null, "register_user_native");
        if (exp && !exp.isNull()) {
          register_user_native_ptr = exp;
        }
      }

      if (register_user_native_ptr && !register_user_native_ptr.isNull()) {
        const registerUser = new NativeFunction(register_user_native_ptr, 'pointer', ['pointer']);
        const uidPtr = Memory.allocUtf8String(uid);
        const resPtr = registerUser(uidPtr);
        if (resPtr && !resPtr.isNull()) {
          const responseJson = resPtr.readUtf8String();
          console.log(`[REST API User] User Data from Native: ${responseJson}`);
          if (responseJson) {
            try {
              const res = JSON.parse(responseJson);
              if (res && res.data) {
                const ban = res.data.ban;
                const is_allowed = res.data.is_allowed;
                if (ban === true || is_allowed === false) {
                  isAuthorized = false;
                  console.log(`[REST API User] ACCESS DENIED: User ${uid} is BANNED or NOT ALLOWED.`);
                } else {
                  isAuthorized = true;
                  console.log(`[REST API User] ACCESS GRANTED: User ${uid} verified successfully.`);
                }
              } else {
                isAuthorized = false;
                console.log(`[REST API User] ACCESS DENIED: Invalid user schema.`);
              }
            } catch (err) {
              isAuthorized = false;
              console.log(`[REST API User] ACCESS DENIED: Failed to parse user response.`);
            }
          } else {
            isAuthorized = false;
            console.log(`[REST API User] Empty user info response from Native.`);
          }
        } else {
          isAuthorized = false;
          console.log(`[REST API User] Null response from Native verification.`);
        }
      } else {
        console.log("[REST API User] Error: register_user_native export not found!");
      }
    } catch (err) {
      console.log(`[REST API User] Error in native verification: ${err.message}`);
    }
  }

  function sendRoomData(payload) {
    if (!isAuthorized) {
      console.log("[REST API User] Blocked sending room data (unauthorized user)");
      return;
    }
    send({
      type: "ROOM_DATA",
      payload: payload,
    });
    sendToRestApi(payload);
  }

  function getOperatorId() {
    if (cachedOperatorId) return cachedOperatorId;
    try {
      const OpID = SystemData.field("m_uiID").value;
      const opIdStr = OpID ? OpID.toString() : "";
      if (opIdStr && opIdStr !== "0" && opIdStr !== "undefined") {
        cachedOperatorId = opIdStr;
        
        // Trigger user verification with REST API asynchronously
        if (!isUserAuthChecked) {
          isUserAuthChecked = true;
          verifyUserWithRestApi(opIdStr);
        }
        
        return opIdStr;
      }
    } catch (e) {
      // Ignore
    }
    return "";
  }

  const ReportPlayerInfoEx = CompetitionData.method("ReportPlayerInfoEx");
  Interceptor.attach(ReportPlayerInfoEx.virtualAddress, {
    onLeave: function (args) {
      try {
        const opIdStr = getOperatorId();
        console.log(`ID dari akun operator adalah ${opIdStr}`);

        // Reset cache room karena kita membaca room info baru
        playersCache.clear();

        const players = getMergedPlayers(null, null);

        // Kirim data ke host script (run.js) dan REST API
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
        console.log(`[!] Error di ReportPlayerInfoEx hook: ${e.message}`);
      }
    },
  });

  const ReportPickHeroStart = CompetitionData.method("ReportPickHeroStart");
  Interceptor.attach(ReportPickHeroStart.virtualAddress, {
    onEnter: function (args) {
      try {
        const playerDataPtr = args[1];

        // Wrap pointer RoomData ke objek IL2CPP
        const playerDataObj = new Il2Cpp.Object(playerDataPtr);
        const activeUid = playerDataObj.field("lUid").value.toString();
        console.log(
          `[ReportPickHeroStart] Hook terpanggil. Active Player UID: ${activeUid}`,
        );

        const opIdStr = getOperatorId();
        const players = getMergedPlayers(activeUid, (uid, cached) => {
          if (uid === activeUid) {
            cached.pickPhase = true;
          }
        });

        const activePlayer = players.find((p) => p.id === activeUid);
        const activeTeam = activePlayer ? activePlayer.team : 0;

        // Logika caption dinamis untuk simultaneous pick
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

        // Kirim data ter-update ke host script dan REST API
        sendRoomData({
          operatorId: opIdStr,
          players: players,
          draftPhase: activeTeam,
          caption: caption,
          mapDraw: lastMapDraw,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.log(`[!] Error di ReportPickHeroStart hook: ${e.message}`);
      }
    },
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
        console.log(
          `[ReportPickHero] Hook terpanggil. Active Player UID: ${activeUid}, pickHeroID: ${pickHeroID}`,
        );

        const opIdStr = getOperatorId();
        const players = getMergedPlayers(activeUid, (uid, cached) => {
          if (uid === activeUid) {
            cached.pickPhase = false; // Set false karena sudah pick hero
            cached.SelHeroID = pickHeroID;
          }
        });

        const activePlayer = players.find((p) => p.id === activeUid);
        const activeTeam = activePlayer ? activePlayer.team : 0;

        // Logika caption dinamis untuk simultaneous pick
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

        // Kirim data ter-update ke host script dan REST API
        sendRoomData({
          operatorId: opIdStr,
          players: players,
          draftPhase: activeTeam,
          caption: caption,
          mapDraw: lastMapDraw,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.log(`[!] Error di ReportPickHero hook: ${e.message}`);
      }
    },
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
        console.log(
          `[ReportBanStart] Hook terpanggil. Active Player UID: ${activeUid}, banTimeSpan: ${banTimeSpan}`,
        );

        const opIdStr = getOperatorId();
        const players = getMergedPlayers(activeUid, (uid, cached) => {
          if (uid === activeUid) {
            cached.banPhase = true;
          }
        });

        const activePlayer = players.find((p) => p.id === activeUid);
        const activeTeam = activePlayer ? activePlayer.team : 0;

        // Logika caption dinamis untuk simultaneous ban
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

        // Kirim data ter-update ke host script dan REST API
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
        console.log(`[!] Error di ReportBanStart hook: ${e.message}`);
      }
    },
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
        console.log(
          `[ReportBanHero] Hook terpanggil. Active Player UID: ${activeUid}, banHeroID: ${banHeroID}`,
        );

        const opIdStr = getOperatorId();
        const players = getMergedPlayers(activeUid, (uid, cached) => {
          if (uid === activeUid) {
            cached.banPhase = false; // Set false karena sudah ban hero
            cached.banHero = banHeroID;
          }
        });

        const activePlayer = players.find((p) => p.id === activeUid);
        const activeTeam = activePlayer ? activePlayer.team : 0;

        // Logika caption dinamis untuk simultaneous ban
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

        // Kirim data ter-update ke host script dan REST API
        sendRoomData({
          operatorId: opIdStr,
          players: players,
          draftPhase: activeTeam,
          caption: caption,
          mapDraw: lastMapDraw,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.log(`[!] Error di ReportBanHero hook: ${e.message}`);
      }
    },
  });

  const ReceStartChange = UIRankHero.method("ReceStartChange");
  Interceptor.attach(ReceStartChange.virtualAddress, {
    onEnter: function (args) {
      try {
        // Wrap pointer RoomData ke objek IL2CPP

        const opIdStr = getOperatorId();

        const players = getMergedPlayers(null, null);

        // Logika caption dinamis untuk simultaneous pick
        let phase = 4;
        let caption = "Change";

        let iChangeHeroTimeSpan;

        const instances = Il2Cpp.gc.choose(UIRankHero);

        instances.forEach((uirankObject) => {
          const val = uirankObject.field("iChangeHeroTimeSpan").value;

          console.log(`Ini adalah iChangeHeroTimeSpan: ${val}`);
          iChangeHeroTimeSpan = val;
        });

        // Kirim data ter-update ke host script dan REST API
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
        console.log(`[!] Error di ReceStartChange hook: ${e.message}`);
      }
    },
  });

  const GetBattlePlayerInfo = SystemData.method("GetBattlePlayerInfo");
  Interceptor.attach(GetBattlePlayerInfo.virtualAddress, {
    onEnter: function (args) {
      try {
        const opIdStr = getOperatorId();
        console.log(`[GetBattlePlayerInfo] ID dari akun operator: ${opIdStr}`);
      } catch (e) {
        console.log(`[!] Error di GetBattlePlayerInfo hook: ${e.message}`);
      }
    },
  });

  // Startup user verification loop
  let authChecksCount = 0;
  function pollOperatorIdForVerification() {
    try {
      const opId = getOperatorId();
      if (opId) {
        console.log(`[REST API User] Operator ID found during startup poll: ${opId}`);
      } else {
        authChecksCount++;
        // Check every second for up to 60 seconds (1 minute after boot)
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
  // Start polling immediately after loading hooks
  pollOperatorIdForVerification();

  const ANext2025Config = Assembly.class("ANext2025Config");
}

setImmediate(main);
