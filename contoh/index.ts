import "frida-il2cpp-bridge";
import { Toolkit } from "./toolkit.js";

/**
 * ==============================================================================
 * MLBB ULTIMATE IL2CPP MULTI-TRACER TOOLKIT
 * Refactored for Bridge & Logic Module targeting
 * ==============================================================================
 */

// Targetkan liblogic.so karena sebagian besar logika game (SystemData, Activity) ada di sana
// Jika backtrace masih berupa hex, pastikan moduleName di bawah sesuai dengan nama library IL2CPP di game ini
Il2Cpp.$config.moduleName = "liblogic.so";

Il2Cpp.perform(() => {
  console.log("[+] Ultimate API IL2CPP Initialized (via Bridge).");

  // ==========================================
  // SPECIAL: GM & SANDBOX AUTO-PATCHER
  // ==========================================
  // Toolkit.patchGMSandbox();

  // Warmup backtrace cache (optional, will happen on first bt call anyway)
  // Toolkit.resolveAddress(NULL); 

  // ==========================================
  // GLOBAL BYPASS (Unlocking Features)
  // ==========================================
  // Memaksa berbagai pengecekan ketersediaan skin agar selalu 'true' (tersedia)
  // Toolkit.hookMethodReturn("SystemData", "CheckMapSkinAvailable", true);
  // Toolkit.hookMethodReturn("GameInit", "IsSandBoxIp", true);
  // Toolkit.hookMethodReturn("SystemData", "IsCanUseSkin", true);
  // Toolkit.hookMethodReturn("UIChooseHero", "CanSelectSkin", true);
  // Toolkit.hookMethodReturn("ChooseHeroMgr", "IsSkinUseable", true);
  // Toolkit.hookMethodReturn("ChooseHeroMgr", "BActFreeSkin", true);
  // Toolkit.hookMethodReturn("BattleBridge", "IsUIMiniMapToolButtonValid", true);


  // Toolkit.blockMethod("MTTDProto.CmdActivityData", "visit");
  // Toolkit.blockMethod("SystemData", "GetCitizensSkinUnlockSingleLv");
  // Toolkit.blockMethod("BattleBridge", "SendGM");
  // Toolkit.blockMethod("BattleBridge", "ReceGM");
  //
  // Toolkit.traceMethodCalls("BattleBridge")
  // Toolkit.traceMethodCalls("UIMiniMapToolButton");

  // ==========================================
  // FORBIDDEN SKINS MONITORING SYSTEM
  // ==========================================

  // Daftar ID Skin yang didapat dari forbidden_skins_dump.json
  const targetedSkinIds = new Set([
    1435, 1437, 100712, 105212, 108412, 610751, 611941, 612542, 613261, 614241,
    614331, 614381, 614382, 615081, 616961, 616962, 617071, 617072, 618591,
    618731, 619331, 619861, 619862, 620251, 620252, 620861, 620862, 622651,
    622652, 622741, 622742, 622841, 622842, 623131, 623132, 61026141, 61032101,
    61032102, 61052121, 61073111, 61073112, 61080131, 61103111
  ]);

  // Map untuk menyimpan status dilarang (true) atau tidak (false)
  const forbiddenSkinsMap = new Map<number, boolean>();

  /**
   * Fungsi untuk menyimpan daftar skin yang terdeteksi dilarang ke JSON secara berkala
   */
  const saveForbiddenSkins = () => {
    try {
      const forbiddenSkins = Array.from(forbiddenSkinsMap.entries())
        .filter(([_, isForbidden]) => isForbidden)
        .map(([id, _]) => id)
        .sort((a, b) => a - b);

      if (forbiddenSkins.length === 0) return;

      const dataPath = Il2Cpp.application.dataPath;
      if (!dataPath) return;

      const skinsJson = JSON.stringify(forbiddenSkins, null, 2);
      const skinPath = dataPath + "/forbidden_skins_dump.json";
      const skinFile = new (File as any)(skinPath, "w");
      skinFile.write(skinsJson);
      skinFile.flush();
      skinFile.close();
      console.log(`[+] Auto-Save: ${forbiddenSkins.length} forbidden skins saved.`);
    } catch (e) { }
  };

  // Simpan data setiap 5 detik jika ada perubahan
  // setInterval(saveForbiddenSkins, 5000);

  /**
   * Fungsi untuk mentrace semua method dalam sebuah class yang menerima argument
   * yang nilainya ada dalam daftar targetedSkinIds.
   * Return true jika class ditemukan, false jika tidak.
   */
  const traceClassForSkinIds = (className: string): boolean => {
    const klass = Toolkit.findClass(className);
    if (!klass) {
      return false;
    }

    console.log(`[+] Tracer: Monitoring ${className} for targeted Skin IDs...`);
    klass.methods.forEach(method => {
      // Kita hanya trace method yang punya parameter
      if (method.parameterCount > 0) {
        method.implementation = function (...args: any[]) {
          // Logika pengecekan Skin ID
          for (let i = 0; i < args.length; i++) {
            const argVal = Number(args[i]);
            if (targetedSkinIds.has(argVal)) {
              // TRACE LOG (Commented as requested)
              // console.log(`[🎯 ID TRACE] ${className}::${method.name}(arg[${i}]: ${argVal}) called!`);
            }
          }

          // PERBAIKAN: Gunakan 'this' sebagai parameter pertama untuk non-static methods
          if (method.isStatic) {
            return method.invoke(...args);
          } else {
            return method.invoke(this as any, ...args);
          }
        };
      }
    });
    return true;
  };

  // Aktifkan trace untuk SystemData
  // traceClassForSkinIds("SystemData");

  // Aktifkan trace untuk MTTDProto.CmdActivityData atau CmdActivityData
  /*if (!traceClassForSkinIds("MTTDProto.CmdActivityData")) {
    traceClassForSkinIds("CmdActivityData");
  }*/
  /*
    const SystemData = Toolkit.findClass("SystemData");
    if (SystemData) {
      // --- LOGIKA KHUSUS UNTUK ISFORBIDSKIN ---
      const isForbidSkin = SystemData.methods.find(m =>
        m.name === "IsForbidSkin" &&
        m.parameterCount === 2 &&
        m.parameters[0]?.type.name.includes("UInt32")
      );
  
      if (isForbidSkin) {
        console.log("[+] Hooking IsForbidSkin for data collection...");
        isForbidSkin.implementation = function (skinId: any, filterLua: any) {
          const result = isForbidSkin.invoke(skinId, filterLua);
          const id = Number(skinId);
          const isForbidden = (result === true || result === 1);
  
          // Jika status dilarang berubah, catat dan simpan
          if (forbiddenSkinsMap.get(id) !== isForbidden) {
            // TRACE LOG (Commented as requested)
            // if (isForbidden) console.log(`[!] NEW FORBIDDEN SKIN DETECTED: ${id}`);
            forbiddenSkinsMap.set(id, isForbidden);
          }
  
          return result;
        };
      }
  
      // --- LOGIKA KHUSUS UNTUK MENAMBAH SKIN DILARANG ---
      const addForbidSkin = SystemData.methods.find(m => m.name === "AddForbidSkinByID");
      if (addForbidSkin) {
        addForbidSkin.implementation = function (skinId: any) {
          const id = Number(skinId);
          // TRACE LOG (Commented as requested)
          // console.log(`[Trace] AddForbidSkinByID(id: ${id})`);
          forbiddenSkinsMap.set(id, true);
          return addForbidSkin.invoke(skinId);
        };
      }
  
      const addAndCheck = SystemData.methods.find(m => m.name === "AddAndCheckForbidSkins");
      if (addAndCheck) {
        addAndCheck.implementation = function (skinIds: any) {
          // TRACE LOG (Commented as requested)
          // console.log(`[Trace] AddAndCheckForbidSkins called.`);
          try {
            const list = skinIds as Il2Cpp.Object;
            const count = Number(list.method("get_Count").invoke());
            for (let i = 0; i < count; i++) {
              const id = Number(list.method("get_Item").invoke(i));
              forbiddenSkinsMap.set(id, true);
            }
          } catch (e) { }
          return addAndCheck.invoke(skinIds);
        };
      }
    }
  */


  // ==========================================
  // CONFIGURATION: MASTER OVERRIDE SYSTEM
  // ==========================================

  const MasterConfig = {
    enabled: true,           // Matikan/Nyalakan seluruh sistem override
    debug: true,            // Tampilkan log detail saat patching (sangat berguna untuk debugging)
    applyGlobal: false,      // Terapkan konfigurasi global jika tidak ada ID/Type yang cocok
  };

  // Ekspos ke global agar bisa diakses dari Frida Console
  (globalThis as any).MasterConfig = MasterConfig;

  // Konfigurasi Default (Global) - Diterapkan jika tidak ada patch spesifik
  const GlobalPatch: Record<string, any> = {
    // iActivityType: 0,
    bShowInList: true,
    iBeginTime: 0,
    iEndTime: 2147483647,
    bShowOnLogin: true,
    sTitle: "Testttt"
    // iMinLevel: 0
  };

  // Konfigurasi Spesifik berdasarkan Tipe (iActivityType)
  const TypePatches: Record<number, any> = {
    // Contoh: Tipe 2 selalu sembunyi
    // 626: { bShowInList: true }
  };

  // Konfigurasi Spesifik berdasarkan ID (iActivityId)
  const IdPatches: Record<string, any> = {
    // "2604201856": { sTitle: "Testttt" }
  };

  // Daftar tipe yang diketahui (dari typesToOverride sebelumnya)
  // Bisa digunakan untuk mengisi TypePatches secara otomatis jika diinginkan
  const typesToAutoOverride = [2, 6, 7, 8, 21, 23, 28, 29, 30, 33, 34, 37, 39, 42, 46, 50, 51, 52, 55, 59, 60, 61, 62, 63, 64, 66, 68, 73, 74, 75, 87, 88, 94, 100, 102, 103, 104, 106, 110, 111, 113, 114, 117, 118, 119, 120, 125, 129, 131, 132, 135, 137, 138, 141, 144, 147, 149, 150, 153, 154, 159, 161, 165, 166, 167, 168, 171, 184, 185, 187, 188, 189, 195, 196, 197, 209, 210, 211, 219, 220, 221, 223, 225, 227, 234, 238, 239, 242, 244, 245, 250, 254, 256, 258, 259, 260, 261, 262, 265, 267, 271, 273, 274, 275, 276, 277, 281, 286, 291, 296, 300, 301, 302, 303, 306, 318, 321, 322, 323, 326, 328, 333, 336, 337, 341, 344, 346, 349, 357, 364, 371, 378, 390, 393, 395, 398, 399, 400, 408, 412, 413, 417, 418, 420, 422, 423, 428, 429, 430, 432, 438, 440, 441, 443, 445, 446, 448, 451, 456, 460, 461, 467, 471, 473, 474, 480, 484, 487, 495, 496, 497, 501, 502, 503, 504, 506, 510, 512, 515, 516, 517, 519, 522, 532, 533, 534, 535, 538, 541, 544, 549, 550, 551, 553, 555, 557, 558, 560, 562, 566, 567, 569, 570, 572, 573, 578, 580, 582, 585, 587, 590, 592, 599, 600, 603, 605, 606, 608, 611, 613, 616, 617, 618, 619, 620, 622, 623, 624, 625, 626, 630, 632, 635, 637, 638, 639, 642, 645, 648, 650, 652, 653, 656, 657, 658, 663, 664, 665, 666, 668, 669, 671, 675, 678, 679, 680, 683, 684, 688, 689, 690, 692, 693, 695, 696, 697, 698, 702, 706, 710, 713, 716, 717, 719, 724, 726, 727, 732, 733, 734, 737, 740, 741, 745, 746, 747, 749, 755, 757, 758, 761, 763, 764, 767, 768, 771, 772, 773, 775, 776, 777, 779, 791, 792, 799, 800, 804, 828, 829, 832, 837, 839, 843, 846, 848, 850, 859, 860, 863, 864, 865, 869, 870, 873, 878, 880, 882, 884, 892, 893, 894, 895, 897, 905, 906, 908, 909, 911, 913, 914, 916, 917, 920, 923, 924, 925, 929, 930, 938, 941, 944, 947, 950, 951, 952, 957, 958, 959, 963, 964, 965, 966, 970, 971, 973, 974, 975, 976, 978, 980, 981, 983, 987, 989, 991, 993, 995, 999, 1002, 1004, 1006, 1008, 1009, 1010, 1011, 1012, 1016, 1018, 1019, 1026];

  // Inisialisasi TypePatches jika diinginkan untuk otomatis mem-patch tipe dalam daftar
  typesToAutoOverride.forEach(type => { if (!TypePatches[type]) TypePatches[type] = GlobalPatch; });

  // Map untuk menyimpan data ASLI dari server (untuk fitur REVERT/RESTORE)
  const originalDataMap = new Map<string, any>();

  /**
   * Fungsi untuk menerapkan logic override ke satu instance CmdActivityData
   * Mengikuti Hirarki: ID Patch > Type Patch > Global Patch
   */
  const applyLogicToInstance = (instance: Il2Cpp.Object) => {
    try {
      const idField = instance.field("iActivityId").value;
      if (!idField) return;
      const id = idField.toString();
      const type = Number(instance.field("iActivityType").value);

      // 1. Simpan Data Asli (Snapshot saat pertama kali dilihat)
      if (!originalDataMap.has(id)) {
        originalDataMap.set(id, {
          iActivityType: type,
          bShowInList: instance.field("bShowInList").value,
          iBeginTime: instance.field("iBeginTime").value,
          iEndTime: instance.field("iEndTime").value,
          iMinLevel: instance.field("iMinLevel").value,
          bShowOnLogin: instance.field("bShowOnLogin").value,
          bHideJumpButton: instance.field("bHideJumpButton").value,
          sTitle: (instance.field("sTitle").value as any) instanceof Il2Cpp.String ? (instance.field("sTitle").value as any).content : null,
          sJumpUI: (instance.field("sJumpUI").value as any) instanceof Il2Cpp.String ? (instance.field("sJumpUI").value as any).content : null
        });
      }

      const original = originalDataMap.get(id);

      // 2. Jika Master DISABLED: Kembalikan data ke nilai asli
      if (!MasterConfig.enabled) {
        if (MasterConfig.debug) console.log(`[Revert] Restoring original values for Activity ${id}`);
        Toolkit.patchObject(instance, original);
        return;
      }

      // 3. Tentukan Patch mana yang akan dipakai (Hirarki)
      let patchToApply: Record<string, any> | null = null;
      let patchSource = "";

      if (IdPatches[id]) {
        patchToApply = IdPatches[id];
        patchSource = "ID Specific";
      } else if (TypePatches[type]) {
        patchToApply = TypePatches[type];
        patchSource = "Type Specific";
      } else if (MasterConfig.applyGlobal) {
        patchToApply = GlobalPatch;
        patchSource = "Global Fallback";
      }

      // 4. Terapkan Patch
      if (patchToApply) {
        if (MasterConfig.debug) console.log(`[Patching] Activity ${id} (Type ${type}) using ${patchSource}`);
        Toolkit.patchObject(instance, patchToApply, MasterConfig.debug);
      }
    } catch (e) {
      if (MasterConfig.debug) console.log(`[-] Error in applyLogicToInstance (${instance}): ${e}`);
    }
  };


  // Fungsi untuk merefresh semua aktivitas yang ada di cache game
  // Panggil ini di console setelah mengubah MasterConfig atau PatchConfig
  const refreshActivities = () => {
    try {
      const Controller = Toolkit.findClass("Activity.ActivityManagerController");
      if (!Controller) return;
      const instance = Controller.field("_instance").value as Il2Cpp.Object;
      if (instance.isNull()) {
        console.log("[-] ActivityManagerController instance is null. Is the game still loading?");
        return;
      }

      const cache = instance.field("m_CacheActs").value as Il2Cpp.Object;
      const count = Number(cache.method("get_Count").invoke());

      console.log(`[🔄 REFRESH] Applying current config to ${count} cached activities...`);
      for (let i = 0; i < count; i++) {
        const act = cache.method("get_Item").invoke(i) as Il2Cpp.Object;
        applyLogicToInstance(act);
      }
      console.log("[+] Refresh Complete!");
    } catch (e) {
      console.log("[-] Refresh Error: " + e);
    }
  };

  (globalThis as any).refreshActivities = refreshActivities;
  (globalThis as any).GlobalPatch = GlobalPatch;
  (globalThis as any).TypePatches = TypePatches;
  (globalThis as any).IdPatches = IdPatches;
  (globalThis as any).inspect = (target: any) => Toolkit.inspect(target);
  (globalThis as any).trace = (klass: string, method: string, bt?: boolean) => Toolkit.traceMethod(klass, method, bt);
  (globalThis as any).traceAll = (klass: string, exclude?: string[], bt?: boolean) => Toolkit.traceAllMethods(klass, exclude, bt);
  (globalThis as any).bt = () => console.log(Toolkit.getBacktrace());
  (globalThis as any).forceArg = (k: string, m: string, i: number, v: any) => Toolkit.forceArg(k, m, i, v);
  (globalThis as any).forceReturn = (k: string, m: string, v: any, exec?: boolean) => Toolkit.forceReturn(k, m, v, exec);
  (globalThis as any).patchGMSandbox = () => Toolkit.patchGMSandbox();
  (globalThis as any).Scanner = Toolkit.Scanner;
  (globalThis as any).getClasses = (asm?: string) => Toolkit.getAllClassNames(asm);
  (globalThis as any).untrace = (klass: string, method: string) => Toolkit.untrace(klass, method);
  (globalThis as any).untraceAll = (klass: string) => Toolkit.untraceAllMethods(klass);
  (globalThis as any).startLog = (filename?: string) => Toolkit.startTraceLog(filename);
  (globalThis as any).stopLog = () => Toolkit.stopTraceLog();
  (globalThis as any).dumpAll = (klass: string) => Toolkit.dumpAllInstances(klass);
  (globalThis as any).dumpToFile = (klass: string, filename?: string) => Toolkit.dumpToFile(klass, filename);

  /**
   * Universal Method Caller: Find and invoke a method by name.
   */
  (globalThis as any).call = (className: string, methodName: string, args: any[] = [], instanceHandle?: NativePointer) => {
    try {
      const klass = Toolkit.findClass(className);
      if (!klass) return console.log(`[-] Class '${className}' not found.`);

      const method = klass.method(methodName);
      if (instanceHandle) {
        const instance = new Il2Cpp.Object(instanceHandle);
        return method.invoke(instance as any, ...args);
      } else {
        if (!method.isStatic) {
          const instances = Il2Cpp.gc.choose(klass);
          if (instances.length > 0) {
            const firstInstance = instances[0] as Il2Cpp.Object;
            console.log(`[+] Using active instance at ${firstInstance.handle}`);
            return method.invoke(firstInstance as any, ...args);
          } else {
            return console.log(`[-] Method is instance-based but no active instance was found.`);
          }
        }
        return method.invoke(...args);
      }
    } catch (e) {
      console.log(`[!] Call Error: ${e}`);
    }
  };

  // Correlation Search Features
  (globalThis as any).correlate = (values: any[], classes: string[]) => Toolkit.CorrelationScanner.start(values, classes);
  (globalThis as any).correlateReport = () => Toolkit.CorrelationScanner.report();
  (globalThis as any).correlateStop = () => Toolkit.CorrelationScanner.stop();
  (globalThis as any).heapSearch = (values: any[], classes?: string[]) => Toolkit.ValueCorrelationScanner.scan(values, classes);
  (globalThis as any).findClasses = (kw: string) => Toolkit.getAllClassNames().filter(n => n.toLowerCase().includes(kw.toLowerCase()));

  // Freezer Features
  (globalThis as any).freezeClass = (className: string, interval?: number) => Toolkit.ValueFreezer.start(className, undefined, interval);
  (globalThis as any).freezeInstance = (className: string, handle: NativePointer, interval?: number) => Toolkit.ValueFreezer.start(className, handle, interval);
  (globalThis as any).unfreeze = (id?: string) => Toolkit.ValueFreezer.stop(id);
  (globalThis as any).freezerList = () => Toolkit.ValueFreezer.list();

  // Persistent Patch Features
  (globalThis as any).saveFreeze = (className: string) => Toolkit.PersistentFreezer.save(className);
  (globalThis as any).removeFreeze = (className: string) => Toolkit.PersistentFreezer.remove(className);
  (globalThis as any).loadFreezes = () => Toolkit.PersistentFreezer.loadAndApply();

  // Persistent Hook Features
  (globalThis as any).saveHook = (className: string, methodName: string, value: any) => Toolkit.PersistentHooks.save(className, methodName, value);
  (globalThis as any).removeHook = (className: string, methodName?: string) => Toolkit.PersistentHooks.remove(className, methodName);
  (globalThis as any).loadHooks = () => Toolkit.PersistentHooks.loadAndApply();

  // Game Control Features
  (globalThis as any).pause = () => Toolkit.pause();
  (globalThis as any).resume = () => Toolkit.resume();
  (globalThis as any).freeze = (state: boolean = true) => Toolkit.Unity.freeze(state);

  // Auto-Load Persistent Patches & Hooks
  setTimeout(() => {
    Toolkit.PersistentFreezer.loadAndApply();
    Toolkit.PersistentHooks.loadAndApply();
  }, 5000);

  // ==========================================
  // ACTIVITY DATA DUMPING (Statis)
  // ==========================================
  /**
   * Mendump semua data aktivitas dan mengumpulkan semua tipe unik yang ada
   */
  const dumpActivities = () => {
    try {
      const Controller = Toolkit.findClass("Activity.ActivityManagerController");
      if (!Controller) return;
      const instance = Controller.field("_instance").value as Il2Cpp.Object;
      if (instance.isNull()) return;

      const cache = instance.field("m_CacheActs").value as Il2Cpp.Object;
      const count = Number(cache.method("get_Count").invoke());

      const activities = [];
      const uniqueTypes = new Set<number>();

      for (let i = 0; i < count; i++) {
        const act = cache.method("get_Item").invoke(i) as Il2Cpp.Object;
        const titleField = act.field("sTitle").value;
        const jumpUIField = act.field("sJumpUI").value;
        const type = Number(act.field("iActivityType").value);

        uniqueTypes.add(type);

        activities.push({
          id: act.field("iActivityId").value,
          type: type,
          title: titleField instanceof Il2Cpp.String ? titleField.content : null,
          showInList: act.field("bShowInList").value,
          isTop: act.field("bIsTop").value,
          isMajor: act.field("bIsMajor").value,
          minLevel: act.field("iMinLevel").value,
          maxLevel: act.field("iMaxLevel").value,
          beginTime: act.field("iBeginTime").value,
          endTime: act.field("iEndTime").value,
          showTimeBegin: act.field("iShowTimeBegin").value,
          showTimeEnd: act.field("iShowTimeEnd").value,
          jumpUI: jumpUIField instanceof Il2Cpp.String ? jumpUIField.content : null
        });
      }

      const dataPath = Il2Cpp.application.dataPath;
      if (dataPath) {
        // 1. Simpan Full Activity Dump
        const activityJson = JSON.stringify(activities, null, 2);
        const actPath = dataPath + "/activities_dump.json";
        const actFile = new (File as any)(actPath, "w");
        actFile.write(activityJson);
        actFile.flush();
        actFile.close();
        console.log(`[+] SUCCESS: Activity JSON saved to: ${actPath}`);

        // 2. Simpan List Unique Types
        const typesList = Array.from(uniqueTypes).sort((a, b) => a - b);
        const typesJson = JSON.stringify(typesList, null, 2);
        const typePath = dataPath + "/unique_activity_types.json";
        const typeFile = new (File as any)(typePath, "w");
        typeFile.write(typesJson);
        typeFile.flush();
        typeFile.close();
        console.log(`[+] SUCCESS: Unique Activity Types saved to: ${typePath}`);
        console.log(`[!] Found ${typesList.length} unique activity types: ${typesList.join(", ")}`);
      }

      console.log("\n--- DUMP COMPLETE ---\n");
    } catch (e) {
      console.log("[-] Dump Error: " + e);
    }
  };

  // ==========================================
  // ACTIVITY DATA COLLECTION (Dynamic)
  // ==========================================
  const dynamicActivitiesMap = new Map<string, any>();
  const dynamicUniqueTypes = new Set<number>();

  /**
   * Fungsi untuk menyimpan hasil dump dinamis ke JSON
   */
  const saveDynamicDump = () => {
    try {
      if (dynamicActivitiesMap.size === 0) return;

      const dataPath = Il2Cpp.application.dataPath;
      if (!dataPath) return;

      const activities = Array.from(dynamicActivitiesMap.values())
        .sort((a, b) => Number(a.id) - Number(b.id));

      const types = Array.from(dynamicUniqueTypes).sort((a, b) => a - b);

      // 1. Simpan Dynamic Activity Dump
      const activityJson = JSON.stringify(activities, null, 2);
      const actPath = dataPath + "/dynamic_activities_dump.json";
      const actFile = new (File as any)(actPath, "w");
      actFile.write(activityJson);
      actFile.flush();
      actFile.close();

      // 2. Simpan Unique Types dari Dynamic Dump
      const typesJson = JSON.stringify(types).replace(/,/g, ", ");
      const typePath = dataPath + "/dynamic_unique_types.json";
      const typeFile = new (File as any)(typePath, "w");
      typeFile.write(typesJson);
      typeFile.flush();
      typeFile.close();

      console.log(`[+] Auto-Dump: ${activities.length} dynamic activities & ${types.length} types saved.`);
    } catch (e) { }
  };

  // Simpan hasil dump dinamis setiap 20 detik jika ada data baru
  setInterval(saveDynamicDump, 20000);

  // ==========================================
  // ACTIVITY PROTOCOL OVERRIDE (Dynamic)
  // ==========================================
  const CmdActivityDataClass = Toolkit.findClass("MTTDProto.CmdActivityData") || Toolkit.findClass("CmdActivityData");
  if (CmdActivityDataClass) {
    const visitMethods = CmdActivityDataClass.methods.filter(m => m.name === "visit");

    visitMethods.forEach(method => {
      const originalVisitAddr = method.virtualAddress;
      method.implementation = function (...args: any[]) {
        // Panggil fungsi asli agar data terisi dari Sdp (Server)
        const originalVisit = new NativeFunction(originalVisitAddr, "void", ["pointer", "pointer", "int"]) as any;
        originalVisit(this.handle, args[0].handle, args[1] ? 1 : 0);

        const instance = this as Il2Cpp.Object;

        // --- DATA COLLECTION (Ambil data sebelum dimodifikasi) ---
        try {
          const rawId = instance.field("iActivityId").value;
          const rawType = Number(instance.field("iActivityType").value);
          const rawTitle = instance.field("sTitle").value;
          const idStr = rawId.toString();

          if (!dynamicActivitiesMap.has(idStr)) {
            dynamicUniqueTypes.add(rawType);
            dynamicActivitiesMap.set(idStr, {
              id: rawId,
              type: rawType,
              title: rawTitle instanceof Il2Cpp.String ? rawTitle.content : null,
              jumpUI: (instance.field("sJumpUI").value as any) instanceof Il2Cpp.String ? (instance.field("sJumpUI").value as any).content : null,
              beginTime: instance.field("iBeginTime").value,
              endTime: instance.field("iEndTime").value,
            });
          }
        } catch (e) { }

        // --- APPLY LOGIC (ID > Type > Global Patch) ---
        // applyLogicToInstance(instance);
      };
    });
  }

  // Panggil dump aktivitas otomatis setelah 15 detik (memberi waktu data loading)
  setTimeout(() => {
    // dumpActivities();
  }, 15000);

  // Initialize System Tip Hooks (Disabled as it may cause UI freeze in some versions)
  // Toolkit.initTipHook();

  // ==========================================
  // CHAT COMMAND PROMPT SYSTEM
  // ==========================================

  const ModState = {
    noCD: false,
    hideName: false,
    lastMenuTime: 0,
  };

  const updateHideName = (hide: boolean) => {
    try {
      let instance: Il2Cpp.Object | null = null;

      // 1. Try to get the instance from BattleData.m_BattleBridge (Most reliable)
      const BattleDataClass = Toolkit.findClass("BattleData");
      if (BattleDataClass) {
        const staticField = BattleDataClass.field("m_BattleBridge");
        if (staticField) {
          const val = staticField.value;
          if (val instanceof Il2Cpp.Object && !val.handle.isNull()) {
            // Ensure it's not actually a Class object wrapper masquerading as an instance
            if ((val as any).isEnum === undefined) {
              instance = val;
              console.log(`[+] Found BattleBridge instance via BattleData: ${instance.handle}`);
            }
          }
        }
      }

      // 2. Fallback to Garbage Collector
      if (!instance) {
        console.log(`[*] Searching for BattleBridge instance via GC...`);
        const BattleBridgeClass = Toolkit.findClass("BattleBridge");
        if (BattleBridgeClass) {
          const instances = Il2Cpp.gc.choose(BattleBridgeClass);
          if (instances.length > 0) {
            instance = instances[0] as Il2Cpp.Object;
            console.log(`[+] Found BattleBridge instance via GC: ${instance.handle}`);
          }
        }
      }

      if (!instance || instance.handle.isNull()) {
        console.log(`[-] Failed to find a valid instance of BattleBridge.`);
        return;
      }

      const method = instance.class.method("HideHeroNameAndFly");
      if (method) {
        console.log(`[*] Invoking HideHeroNameAndFly(${hide}) on instance ${instance.handle}...`);

        try {
          method.invoke(instance, hide as any);
          console.log(`[+] HideHeroNameAndFly(${hide}) invoked successfully via Bridge.`);
        } catch (bridgeError: any) {
          console.log(`[-] Bridge invoke failed: ${bridgeError.message}. Attempting native call...`);
          const nativeFunc = (method as any).nativeFunction;
          if (nativeFunc) {
            // Use 1 for true, 0 for false in native calls for booleans
            nativeFunc(instance.handle, hide ? 1 : 0);
            console.log(`[+] HideHeroNameAndFly(${hide}) invoked successfully via Native Call.`);
          } else {
            throw bridgeError; // Re-throw if no native fallback
          }
        }
      } else {
        console.log(`[-] Method HideHeroNameAndFly NOT FOUND in BattleBridge class.`);
      }
    } catch (e: any) {
      console.log(`[-] HideName Error: ${e.message}`);
    }
  };

  const clearLocalCooldowns = () => {
    try {
      const CoolDownCompClass = Toolkit.findClass("Battle.CoolDownComp");
      if (CoolDownCompClass) {
        const instances = Il2Cpp.gc.choose(CoolDownCompClass);
        instances.forEach(inst => {
          try {
            const owner = (inst as Il2Cpp.Object).method("get_m_Owner").invoke() as Il2Cpp.Object;
            if (owner && !owner.handle.isNull() && owner.method("get_bIsMainEntity").invoke()) {
              (inst as Il2Cpp.Object).method("ClearAllCool").invoke(true as any);
              console.log("[+] Local Cooldowns Cleared.");
            }
          } catch (e) { }
        });
      }
    } catch (e) { }
  };

  Toolkit.intercept("BattleBridge", "HideHeroNameAndFly", (instance, args, original) => {
    let bHide = args[0]
    if (ModState.hideName) {
      return original(true);
    }
    return original();
  });

  const handleCommand = (command: string, bridgeInstance: Il2Cpp.Object) => {
    const cmd = command.toLowerCase();
    const now = Date.now();

    if (cmd === "menu") {
      // Debounce menu to once every 5 seconds to prevent history-reprocessing spam
      if (now - ModState.lastMenuTime > 5000) {
        ModState.lastMenuTime = now;
        const status = `NO CD: ${ModState.noCD ? "ON" : "OFF"}\nHIDE NAME: ${ModState.hideName ? "ON" : "OFF"}`;
        Toolkit.showNativeTip(`${status}\n\nCommands:\n#nocd / #-nocd\n#hide_name / #-hide_name`, "MOD MENU");
      }
    } else if (cmd === "nocd") {
      if (!ModState.noCD) {
        ModState.noCD = true;
        // setInterval(() => clearLocalCooldowns(), 500);
        clearLocalCooldowns();
        Toolkit.showNativeTip("No Cooldown: ENABLED", "MOD CD");
      }
    } else if (cmd === "-nocd") {
      if (ModState.noCD) {
        ModState.noCD = false;
        Toolkit.showNativeTip("No Cooldown: DISABLED", "MOD");
      }
    } else if (cmd === "hide_name") {
      if (!ModState.hideName) {
        ModState.hideName = true;
        updateHideName(true);
        Toolkit.showNativeTip("Hide Name: ENABLED", "MOD");
      }
    } else if (cmd === "-hide_name") {
      if (ModState.hideName) {
        ModState.hideName = false;
        updateHideName(false);
        Toolkit.showNativeTip("Hide Name: DISABLED", "MOD");
      }
    }
  };

  let isProcessingCommand = false;
  let lastProcessedCmdString = "";

  const BattleBridgeClass = Toolkit.findClass("BattleBridge");
  if (BattleBridgeClass) {
    const showChat = BattleBridgeClass.method("ShowChatHistoryText");
    if (showChat) {
      console.log("[+] Hooking ShowChatHistoryText for commands...");
      const originalShowChat = showChat.virtualAddress;

      showChat.implementation = function (text: Il2Cpp.Parameter.Type) {
        // 1. Re-entrancy guard to prevent infinite loops if showNativeTip triggers a chat refresh
        if (isProcessingCommand) {
          return showChat.invoke(this as any, text);
        }

        const textObj = new Il2Cpp.String(text as NativePointer);
        const content = textObj.content;

        // 2. Only process if content has changed and contains a command
        if (content && content.includes("#")) {
          const matches = content.match(/#([-a-zA-Z0-9_]+)/g);
          if (matches && matches.length > 0) {
            const latestCmd = matches[matches.length - 1]; // Get the most recent command in the history

            // 3. Only trigger if the latest command is actually new
            if (latestCmd && latestCmd !== lastProcessedCmdString) {
              lastProcessedCmdString = latestCmd;

              isProcessingCommand = true;
              try {
                handleCommand(latestCmd.substring(1), this as any);
              } catch (e) {
                console.log(`[-] Command Error: ${e}`);
              } finally {
                isProcessingCommand = false;
              }
            }
          }
        }

        // 4. Always call original to ensure game functions normally
        try {
          return showChat.invoke(this as any, text);
        } catch (e) {
          const nativeFunc = new NativeFunction(originalShowChat, "void", ["pointer", "pointer"]);
          nativeFunc(this.handle, text as NativePointer);
        }
      };
    }
  }

  // Hook for No CD
  const CoolDownCompClass = Toolkit.findClass("Battle.CoolDownComp");
  if (CoolDownCompClass) {
    const isCoolDown = CoolDownCompClass.method("IsCoolDown", 1);
    if (isCoolDown) {
      console.log("[+] Hooking CoolDownComp::IsCoolDown for NoCD mod...");
      isCoolDown.implementation = function (spellId: Il2Cpp.Parameter.Type) {
        if (ModState.noCD) {
          try {
            const owner = (this as Il2Cpp.Object).method("get_m_Owner").invoke() as Il2Cpp.Object;
            if (owner && !owner.handle.isNull()) {
              const isMain = owner.method("get_bIsMainEntity").invoke();
              if (isMain) return false;
            }
          } catch (e) { }
        }
        return isCoolDown.invoke(this as any, spellId);
      };
    }
  }

  // ==========================================
  // EXAMPLE: CALL METHOD WITH DUMMY LUA CALLBACK (INTERCEPTED VIA HOOK)
  // ==========================================
  // console.log("[+] Helper added: showCustomTip(message, title)");
});


