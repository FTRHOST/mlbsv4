/**
 * Unreleased Content & Activity Filter Module
 */

import { CONFIG, sessionState } from "../tools/config";
import { debugLog } from "../tools/utils";
import { showGameNotification } from "../index";
import { getExternalFilesDir } from "../tools/cache";
import { GIT_BRANCH, GIT_HASH, LATEST_CLOUD_VERSION } from "../env";

/**
 * Membaca versi terupdate dari file lokal `mlver.json` di external user directory (/sdcard/Android/data/<package_name>/files/mlver.json).
 * Skema: { "override": boolean, "version": string, "realversion": string }
 * - override=false (default): terhubung ke Supabase, versi disinkronkan Native Patcher.
 * - override=true: manual oleh user; hook GameServerConfig.loadRealVersionCompelte AKTIF.
 * Kompatibilitas mundur: "mode": "override"/"supabase" (string lama) masih dibaca.
 */
export function ensureDirExists(dir) {
  if (!dir) return;
  try {
    if (typeof Directory !== "undefined" && Directory.CreateDirectory) {
      Directory.CreateDirectory(dir);
      return;
    }
  } catch (_) {}
  try {
    if (typeof Java !== "undefined" && Java.available) {
      Java.performNow(() => {
        const JFile = Java.use("java.io.File");
        JFile.$new(dir).mkdirs();
      });
    }
  } catch (_) {}
}

/**
 * Skema mlver.json (external user directory):
 * {
 *   "override": false,               // boolean — false = Supabase, true = manual override
 *   "version": "2.2.14.1230.1",      // dipakai untuk spoof sClientVersion + asset version
 *   "realversion": "2.2.14.1230.2"   // KHUSUS override=true — dipakai untuk spoof version="..." pada XML loadRealVersionCompelte
 * }
 * Kompatibilitas mundur: "mode" (string lama) dan sClientVersion / overrideVersion masih dibaca sebagai fallback.
 * Path package-aware mengikuti getExternalFilesDir() (tahan ganti package).
 * Jalur contoh: /sdcard/Android/data/<package_name>/files/mlver.json
 */
export function getMlverConfig() {
  const defaultVer = LATEST_CLOUD_VERSION || "2.2.14.1230.1";
  const defaults = {
    override: false,
    version: defaultVer,
    realversion: defaultVer,
  };
  try {
    const extDir = getExternalFilesDir();
    const mlverPath = `${extDir}/mlver.json`;

    let readErrMsg = null;
    try {
      const content = File.readAllText(mlverPath);
      if (content && content.trim().length > 0) {
        const json = JSON.parse(content.trim());
        if (json) {
          // Key utama: override boolean (fallback ke string "mode" lama)
          let override = false;
          if (typeof json.override === "boolean") {
            override = json.override;
          } else if (typeof json.override === "string") {
            override = json.override.toLowerCase() === "true";
          } else if (json.mode) {
            override = json.mode.toString().toLowerCase() === "override";
          }
          // Key utama: version (fallback ke sClientVersion / overrideVersion lama)
          const version = (
            json.version ||
            json.sClientVersion ||
            (override ? json.overrideVersion : null) ||
            ""
          )
            .toString()
            .trim();
          // Key khusus override untuk XML realversion.xml
          const realversion = (json.realversion || json.overrideVersion || "")
            .toString()
            .trim();
          return {
            override,
            version: version.length > 0 ? version : defaultVer,
            realversion: realversion.length > 0 ? realversion : defaultVer,
            path: mlverPath,
          };
        }
        readErrMsg = "empty-json";
      } else {
        readErrMsg = "empty-file";
      }
    } catch (readErr) {
      readErrMsg =
        readErr && readErr.message ? readErr.message : String(readErr);
    }

    // File hilang / kosong / invalid → buat default dan TIMPA (sesuai keputusan user)
    const initialData = JSON.stringify(
      {
        override: false,
        version: defaultVer,
        realversion: defaultVer,
      },
      null,
      2,
    );
    ensureDirExists(extDir);
    let writeErrMsg = null;
    try {
      File.writeAllText(mlverPath, initialData);
      // Verifikasi tulis berhasil dibaca kembali
      try {
        const verify = File.readAllText(mlverPath);
        if (!verify || !verify.trim().length) {
          writeErrMsg = "verify-empty";
        }
      } catch (vErr) {
        writeErrMsg = vErr && vErr.message ? vErr.message : String(vErr);
      }
    } catch (wErr) {
      writeErrMsg = wErr && wErr.message ? wErr.message : String(wErr);
    }
    debugLog(
      "Cloud Version",
      `mlver.json dibuat ulang di ${mlverPath} (override: false, Version: ${defaultVer}) | read: ${readErrMsg} | write: ${writeErrMsg || "ok"}`,
    );
  } catch (e) {
    debugLog("Cloud Version", `Error handling mlver.json: ${e.message}`);
  }

  return defaults;
}

