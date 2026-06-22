/**
 * MLBB ALL-IN-ONE JSON SCRAPER (DRAFT + MATCH DATA + HYBRID TIMER + CLASSIC SUPPORT)
 */

import "frida-il2cpp-bridge";

const TARGET_LIB = "liblogic.so"

// Using native C# (IL2CPP) HTTP requests for user verification, no Java initialization needed.

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
  let cachedOperatorId = "";
  let isUserAuthChecked = false;
  const Assembly = Il2Cpp.domain.assembly("Assembly-CSharp").image;

  // Class Init
  const ChooseHeroMgr = Assembly.class("ChooseHeroMgr");
  const SystemData = Assembly.class("SystemData");
  const RoomData = Assembly.class("SystemData/RoomData");
  const CompetitionData = Assembly.class("CompetitionData");
  const MapTypeData = Assembly.class("Battle.MapTypeData");
  const UIRankHero = Assembly.class("UIRankHero");

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
            // console.log(`[Next2025] get_m_iNext2025Feature returned: ${val}`);
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




  function getIndonesianDateTime() {
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const d = new Date();
    
    // Indonesian Timezone (WIB is UTC+7)
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const wibDate = new Date(utc + (3600000 * 7));
    
    const day = wibDate.getDate();
    const month = months[wibDate.getMonth()];
    const year = wibDate.getFullYear();
    const hours = String(wibDate.getHours()).padStart(2, '0');
    const minutes = String(wibDate.getMinutes()).padStart(2, '0');
    const seconds = String(wibDate.getSeconds()).padStart(2, '0');
    
    return `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`;
  }

  function blockApp() {
    console.log("[User Auth] Blocking app...");
    try {
      const exitPtr = Module.findExportByName(null, "exit");
      if (exitPtr) {
        const exitFn = new NativeFunction(exitPtr, "void", ["int"]);
        exitFn(0);
      }
    } catch (e) {
      // Fallback
    }
    throw new Error("ACCESS_DENIED");
  }

  function verifyAndRegisterUser(opIdStr) {
    try {
      const registerUserPtr = Module.findExportByName("libmypatch.so", "register_user_native");
      if (registerUserPtr) {
        console.log(`[User Auth] Found register_user_native in libmypatch.so. Attempting native JNI registration...`);
        const registerUser = new NativeFunction(registerUserPtr, "void", ["pointer"]);
        const uidPtr = Memory.allocUtf8String(opIdStr);
        registerUser(uidPtr);
        console.log(`[User Auth] Native JNI registration function triggered successfully for operator ID: ${opIdStr}`);
        return;
      }
    } catch (e) {
      console.log(`[User Auth] Gagal memicu registrasi native: ${e.message}`);
    }

    if (typeof Java === "undefined" || !Java.available) {
      console.log("[User Auth] Java is not available yet. Skipping registration fallback.");
      return;
    }
    Java.perform(() => {
      try {
        const Thread = Java.use("java.lang.Thread");
        const MyRunnable = Java.registerClass({
          name: "com.mobilelegends.AuthRunnable",
          implements: [Java.use("java.lang.Runnable")],
          methods: {
            run: function () {
              try {
                const URL = Java.use("java.net.URL");
                const HttpURLConnection = Java.use("java.net.HttpURLConnection");
                const BufferedReader = Java.use("java.io.BufferedReader");
                const InputStreamReader = Java.use("java.io.InputStreamReader");
                const StringBuilder = Java.use("java.lang.StringBuilder");
                const DataOutputStream = Java.use("java.io.DataOutputStream");

                const apiUrl = "https://mlbsv4.vercel.app/api/users";
                const urlObj = URL.$new(apiUrl);
                const conn = Java.cast(urlObj.openConnection(), HttpURLConnection);
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("x-api-key", "mlbs_secret_token_2026");
                conn.setConnectTimeout(10000); // 10s timeout to bypass Vercel cold starts
                conn.setReadTimeout(10000);
                conn.setDoOutput(true);

                const currentIndoTime = getIndonesianDateTime();
                const jsonBody = JSON.stringify({
                  uid: opIdStr,
                  last_login: currentIndoTime
                });

                const os = conn.getOutputStream();
                const writer = DataOutputStream.$new(os);
                writer.writeBytes(jsonBody);
                writer.flush();
                writer.close();

                const responseCode = conn.getResponseCode();
                console.log(`[User Auth] API Response Code: ${responseCode}`);

                if (responseCode === 200) {
                  const stream = conn.getInputStream();
                  const reader = BufferedReader.$new(InputStreamReader.$new(stream, "UTF-8"));
                  const sb = StringBuilder.$new();
                  let line = null;
                  while ((line = reader.readLine()) !== null) {
                    sb.append(line);
                  }
                  reader.close();
                  
                  const responseJson = sb.toString();
                  console.log(`[User Auth] Response: ${responseJson}`);
                  
                  const res = JSON.parse(responseJson);
                  if (res && res.data) {
                    const user = res.data;
                    console.log(`[User Auth] User info: is_allowed=${user.is_allowed}, expired=${user.expired}, role=${user.role}`);
                    if (!user.is_allowed) {
                      console.log("[User Auth] ACCESS DENIED! Blocking app...");
                      blockApp();
                    }
                    if (user.expired !== "NEVER") {
                      const expiryDate = new Date(user.expired);
                      if (expiryDate < new Date()) {
                        console.log("[User Auth] ACCESS EXPIRED! Blocking app...");
                        blockApp();
                      }
                    }
                  }
                } else {
                  console.log(`[User Auth] Server or connection error: Code ${responseCode}`);
                }
                conn.disconnect();
              } catch (err) {
                console.log(`[User Auth] Error during API verification thread: ${err.message}`);
                if (err.message.indexOf("ACCESS_DENIED") !== -1 || err.message.indexOf("ACCESS_EXPIRED") !== -1) {
                  blockApp();
                }
              }
            }
          }
        });

        const runnable = MyRunnable.$new();
        const authThread = Thread.$new(runnable);
        authThread.start();
      } catch (err) {
        console.log(`[User Auth] Error setting up verification thread: ${err.message}`);
      }
    });
  }

  function getOperatorId() {
    if (cachedOperatorId) return cachedOperatorId;
    try {
      const OpID = SystemData.field("m_uiID").value;
      const opIdStr = OpID ? OpID.toString() : "";
      if (opIdStr && opIdStr !== "0" && opIdStr !== "undefined") {
        cachedOperatorId = opIdStr;
        return opIdStr;
      }
    } catch (e) {
      // Ignore
    }
    return "";
  }

  function startPollingForMUiID() {
    if (isUserAuthChecked) return;
    
    console.log("[User Auth] JS background timer started for polling.");
    const authPollInterval = setInterval(() => {
      try {
        const opIdStr = getOperatorId();
        if (opIdStr && opIdStr !== "0" && opIdStr !== "undefined") {
          clearInterval(authPollInterval);
          if (!isUserAuthChecked) {
            isUserAuthChecked = true;
            console.log(`[User Auth] Poll found m_uiID: ${opIdStr}`);
            verifyAndRegisterUser(opIdStr);
          }
        }
      } catch (e) {
        // Ignore
      }
    }, 250);
  }

  // Monitor class loading via static constructor (.cctor)
  try {
    const cctor = SystemData.method(".cctor");
    Interceptor.attach(cctor.virtualAddress, {
      onLeave: function (retval) {
        console.log("[User Auth] SystemData .cctor completed. Starting user verification...");
        startPollingForMUiID();
      }
    });
  } catch (err) {
    console.log(`[User Auth] Gagal memasang hook .cctor: ${err.message}`);
  }

  // Fallback: Start polling immediately in case class was already loaded (late attach)
  startPollingForMUiID();

  const ReportPlayerInfoEx = CompetitionData.method("ReportPlayerInfoEx");
  Interceptor.attach(ReportPlayerInfoEx.virtualAddress, {
    onLeave: function (args) {
      try {
        const opIdStr = getOperatorId();
        console.log(`ID dari akun operator adalah ${opIdStr}`);

        // Reset cache room karena kita membaca room info baru
        playersCache.clear();

        const players = getMergedPlayers(null, null);

        // Kirim data ke host script (run.js)
        send({
          type: "ROOM_DATA",
          payload: {
            operatorId: opIdStr,
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

        // Wrap pointer RoomData ke objek IL2CPP
        const playerDataObj = new Il2Cpp.Object(playerDataPtr);
        const activeUid = playerDataObj.field("lUid").value.toString();
        console.log(`[ReportPickHeroStart] Hook terpanggil. Active Player UID: ${activeUid}`);

        const opIdStr = getOperatorId();
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
            operatorId: opIdStr,
            players: players,
            draftPhase: activeTeam,
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

        const opIdStr = getOperatorId();
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
            operatorId: opIdStr,
            players: players,
            draftPhase: activeTeam,
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

        const opIdStr = getOperatorId();
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
            operatorId: opIdStr,
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

        const opIdStr = getOperatorId();
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
            operatorId: opIdStr,
            players: players,
            draftPhase: activeTeam,
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

  const ReceStartChange = UIRankHero.method("ReceStartChange");
  Interceptor.attach(ReceStartChange.virtualAddress, {
    onEnter: function (args) {
      try {

        // Wrap pointer RoomData ke objek IL2CPP

        const opIdStr = getOperatorId();

        const players = getMergedPlayers(null, null)



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



        // console.log(`[ReceStartChange] Hook terpanggl iChangeHeroTimeSpan: ${iChangeHeroTimeSpan}`);


        // Kirim data ter-update ke host script (host.js)
        send({
          type: "ROOM_DATA",
          payload: {
            operatorId: opIdStr,
            draftPhase: phase,
            players: players,
            draftTime: iChangeHeroTimeSpan,
            caption: caption,
            mapDraw: lastMapDraw,
            timestamp: new Date().toISOString()
          }
        });

      } catch (e) {
        console.log(`[!] Error di ReceStartChange hook: ${e.message}`);
      }
    }
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
    }
  });

  const ANext2025Config = Assembly.class("ANext2025Config");
















}

setImmediate(main);



