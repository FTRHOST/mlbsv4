/**
 * Unreleased Content & Activity Filter Module
 */

import { sessionState } from "../tools/config";
import { debugLog } from "../tools/utils";
import { showGameNotification } from "../index";
import { GIT_BRANCH, GIT_HASH } from "../env";

// Variabel global untuk menyimpan versi dari cloud
let latestCloudVersion = "2.1.95.1228.1"; // Nilai default/fallback

// Fungsi untuk menarik data dari database.json di Github Raw secara asinkron
function fetchLatestCloudVersion() {
  if (typeof Java !== 'undefined' && Java.available) {
    Java.perform(() => {
      try {
        const URL = Java.use("java.net.URL");
        const BufferedReader = Java.use("java.io.BufferedReader");
        const InputStreamReader = Java.use("java.io.InputStreamReader");
        
        // Ganti 'testing' ke 'main' jika script sudah dimerge ke main
        const url = URL.$new("https://raw.githubusercontent.com/FTRHOST/mlbsv4/testing/database.json");
        const conn = url.openConnection();
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);
        conn.setRequestMethod("GET");
        
        const reader = BufferedReader.$new(InputStreamReader.$new(conn.getInputStream()));
        let result = "";
        let line = null;
        while ((line = reader.readLine()) !== null) {
          result += line;
        }
        reader.close();
        
        const json = JSON.parse(result);
        if (json && json.sClientVersion) {
          latestCloudVersion = json.sClientVersion;
          console.log("[+] Berhasil mengambil versi sClientVersion dari Cloud: " + latestCloudVersion);
        }
      } catch (e) {
        console.log("[-] Gagal mengambil versi dari Cloud, menggunakan versi fallback: " + latestCloudVersion);
      }
    });
  }
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
  // Mulai proses fetch di background sesegera mungkin
  fetchLatestCloudVersion();

  const ActLclCfgMgr = Assembly.class("ActLclCfgMgr");
  const GameInit = Assembly.class("GameInit");
  const NewPackageMgr = Assembly.class("NewPackageMgr");
  const SystemData = Assembly.class("SystemData");

  const LoginReceiveMessage = Assembly.class("LoginReceiveMessage");

  let Cmd_Login_CheckUpgrade_SC;
  try {
    Cmd_Login_CheckUpgrade_SC = Assembly.class(
      "MTTDProto.Cmd_Login_CheckUpgrade_SC",
    );
  } catch (e) {
    Cmd_Login_CheckUpgrade_SC = Assembly.classes.find(
      (c) => c.name === "Cmd_Login_CheckUpgrade_SC",
    );
  }

  // 1. Target method baru Anda yang sudah terbukti berhasil
  const targetMethod = LoginReceiveMessage.method("DecodeServerUpdateConfig");

  console.log(
    `[+] Menggunakan .implementation untuk: ${LoginReceiveMessage.fullName}::${targetMethod.name}`,
  );

  targetMethod.implementation = function (...args) {
    console.log(`\n[!] ${targetMethod.name} TERPOTONG SECARA LIVE!`);

    let packetInstance = null;

    // Ekstraksi Objek dari parameter register murni
    for (let i = 0; i < args.length; i++) {
      const ptrArg = args[i];
      if (ptrArg && !ptrArg.isNull() && ptrArg.toUInt32() > 0x1000) {
        try {
          let testObj = new Il2Cpp.Object(ptrArg);
          if (
            testObj &&
            testObj.class &&
            testObj.class.name.includes("Cmd_Login_CheckUpgrade_SC")
          ) {
            packetInstance = testObj;
            console.log(
              `[+] Berhasil menemukan objek paket di args[${i}] dengan alamat: ${ptrArg}`,
            );
            break;
          }
        } catch (e) {}
      }
    }

    // Fallback scan heap memori via GC Choose
    if (!packetInstance && Cmd_Login_CheckUpgrade_SC) {
      const instances = Il2Cpp.gc.choose(Cmd_Login_CheckUpgrade_SC);
      if (instances.length > 0) {
        packetInstance = instances[0];
        console.log(
          `[+] Objek ditemukan via GC-Choose Fallback pada alamat: ${packetInstance.handle}`,
        );
      }
    }

    // Menampilkan nilai field data
    if (packetInstance) {
      console.log(
        `=================== [ LIVE RECEPTOR: ${packetInstance.handle} ] ===================`,
      );

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

      console.log(
        `[0x10] iZoneId                           : ${getVal("iZoneId")}`,
      );
      console.log(
        `[0x18] sConnServer                       : "${getVal("sConnServer")}"`,
      );
      console.log(
        `[0x20] sClientVersion                    : "${getVal("sClientVersion")}"`,
      );
      console.log(
        `[0x28] sResPatchVersion                  : "${getVal("sResPatchVersion")}"`,
      );
      console.log(
        `[0x30] sResAllVersion                    : "${getVal("sResAllVersion")}"`,
      );
      console.log(
        `[0x38] sCdnVersion                       : "${getVal("sCdnVersion")}"`,
      );
      console.log(
        `[0x40] sApkUpdateAddr                    : "${getVal("sApkUpdateAddr")}"`,
      );
      console.log(
        `[0x48] sForceVersion                     : "${getVal("sForceVersion")}"`,
      );
      console.log(
        `[0x50] sFaceCdnHost                      : "${getVal("sFaceCdnHost")}"`,
      );
      console.log(
        `[0x68] sResPatchVersionNew               : "${getVal("sResPatchVersionNew")}"`,
      );
      console.log(
        `[0x70] sResAllVersionNew                 : "${getVal("sResAllVersionNew")}"`,
      );
      console.log(
        `[0x78] sNewConnServerList                : "${getVal("sNewConnServerList")}"`,
      );
      console.log(
        `[0x80] iRetryNum                         : ${getVal("iRetryNum")}`,
      );
      console.log(
        `[0x88] sSignature                        : "${getVal("sSignature")}"`,
      );
      console.log(
        `[0x98] sForceUpdateUrl                   : "${getVal("sForceUpdateUrl")}"`,
      );
      console.log(
        `[0xe0] bFixCheckUpgrade (Boolean)         : ${getVal("bFixCheckUpgrade")}`,
      );

      console.log(
        `========================================================================\n`,
      );

      // ======================================================================
      // AREA SPOOFING / MODIFIKASI DATA LIVE:
      //
      let originalVersion = getVal("sClientVersion");
      const patchInstance = latestCloudVersion; // Menggunakan versi dari Cloud
      const iZoneIdVal = parseInt(getVal("iZoneId"), 10);
      
      if (!isNaN(iZoneIdVal) && iZoneIdVal >= 57000 && iZoneIdVal <= 57500) {
        if (originalVersion) {
          originalVersion = originalVersion.toString().replace(/"/g, '');
        }

        const compareVersions = (v1, v2) => {
          if (!v1 || !v2) return 0;
          const p1 = v1.split('.').map(Number);
          const p2 = v2.split('.').map(Number);
          for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            const n1 = p1[i] || 0;
            const n2 = p2[i] || 0;
            if (n1 > n2) return 1;
            if (n1 < n2) return -1;
          }
          return 0;
        };

        if (originalVersion && originalVersion !== "Error/Empty") {
          const comp = compareVersions(patchInstance, originalVersion);
          
          const mlleakVer = GIT_BRANCH === "testing" ? `MLLEAK TESTING (${GIT_HASH})` : "MLLEAK v.0.8";

          if (comp > 0) {
            packetInstance.field("sClientVersion").value = Il2Cpp.string(patchInstance);
            console.log(`[+] sClientVersion di-patch ke: ${patchInstance} (Lebih baru dari ${originalVersion}, Zone: ${iZoneIdVal})`);
            
            // Format "2.1.95.1228.1" ke "1228.1"
            const patchShort = patchInstance.split('.').slice(-2).join('.');
            setTimeout(() => {
              showGameNotification(mlleakVer, `Hi Tester, from mlleak dev >//< \nGameVer:[00FF00]${patchShort}[-] (Early Update)`);
            }, 2000);
          } else {
            console.log(`[+] sClientVersion dipertahankan: ${originalVersion} (Sama/Lebih baru dari ${patchInstance}, Zone: ${iZoneIdVal})`);
            
            // Format "2.1.95.1226.1" ke "1226.1"
            const origShort = originalVersion.split('.').slice(-2).join('.');
            setTimeout(() => {
              showGameNotification(mlleakVer, `Hi Tester, from mlleak dev >//< \nGameVer:${origShort} (Global Update)`);
            }, 2000);
          }
        } else {
          packetInstance.field("sClientVersion").value = Il2Cpp.string(patchInstance);
        }
      } else {
        console.log(`[-] sClientVersion patch di-skip karena iZoneId (${iZoneIdVal}) di luar range 57000-57500`);
      }
      // packetInstance.field("sResPatchVersionNew").value = Il2Cpp.string("http://ip_server_kamu/res_patch/");
      // console.log("[+] Data Server Config berhasil di-spoofing secara live!");
      // ======================================================================
    } else {
      console.log(
        `[-] Gagal mengekstrak objek data paket dari memori register.`,
      );
    }

    // 2. FIX UTAMA: Teruskan ke method asli yang benar ('targetMethod') agar game tidak crash
    return targetMethod.invoke(...args);
  };

  // --- NOP / FORCE FIXES ---

  /* const IsCloseAstcInPackVar = NewPackageMgr.method("IsCloseAstcInPackVar");
  if (IsCloseAstcInPackVar) {
    Interceptor.replace(
      IsCloseAstcInPackVar.virtualAddress,
      new NativeCallback(() => 0, "int", [])
    );
  }*/

  /* const get_bAstcInPack = GameInit.method("get_bAstcInPack");
  if (get_bAstcInPack) {
    Interceptor.replace(
      get_bAstcInPack.virtualAddress,
      new NativeCallback(() => 0, "int", []),
    );
  } */

  const CheckFileMd5_SubThread = SystemData.method("CheckFileMd5_SubThread");
  if (CheckFileMd5_SubThread) {
    Interceptor.replace(
      CheckFileMd5_SubThread.virtualAddress,
      new NativeCallback(() => {}, "void", []),
    );
  }

  const CheckAndFixASTC_SubThread = SystemData.method(
    "CheckAndFixASTC_SubThread",
  );
  if (CheckAndFixASTC_SubThread) {
    Interceptor.replace(
      CheckAndFixASTC_SubThread.virtualAddress,
      new NativeCallback(() => {}, "void", []),
    );
  }

  // --- ACTIVITY OVERRIDE (STATIC) ---

  /*
  if (ActLclCfgMgr) {
    const ReadActLclCfgByStage = ActLclCfgMgr.method("ReadActLclCfgByStage");
    if (ReadActLclCfgByStage) {
      Interceptor.attach(ReadActLclCfgByStage.virtualAddress, {
        onLeave: function (retval) {
          if (sessionState.isAuthorized && sessionState.permissions.allowUnreleased) {
            if (!retval.isNull()) {
              // Di MLBB, vActivity biasanya di offset 0x18 dari ActLclCfgData
              const vActivity = retval.add(0x18).readPointer();
              applyToActivityList(vActivity);
            }
          }
        },
      });
    }
  }
  */

  // --- ACTIVITY OVERRIDE (DYNAMIC) ---

  const CmdActivityDataClass =
    Assembly.tryClass("MTTDProto.CmdActivityData") ||
    Assembly.tryClass("CmdActivityData");
  if (CmdActivityDataClass) {
    CmdActivityDataClass.methods
      .filter((m) => m.name === "visit")
      .forEach((method) => {
        const originalVisitAddr = method.virtualAddress;
        method.implementation = function (sdp, flag) {
          // Panggil fungsi asli native agar data terisi dari Sdp
          const originalVisit = new NativeFunction(originalVisitAddr, "void", [
            "pointer",
            "pointer",
            "int",
          ]);
          originalVisit(this.handle, sdp.handle, flag ? 1 : 0);

          if (
            sessionState.isAuthorized &&
            sessionState.permissions.allowUnreleased
          ) {
            applyActivityPatch(this);
          }
        };
      });
  }

  // --- FORBIDDEN CONTENT BYPASS ---

  if (SystemData) {
    ["IsForbidHeros", "IsActivityForbidHeros"].forEach((mName) => {
      const method = SystemData.method(mName);
      if (method) {
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
      }
    });

    const CheckMapSkinAvailable = SystemData.method("CheckMapSkinAvailable");
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
  }
}
