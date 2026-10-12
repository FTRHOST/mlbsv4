/**
 * Free Skin Hook Module
 */

import { sessionState } from "../tools/config";
import { debugLog } from "../tools/utils";

export function setupSkinHooks(Assembly) {
  // Inisialisasi Kelas (Semua 'assembly' telah diganti menjadi 'Assembly')
  const SystemData = Assembly.class("SystemData");
  const CmdHeroSkin = Assembly.class("MTTDProto.CmdHeroSkin");
  const CmdHeroStatue = Assembly.class("MTTDProto.CmdHeroStatue");
  const ChooseHeroMgr = Assembly.class("ChooseHeroMgr");
  const UIChooseHero = Assembly.class("UIChooseHero");
  const BattleReceiveMessage = Assembly.class("BattleReceiveMessage");
  const UIRankHero = Assembly.class("UIRankHero");
  const ChangeShow = Assembly.class("UIRankHero/ChangeShow"); // 1. Ambil referensi ke kelas dan metodenya

  const BActFreeSkin = ChooseHeroMgr.method("BActFreeSkin");
  const IsSkinUseable = ChooseHeroMgr.method("IsSkinUseable");
  const CanSelectSkin = UIChooseHero.method("CanSelectSkin");

  /*BActFreeSkin.implementation = function () {
    return true;
  };*/

  /*CanSelectSkin.implementation = function () {
    return true;
  };

  IsSkinUseable.implementation = function () {
    return true;
  };*/

  /* let m_SkinID = 0;
  let m_HeroID = 0;

 const sss = ChooseHeroMgr.method("SendSelectSkin");
  Interceptor.attach(sss.virtualAddress, {
    onEnter(args) {
      if (args && args[1] && args[2]) {
        const skinid = args[1].toInt32();
        const heroid = args[2].toInt32();
        if (skinid > 0) {
          m_SkinID = skinid;
          m_HeroID = heroid;
          console.log(`[Lobby] Memilih Skin: ${skinid}`);
        }
        args[1] = ptr(0);
      }
    },
  });

  const getUiID = () => {
    try {
      const val = SystemData.field("m_uiID").value;
      if (val !== null && val !== undefined) return val.toString();
    } catch (e) {
      try {
        const instances = Il2Cpp.gc.choose(SystemData);
        if (instances && instances.length > 0 && instances[0]) {
          const iVal = instances[0].field("m_uiID").value;
          if (iVal !== null && iVal !== undefined) return iVal.toString();
        }
      } catch (e2) {}
    }
    return "0";
  };
  */
  /*
  // --- MODIFIKASI SISTEM SKIN & STATUE (JAVASCRIPT MODE) ---
  SystemData.method("GetHeroSkin").implementation = function (
    m_heroskins,
    skinid,
  ) {
    const ret = this.method("GetHeroSkin").invoke(m_heroskins, skinid);
    if (!ret.handle.isNull() && ret.handle.toInt32() > 0x100) return ret;
    const instance = CmdHeroSkin.alloc();
    instance.method(".ctor").invoke();
    instance.field("iId").value = skinid;
    instance.field("iLimitTime").value = 0;
    instance.field("iSource").value = 0;
    return instance;
  };

  SystemData.method("IsHaveSkin").implementation = function (skinid) {
    const ret = this.method("IsHaveSkin").invoke(skinid);
    if (!ret.handle.isNull() && ret.handle.toInt32() > 0x100) return ret;
    const instance = CmdHeroSkin.alloc();
    instance.method(".ctor").invoke();
    instance.field("iId").value = skinid;
    instance.field("iLimitTime").value = 0;
    instance.field("iSource").value = 0;
    return instance;
  };

  SystemData.method("IsHaveSkinForever").implementation = function (skinid) {
    const ret = this.method("IsHaveSkinForever").invoke(skinid);
    if (!ret.handle.isNull() && ret.handle.toInt32() > 0x100) return ret;
    const instance = CmdHeroSkin.alloc();
    instance.method(".ctor").invoke();
    instance.field("iId").value = skinid;
    instance.field("iLimitTime").value = 0;
    instance.field("iSource").value = 0;
    return instance;
  };

  SystemData.method("IsHaveStatue").implementation = function (statueid) {
    const ret = this.method("IsHaveStatue").invoke(statueid);
    if (!ret.handle.isNull() && ret.handle.toInt32() > 0x100) return ret;
    const instance = CmdHeroStatue.alloc();
    instance.method(".ctor").invoke();
    instance.field("iId").value = statueid;
    instance.field("iLimitTime").value = 0;
    instance.field("iSource").value = 0;
    return instance;
  };

  SystemData.method("IsHaveStatueForever").implementation = function (
    statueid,
  ) {
    const ret = this.method("IsHaveStatueForever").invoke(statueid);
    if (!ret.handle.isNull() && ret.handle.toInt32() > 0x100) return ret;
    const instance = CmdHeroStatue.alloc();
    instance.method(".ctor").invoke();
    instance.field("iId").value = statueid;
    instance.field("iLimitTime").value = 0;
    instance.field("iSource").value = 0;
    return instance;
  };

  SystemData.method("GetHeroHolyStatue").implementation = function (
    m_herostatues,
    statueid,
  ) {
    const ret = this.method("GetHeroHolyStatue").invoke(
      m_herostatues,
      statueid,
    );
    if (!ret.handle.isNull() && ret.handle.toInt32() > 0x100) return ret;
    const instance = CmdHeroStatue.alloc();
    instance.method(".ctor").invoke();
    instance.field("iId").value = statueid;
    instance.field("iLimitTime").value = 0;
    instance.field("iSource").value = 0;
    return instance;
  };

  UIChooseHero.method("BatttleSelectSkin").implementation = function (
    uid,
    skinid,
  ) {
    const myUiId = getUiID();
    if (uid.toString() === myUiId && m_SkinID > 0) {
      return this.method("BatttleSelectSkin").invoke(uid, m_SkinID);
    }
    return this.method("BatttleSelectSkin").invoke(uid, skinid);
  };

const setPlayerData = BattleReceiveMessage.method("SetPlayerData").overload("MTTDProto.BattlePlayerInfo", "System.UInt32");

Interceptor.attach(setPlayerData.virtualAddress, {
    onEnter(args) {
        if (!args || !args[1]) return;
        
        const playerInfoHandle = args[1];
        // Menggunakan compare ptr agar aman di arsitektur 32-bit maupun 64-bit
        if (playerInfoHandle.isNull() || playerInfoHandle.compare(ptr(0x1000)) < 0) return;

        try {
            const info = new Il2Cpp.Object(playerInfoHandle);
            const lUid = info.field("lUid").value.toString();
            const myUiId = getUiID(); // Pastikan fungsi getUiID() mengembalikan string

            // Pastikan m_SkinID ada dan valid
            if (typeof m_SkinID !== 'undefined' && m_SkinID !== 0 && lUid === myUiId.toString()) {
                
                // Gunakan casting atau penulisan langsung sesuai kebutuhan il2cpp-bridge
                info.field("uiSkinId").value = m_SkinID;
                
                try {
                    info.field("uiHeroSkinIDChoose").value = m_SkinID;
                } catch (e) {
                    // Field uiHeroSkinIDChoose mungkin tidak ada di struktur class
                }
                
                // Memperbaiki string literal menggunakan backtick
                console.log(`[BattleInject] Berhasil menyuntik Skin ${m_SkinID} ke UID ${lUid}`);
            }
        } catch (e) {
            // console.error(`[Error] Terjadi kesalahan saat membaca object: ${e}`);
        }
    }
});*/

  // ===== PRIVATE SERVER (dataServer.json) =====
  // Alur: UnlockAll() -> scan katalog -> simpan dataServer.json.
  // Hook CData_HeroCostume_Element.GetMaxDataLength (onLeave) membaca JSON
  // ini dari memori lalu grant hero+skin secara batch (anti-freeze).
  const DATASERVER_FILENAME = "dataServer.json";

  const dataServerCandidates = function () {
    const cands = [];
    let persistentPath = "";
    try {
      const appCls = findClass("UnityEngine.Application");
      if (appCls) {
        const m = appCls.tryMethod("get_persistentDataPath");
        if (m) {
          const p = m.invoke();
          if (p && !p.isNull() && p.content) persistentPath = p.content;
        }
      }
    } catch {}
    if (persistentPath) cands.push(`${persistentPath}/${DATASERVER_FILENAME}`);

    // Deteksi package asli dari persistentPath, fallback com.mobile.legends
    const packagesToTry = new Set();
    if (persistentPath) {
      const match = persistentPath.match(/Android\/data\/([^\/]+)/);
      if (match && match[1]) packagesToTry.add(match[1]);
    }
    packagesToTry.add("com.mobile.legends");
    for (const pkg of packagesToTry) {
      cands.push(`/sdcard/Android/data/${pkg}/files/${DATASERVER_FILENAME}`);
      cands.push(
        `/storage/emulated/0/Android/data/${pkg}/files/${DATASERVER_FILENAME}`,
      );
    }
    return Array.from(new Set(cands.filter(Boolean)));
  };

  // Error terakhir operasi file private-server (untuk dbgDataServer).
  let lastDataServerError = "";

  const tryReadFile = function (targetFilePath) {
    if (!targetFilePath) return null;
    // NOTE: jangan gate di Exists — langsung coba ReadAllText agar exception
    // aslinya terlihat (Exists yang gagal diam-diam = "tidak ditemukan" palsu).
    try {
      const SystemFile = findClass("System.IO.File");
      if (!SystemFile) throw new Error("class System.IO.File tidak ditemukan");
      try {
        const txt = SystemFile.method("ReadAllText").invoke(
          Il2Cpp.string(targetFilePath),
        );
        if (txt && !txt.isNull() && txt.content) return txt.content;
        lastDataServerError = `ReadAllText ${targetFilePath}: kosong/null`;
      } catch (e) {
        lastDataServerError = `ReadAllText ${targetFilePath}: ${e}`;
      }
    } catch (e) {
      lastDataServerError = `System.IO.File ${targetFilePath}: ${e}`;
    }
    return null;
  };

  // State private server di memori (dimuat sekali saat init + tiap save).
  let serverPairs = [];
  let serverHeroes = [];
  let serverDataPath = "";
  let serverApplyTimer = null;
  let serverLastApply = 0;
  const SERVER_APPLY_COOLDOWN_MS = 15000;

  // Inject semua pair ke paket server (gate UnlockAll == curSkinOverrides).
  // Matikan via serverFullInject(false) bila terasa hitch saat buka hero list.
  let serverFullInject = true;

  // Set unlock gabungan (serverPairs + curSkinOverrides) untuk gate hook.
  let unlockedSkins = new Set();
  let skinToHero = new Map();

  const rebuildUnlockSets = function () {
    const us = new Set();
    const mp = new Map();
    try {
      for (const pr of serverPairs) {
        if (!pr) continue;
        us.add(pr[1]);
        if (!mp.has(pr[1])) mp.set(pr[1], pr[0]);
      }
      curSkinOverrides.forEach((skinId, heroId) => {
        us.add(skinId);
        if (!mp.has(skinId)) mp.set(skinId, heroId);
      });
    } catch {}
    unlockedSkins = us;
    skinToHero = mp;
  };

  coreRef.current = {
    curSkinOverrides,
    applyCurSkinOverrides,
    rebuildUnlockSets,
  };

  globalThis.serverFullInject = function (on) {
    if (on !== undefined) serverFullInject = !!on;
    return serverFullInject;
  };

  // Baca + parse dataServer.json (dipakai loadDataServer & saveCurSkins).
  const readServerJson = function () {
    const rawCands = dataServerCandidates();
    const cands = serverDataPath
      ? [serverDataPath, ...rawCands.filter((c) => c !== serverDataPath)]
      : rawCands;
    for (const c of cands) {
      try {
        const txt = tryReadFile(c);
        if (!txt) continue;
        return { obj: JSON.parse(txt), path: c };
      } catch {}
    }
    return null;
  };

  const loadDataServer = function () {
    // Path tulis-terakhir yang terverifikasi dicoba paling dulu.
    const rawCands = dataServerCandidates();
    const cands = serverDataPath
      ? [serverDataPath, ...rawCands.filter((c) => c !== serverDataPath)]
      : rawCands;
    for (const c of cands) {
      try {
        const txt = tryReadFile(c);
        if (!txt) continue;
        const obj = JSON.parse(txt);
        const pairs = [];
        if (Array.isArray(obj.pairs)) {
          for (const p of obj.pairs) {
            if (Array.isArray(p) && p.length >= 2) {
              const h = Number(p[0]);
              const s = Number(p[1]);
              if (Number.isFinite(h) && Number.isFinite(s)) pairs.push([h, s]);
            }
          }
        }
        if (pairs.length === 0) {
          console.log(`[PRIVATE-SERVER] ${c} tidak berisi pairs valid.`);
          continue;
        }
        serverPairs = pairs;
        serverHeroes = Array.isArray(obj.heroes)
          ? obj.heroes.map(Number).filter(Number.isFinite)
          : [];
        serverDataPath = c;

        // Restore state m_curSkinId yang tersimpan (curSkins).
        try {
          const cs = obj.curSkins;
          if (cs && typeof cs === "object") {
            let n = 0;
            for (const [k, v] of Object.entries(cs)) {
              const h = Number(k);
              const s = Number(v);
              if (Number.isFinite(h) && Number.isFinite(s) && h > 0 && s > 0) {
                curSkinOverrides.set(h, s);
                n++;
              }
            }
            if (n > 0) {
              console.log(`[CURSKIN] restore ${n} curSkins dari ${c}`);
              try {
                applyCurSkinOverrides();
              } catch {}
            }
          }
        } catch {}
        rebuildUnlockSets();
        console.log(
          `[PRIVATE-SERVER] dimuat ${pairs.length} pairs (${serverHeroes.length} hero) dari ${c}`,
        );
        return { success: true, path: c, pairs: pairs.length };
      } catch {}
    }
    console.log(
      `[PRIVATE-SERVER] dataServer.json tidak ditemukan${lastDataServerError ? " (" + lastDataServerError + ")" : ""}. Jalankan UnlockAll() dulu untuk membuatnya.`,
    );
    return { success: false };
  };

  const saveDataServer = function () {
    try {
      const { heroes, pairs } = collectCostumePairs();
      if (pairs.length === 0) {
        console.log(
          "[PRIVATE-SERVER] katalog kosong (tabel belum ke-load). Buka layar hero/collection dulu, lalu ulangi UnlockAll().",
        );
        return { success: false, error: "katalog kosong" };
      }
      const cur = {};
      try {
        curSkinOverrides.forEach((skinId, heroId) => {
          cur[String(heroId)] = skinId;
        });
      } catch {}

      const payload = JSON.stringify(
        { version: 1, savedAt: Date.now(), heroes, pairs, curSkins: cur },
        null,
        2,
      );
      const cands = dataServerCandidates();
      for (const c of cands) {
        if (tryWriteFile(c, payload)) {
          // Verifikasi baca-balik: klaim sukses hanya bila isinya terbaca.
          const back = tryReadFile(c);
          if (back && back.length > 0) {
            serverDataPath = c;
            console.log(
              `[PRIVATE-SERVER] tersimpan ${pairs.length} pairs (${heroes.length} hero) -> ${c}`,
            );
            loadDataServer(); // reload ke memori agar hook langsung pakai data baru
            return { success: true, path: c, pairs: pairs.length };
          }
          console.log(
            `[PRIVATE-SERVER] tulis ke ${c} tidak terverifikasi (baca balik gagal${lastDataServerError ? ": " + lastDataServerError : ""}), coba path berikut...`,
          );
        }
      }
      return {
        success: false,
        error: "gagal tulis ke semua kandidat: " + cands.join(", "),
      };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  };

  // Batch kilat: 400 pairs / 30ms (~1-2 dtk untuk 1733 pairs).
  const SERVER_BATCH_SIZE = 400;
  const SERVER_BATCH_DELAY_MS = 30;

  const applyServerPairsFast = function (pairs, onDone) {
    const resolveDict = function () {
      try {
        const dict = SystemData.field("m_heroInfos").value;
        if (!dict || dict.isNull()) return null;
        return {
          dict,
          mContains: dict.method("ContainsKey"),
          mGet: dict.method("get_Item"),
          mSet: dict.method("set_Item"),
        };
      } catch {
        return null;
      }
    };

    let resolved = resolveDict();
    if (!resolved) {
      onDone();
      return;
    }

    // Snapshot per hero: { list, owned } — di-reset bila objek dict berganti.
    let dictHandle = String(resolved.dict.handle);
    let heroCache = new Map();

    const ensureHero = function (r, heroId) {
      const hit = heroCache.get(heroId);
      if (hit) return hit;
      try {
        if (!r.mContains.invoke(heroId)) {
          const inst = HeroKeyInfoCls.alloc();
          try {
            inst.method(".ctor").invoke();
          } catch {}
          try {
            inst.field("m_heroID").value = heroId;
          } catch {}
          try {
            r.mSet.invoke(heroId, inst);
          } catch {}
        }
        const hki = r.mGet.invoke(heroId);
        if (!hki || hki.isNull()) return null;
        let list = hki.field("m_heroskins").value;
        if (!list || list.isNull()) {
          try {
            const initM = hki.tryMethod("Init");
            if (initM) initM.invoke();
          } catch {}
          try {
            list = hki.field("m_heroskins").value;
          } catch {}
          if (!list || list.isNull()) return null;
        }
        const mCount = list.method("get_Count");
        const mItem = list.method("get_Item");
        const owned = new Set();
        const cnt = mCount.invoke();
        for (let j = 0; j < cnt; j++) {
          try {
            const it = mItem.invoke(j);
            if (it && !it.isNull()) {
              owned.add(Number(it.field("iId").value));
              try {
                if (!it.field("bSmartMagicUnlock").value)
                  it.field("bSmartMagicUnlock").value = true;
              } catch {}
            }
          } catch {}
        }
        const entry = { list, mAdd: list.method("Add"), owned };
        heroCache.set(heroId, entry);
        return entry;
      } catch {
        return null;
      }
    };

    let i = 0;
    const step = function () {
      try {
        try {
          const cur = SystemData.field("m_heroInfos").value;
          if (!cur || cur.isNull() || String(cur.handle) !== dictHandle) {
            resolved = resolveDict();
            if (!resolved) {
              serverApplyTimer = null;
              onDone();
              return;
            }
            dictHandle = String(resolved.dict.handle);
            heroCache = new Map();
          }
        } catch {}
        if (!resolved) {
          serverApplyTimer = null;
          onDone();
          return;
        }
        const r = resolved;
        const end = Math.min(i + SERVER_BATCH_SIZE, pairs.length);
        for (; i < end; i++) {
          const pr = pairs[i];
          if (!pr) continue;
          try {
            const entry = ensureHero(r, pr[0]);
            if (!entry || entry.owned.has(pr[1])) continue;
            const inst = CmdHeroSkin.alloc();
            try {
              inst.method(".ctor").invoke();
            } catch {}
            try {
              inst.field("iId").value = pr[1];
            } catch {}
            try {
              inst.field("bSmartMagicUnlock").value = true;
            } catch {}
            entry.mAdd.invoke(inst);
            entry.owned.add(pr[1]);
          } catch {}
        }
        if (i < pairs.length) {
          serverApplyTimer = setTimeout(step, SERVER_BATCH_DELAY_MS);
        } else {
          serverApplyTimer = null;
          try {
            applyCurSkinOverrides();
          } catch {}
          onDone();
        }
      } catch (e) {
        serverApplyTimer = null;
        console.log("[PRIVATE-SERVER][!] batch gagal: " + e);
        onDone();
      }
    };
    step();
  };

  // Grant batch dari serverPairs (guard: skip bila batch jalan).
  const applyDataServer = function () {
    if (serverApplyTimer) return;
    if (serverPairs.length === 0) {
      const r = loadDataServer();
      if (!r.success || serverPairs.length === 0) return;
    }
    try {
      const d0 = SystemData.field("m_heroInfos").value;
      const c0 = !d0 || d0.isNull() ? 0 : d0.method("get_Count").invoke();
      if (c0 === 0) {
        console.log(
          "[PRIVATE-SERVER] m_heroInfos kosong/belum siap, apply ditunda.",
        );
        return;
      }
    } catch {}
    serverLastApply = Date.now();
    const pairs = serverPairs.slice();
    console.log(
      `[PRIVATE-SERVER] apply ${pairs.length} pairs (${SERVER_BATCH_SIZE}/${SERVER_BATCH_DELAY_MS}ms)...`,
    );
    applyServerPairsFast(pairs, () => {
      console.log(`[PRIVATE-SERVER] SELESAI ${pairs.length} pairs.`);
    });
  };

  console.log(
    "[+] Skin & Statue System Hooked Successfully with 'Assembly' variable.",
  );
}