/**
 * Membaca versi terupdate dari file lokal `mlver.json` di external user directory.
 * Wrapper tipis di atas getMlverConfig() agar pemanggil lama tetap berfungsi.
 */
export function getCloudVersionFromFile() {
  const cfg = getMlverConfig();
  debugLog(
    "Cloud Version",
    `[OVERRIDE: ${cfg.override}] Version read: ${cfg.version} (${cfg.path || "external"})`,
  );
  return cfg.version;
}

/**
 * Hook GameServerConfig.loadRealVersionCompelte untuk memodifikasi
 * atribut version="..." di dalam XML realversion.xml.
 * Hanya berjalan ketika mlver.json override === true.
 * Jika override === false (Supabase) → lewati hooking sepenuhnya.
 */
// setupRealVersionSpoof dihapus (dead code): hook XML realversion kini
// ditangani native patcher via mlver.json override. Dihapus agar tidak ada
// string fingerprint "[Spoof]"/"loadRealVersionCompelte" di bundle.

/**
 * Mengambil versi terpasang dari GameMain.m_sInnerVerRealForBattle dan mengambil 5 bagian versi awal (contoh: "2.2.13.1228.4")
 */
export function getInstalledGameVersion(Assembly) {
  try {
    const GameMain = Assembly.class("GameMain");
    if (GameMain) {
      const field = GameMain.field("m_sInnerVerRealForBattle");
      if (field && field.value) {
        const rawVer = field.value.toString().replace(/"/g, "").trim();
        const parts = rawVer.split(".");
        if (parts.length >= 5) {
          const trimmedVer = parts.slice(0, 5).join(".");
          debugLog(
            "Game Version",
            `Installed game version (trimmed): ${trimmedVer} (raw: ${rawVer})`,
          );
          return trimmedVer;
        }
        return rawVer;
      }
    }
  } catch (e) {
    debugLog(
      "Game Version",
      `Failed reading GameMain.m_sInnerVerRealForBattle: ${e.message}`,
    );
  }
  return null;
}

/**
 * Membandingkan 2 string versi berdasarkan 2 bagian versi terakhir (Major.Minor)
 * Contoh: "2.1.95.1230.1" dan "2.2.14.1230.1" -> keduanya mengambil "1230.1" sehingga dianggap SAMA (0).
 */
export function compareVersions(v1, v2) {
  if (!v1 || !v2) return 0;

  const getShortVer = (v) => {
    const parts = v.split(".").map(Number);
    if (parts.length >= 2) {
      return parts.slice(-2);
    }
    return parts;
  };

  const p1 = getShortVer(v1);
  const p2 = getShortVer(v2);

  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

// --- ACTIVITY OVERRIDE CONFIGURATION ---

const TYPES_TO_OVERRIDE = [];

const ActivityPatchConfig = {
  MasterConfig: {
    enabled: true,
    debug: false,
    applyGlobal: false,
  },
  GlobalPatch: {
    bShowInList: true,
    iBeginTime: 0,
    iEndTime: 2147483647,
    bShowOnLogin: true,
  },
  TypePatches: {
    // Tetap meng-override 626 dan 209 menjadi 0 sesuai permintaan sebelumnya
    626: {
      bShowInList: true,
      iBeginTime: 0,
      iEndTime: 2147483647,
      bShowOnLogin: true,
      iActivityType: 0,
    },
    209: {
      bShowInList: true,
      iBeginTime: 0,
      iEndTime: 2147483647,
      bShowOnLogin: true,
      iActivityType: 0,
    },
    710: {
      bShowInList: true,
      iBeginTime: 0,
      iEndTime: 2147483647,
      bShowOnLogin: true,
      iActivityType: 0,
    },
  },
  IdPatches: {
    // Contoh: "2604201856": { sTitle: "Custom Activity Title" }
  },
};

// Inisialisasi TypePatches otomatis dari daftar types (jika ada isi di masa depan)
TYPES_TO_OVERRIDE.forEach((type) => {
  if (!ActivityPatchConfig.TypePatches[type]) {
    ActivityPatchConfig.TypePatches[type] = ActivityPatchConfig.GlobalPatch;
  }
});

/**
 * Menerapkan patch pada instance CmdActivityData menggunakan Il2Cpp Bridge.
 */
function applyActivityPatch(instance) {
  if (!ActivityPatchConfig.MasterConfig.enabled) return;

  try {
    const idField = instance.field("iActivityId").value;
    if (!idField) return;
    const id = idField.toString();
    const type = Number(instance.field("iActivityType").value);

    let patchToApply = null;

    // Hirarki: ID > Type > Global
    if (ActivityPatchConfig.IdPatches[id]) {
      patchToApply = ActivityPatchConfig.IdPatches[id];
    } else if (ActivityPatchConfig.TypePatches[type]) {
      patchToApply = ActivityPatchConfig.TypePatches[type];
    } else if (ActivityPatchConfig.MasterConfig.applyGlobal) {
      patchToApply = ActivityPatchConfig.GlobalPatch;
    }

    if (patchToApply) {
      Object.entries(patchToApply).forEach(([key, value]) => {
        try {
          const field = instance.field(key);
          if (typeof value === "string") {
            field.value = Il2Cpp.string(value);
          } else {
            field.value = value;
          }
        } catch (e) {}
      });
    }
  } catch (e) {}
}

/**
 * Menerapkan patch ke List aktivitas.
 */
function applyToActivityList(listPtr) {
  if (listPtr.isNull()) return;
  try {
    const list = new Il2Cpp.Object(listPtr);
    // Asumsi ini adalah System.Collections.Generic.List<CmdActivityData>
    const count = list.method("get_Count").invoke().toInt32();
    for (let i = 0; i < count; i++) {
      const act = list.method("get_Item").invoke(i);
      applyActivityPatch(act);
    }
  } catch (e) {
    // Fallback ke iterasi manual jika Bridge gagal (misal jika bukan standard List)
    debugLog("Unreleased", `Manual list fallback needed: ${e.message}`);
  }
}

// --- HOOKS ---

export function setupUnreleasedHooks(Assembly) {
  /*// Hook XML realversion.xml — hanya aktif saat override=true (false → skip).
  try {
    setupRealVersionSpoof(Assembly);
  } catch (e) {
    debugLog("RealVersion", `setupRealVersionSpoof gagal: ${e.message}`);
  }*/

  // Pengecekan Versi Game Terpasang vs Versi Cloud (mlver.json) setelah 8 detik dari script dimulai
  setTimeout(() => {
    try {
      const installedVer = getInstalledGameVersion(Assembly);
      const cloudVer = getCloudVersionFromFile();

      debugLog(
        "Version Check Timer",
        `Installed: ${installedVer} | Cloud: ${cloudVer}`,
      );

      if (
        installedVer &&
        cloudVer &&
        compareVersions(installedVer, cloudVer) < 0
      ) {
        const mlleakTitle =
          GIT_BRANCH === "testing"
            ? `MLLEAK TESTING (${GIT_HASH})`
            : "MLLEAK Early Update";
        showGameNotification(
          mlleakTitle,
          `[00FF00]Pembaruan Akses Awal Tersedia![-] (v${cloudVer})\nVersi terpasang (${installedVer}) lebih lama.\nSilakan reload / restart game Anda untuk mendapatkan pembaruan.`,
        );
        debugLog(
          "Version Check Timer",
          `Notifikasi pembaruan ditampilkan: Installed (${installedVer}) < Cloud (${cloudVer})`,
        );
      } else {
        debugLog(
          "Version Check Timer",
          `Game (${installedVer}) sudah terbaru, notifikasi di-skip.`,
        );
      }
    } catch (err) {
      debugLog(
        "Version Check Timer",
        `Error saat mengecek versi: ${err.message}`,
      );
    }
  }, 8000);

  const safeCls = (name) => {
    try {
      const cls =
        (Assembly.tryClass && Assembly.tryClass(name)) || Assembly.class(name);
      if (!cls || !cls.handle || cls.handle.isNull()) return null;
      return cls;
    } catch (e) {
      return null;
    }
  };

  const SystemData = safeCls("SystemData");
  const LoginReceiveMessage = safeCls("LoginReceiveMessage");
  if (!SystemData || !LoginReceiveMessage) return;

  let Cmd_Login_CheckUpgrade_SC = safeCls("MTTDProto.Cmd_Login_CheckUpgrade_SC");
  if (!Cmd_Login_CheckUpgrade_SC) {
    try {
      Cmd_Login_CheckUpgrade_SC = Assembly.classes.find(
        (c) => c.name === "Cmd_Login_CheckUpgrade_SC",
      );
    } catch (e) {}
  }

  // 1. Hook DecodeServerUpdateConfig untuk spoof sClientVersion (stealth:
  // tanpa dump paket ke log; hanya debugLog untuk admin).
  let targetMethod = null;
  try {
    targetMethod =
      (LoginReceiveMessage.tryMethod &&
        LoginReceiveMessage.tryMethod("DecodeServerUpdateConfig")) ||
      LoginReceiveMessage.method("DecodeServerUpdateConfig");
  } catch (e) {
    return;
  }
  if (
    !targetMethod ||
    !targetMethod.virtualAddress ||
    targetMethod.virtualAddress.isNull()
  )
    return;

  debugLog(
    "Unreleased",
    `Hooking: ${LoginReceiveMessage.fullName}::${targetMethod.name}`,
  );

  const targetAddr = targetMethod.virtualAddress;
  const origDecode =
    targetAddr && !targetAddr.isNull()
      ? new NativeFunction(targetAddr, "pointer", ["pointer", "pointer"])
      : null;

  targetMethod.implementation = function (...args) {
    let packetInstance = null;

    // Ekstraksi objek paket dari argumen (tanpa log alamat = stealth)
    for (let i = 0; i < args.length; i++) {
      const ptrArg = args[i];
      try {
        if (ptrArg && !ptrArg.isNull() && ptrArg.toUInt32() > 0x1000) {
          const testObj = new Il2Cpp.Object(ptrArg);
          if (
            testObj &&
            testObj.class &&
            testObj.class.name.includes("Cmd_Login_CheckUpgrade_SC")
          ) {
            packetInstance = testObj;
            break;
          }
        }
      } catch (e) {}
    }

    // Fallback scan heap sekali (tanpa log alamat)
    if (!packetInstance && Cmd_Login_CheckUpgrade_SC) {
      try {
        const instances = Il2Cpp.gc.choose(Cmd_Login_CheckUpgrade_SC);
        if (instances.length > 0) packetInstance = instances[0];
      } catch (e) {}
    }

    if (packetInstance) {
      const getVal = (fieldName) => {
        try {
          const field = packetInstance.field(fieldName);
          if (field.value && field.value.toString().includes("Il2Cpp.Object")) {
            return field.value.toString();
          }
          return field.value;
        } catch (e) {
          return "Error/Empty";
        }
      };

      // AREA SPOOFING / MODIFIKASI DATA LIVE:
      packetInstance.field("sForceVersion").value = Il2Cpp.string("2.1.10");
      let originalVersion = getVal("sClientVersion");
      const patchInstance = getCloudVersionFromFile(); // Menggunakan versi dari file mlver.json / Cloud
      const iZoneIdVal = parseInt(getVal("iZoneId"), 10);

      if (!isNaN(iZoneIdVal) && iZoneIdVal >= 57000 && iZoneIdVal <= 57500) {
        if (originalVersion) {
          originalVersion = originalVersion.toString().replace(/"/g, "");
        }

        if (originalVersion && originalVersion !== "Error/Empty") {
          const comp = compareVersions(patchInstance, originalVersion);

          const mlleakVer =
            GIT_BRANCH === "testing"
              ? `MLLEAK TESTING (${GIT_HASH})`
              : "MLLEAK v.0.9.1";

          if (comp > 0) {
            packetInstance.field("sClientVersion").value =
              Il2Cpp.string(patchInstance);
            debugLog(
              "Unreleased",
              `sClientVersion di-patch ke: ${patchInstance} (Zone: ${iZoneIdVal})`,
            );

            // Format "2.1.95.1228.1" ke "1228.1"
            const patchShort = patchInstance.split(".").slice(-2).join(".");
            setTimeout(() => {
              showGameNotification(
                mlleakVer,
                `Hi Tester, from mlleak dev >//< \nGameVer:[00FF00]${patchShort}[-] (Early Update)`,
              );
            }, 2000);
          } else {
            debugLog(
              "Unreleased",
              `sClientVersion dipertahankan: ${originalVersion} (Zone: ${iZoneIdVal})`,
            );

            // Format "2.1.95.1226.1" ke "1226.1"
            const origShort = originalVersion.split(".").slice(-2).join(".");
            setTimeout(() => {
              showGameNotification(
                mlleakVer,
                `Hi Tester, from mlleak dev >//< \nGameVer:${origShort} (Global Update)`,
              );
            }, 2000);
          }
        } else {
          packetInstance.field("sClientVersion").value =
            Il2Cpp.string(patchInstance);
        }
      } else {
        debugLog(
          "Unreleased",
          `sClientVersion patch di-skip, iZoneId (${iZoneIdVal}) di luar range.`,
        );
      }
    } else {
      debugLog("Unreleased", "Gagal mengekstrak objek paket.");
    }

    // Teruskan ke fungsi asli via NativeFunction (anti-rekursi) agar game tidak crash
    try {
      if (origDecode) {
        const thisH = this && this.handle ? this.handle : ptr(0);
        const a1 = args[0] && args[0].handle ? args[0].handle : args[0];
        return origDecode(thisH, a1);
      }
    } catch (e) {}
    return targetMethod.invoke(...args);
  };

  // --- NOP / FORCE FIXES (dead ASTC hooks dihapus; sisakan yang aktif) ---
  const safeMethod = (cls, name) => {
    try {
      if (!cls) return null;
      const m = (cls.tryMethod && cls.tryMethod(name)) || cls.method(name);
      if (!m || !m.virtualAddress || m.virtualAddress.isNull()) return null;
      return m;
    } catch (e) {
      return null;
    }
  };

  const nopMethod = (cls, name) => {
    try {
      const m = safeMethod(cls, name);
      if (!m) return;
      Interceptor.replace(
        m.virtualAddress,
        new NativeCallback(() => {}, "void", []),
      );
    } catch (e) {}
  };

  nopMethod(SystemData, "CheckFileMd5_SubThread");
  nopMethod(SystemData, "CheckAndFixASTC_SubThread");

  // --- ACTIVITY OVERRIDE (DYNAMIC) ---

  try {
    let CmdActivityDataClass = null;
    try {
      CmdActivityDataClass =
        (Assembly.tryClass && Assembly.tryClass("MTTDProto.CmdActivityData")) ||
        (Assembly.tryClass && Assembly.tryClass("CmdActivityData"));
    } catch (e) {}
    if (CmdActivityDataClass) {
      CmdActivityDataClass.methods
        .filter((m) => m.name === "visit")
        .forEach((method) => {
          try {
            const originalVisitAddr = method.virtualAddress;
            if (!originalVisitAddr || originalVisitAddr.isNull()) return;
            // NativeFunction dibuat sekali (stealth: tanpa alokasi per-call)
            const originalVisit = new NativeFunction(
              originalVisitAddr,
              "void",
              ["pointer", "pointer", "int"],
            );
            method.implementation = function (sdp, flag) {
              try {
                const sdpH = sdp && sdp.handle ? sdp.handle : ptr(0);
                originalVisit(this.handle, sdpH, flag ? 1 : 0);
              } catch (e) {}
              try {
                if (
                  sessionState.isAuthorized &&
                  sessionState.permissions.allowUnreleased
                ) {
                  applyActivityPatch(this);
                }
              } catch (e) {}
            };
          } catch (e) {}
        });
    }
  } catch (e) {}

  // --- FORBIDDEN CONTENT BYPASS ---

  if (SystemData) {
    ["IsForbidHeros", "IsActivityForbidHeros"].forEach((mName) => {
      try {
        const method = safeMethod(SystemData, mName);
        if (!method) return;
        Interceptor.attach(method.virtualAddress, {
          onLeave: function (retval) {
            if (
              sessionState.isAuthorized &&
              sessionState.permissions.allowUnreleased
            ) {
              retval.replace(ptr(0));
            }
          },
        });
      } catch (e) {}
    });

    try {
      const CheckMapSkinAvailable = safeMethod(
        SystemData,
        "CheckMapSkinAvailable",
      );
      if (CheckMapSkinAvailable) {
        Interceptor.attach(CheckMapSkinAvailable.virtualAddress, {
          onLeave: function (retval) {
            if (
              sessionState.isAuthorized &&
              sessionState.permissions.allowUnreleased
            ) {
              retval.replace(ptr(1));
            }
          },
        });
      }
    } catch (e) {}
  }
}
