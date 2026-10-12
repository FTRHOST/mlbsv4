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

  // src/ToolLeak/unlock-skin/context.ts
  function resolveOptions(opts) {
    return {
      dataFileName: opts?.dataFileName ?? "dataServer.json",
      autoLoad: opts?.autoLoad ?? true,
      enableAutoApplyTrigger: opts?.enableAutoApplyTrigger ?? true,
      curSkinReapplyMs: opts?.curSkinReapplyMs ?? 3e3,
      serverApplyCooldownMs: opts?.serverApplyCooldownMs ?? 15e3,
      batchSize: opts?.batchSize ?? 400,
      batchDelayMs: opts?.batchDelayMs ?? 30,
      log: opts?.log ?? ((...a) => console.log(...a)),
    };
  }
  function createCtx(asm, opts) {
    const SystemData = asm.image.class("SystemData");
    const CmdHeroSkin = asm.image.class("MTTDProto.CmdHeroSkin");
    let HeroKeyInfoCls = null;
    try {
      HeroKeyInfoCls = asm.image.class("SystemData/HeroKeyInfo");
    } catch {}
    let CDataHeroCostume = null;
    try {
      CDataHeroCostume = asm.image.class("CData_HeroCostume_Element");
    } catch {}
    return {
      asm,
      SystemData,
      CmdHeroSkin,
      HeroKeyInfoCls,
      CDataHeroCostume,
      opts: resolveOptions(opts),
      curSkinOverrides: /* @__PURE__ */ new Map(),
      serverPairs: [],
      serverHeroes: [],
      serverDataPath: "",
      serverFullInject: true,
      unlockedSkins: /* @__PURE__ */ new Set(),
      skinToHero: /* @__PURE__ */ new Map(),
      serverApplyTimer: null,
      serverLastApply: 0,
      lastDataServerError: "",
      curSkinSaveTimer: null,
    };
  }
  function rebuildUnlockSets(ctx) {
    const us = /* @__PURE__ */ new Set();
    const mp = /* @__PURE__ */ new Map();
    try {
      for (const pr of ctx.serverPairs) {
        if (!pr) continue;
        us.add(pr[1]);
        if (!mp.has(pr[1])) mp.set(pr[1], pr[0]);
      }
      ctx.curSkinOverrides.forEach((skinId, heroId) => {
        us.add(skinId);
        if (!mp.has(skinId)) mp.set(skinId, heroId);
      });
    } catch {}
    ctx.unlockedSkins = us;
    ctx.skinToHero = mp;
  }

  // src/ToolLeak/unlock-skin/grant.ts
  function grantHero(ctx, heroId) {
    try {
      const dict = ctx.SystemData.field("m_heroInfos").value;
      if (!dict || dict.isNull() || !ctx.HeroKeyInfoCls) return;
      let has = false;
      try {
        has = dict.method("ContainsKey").invoke(heroId);
      } catch {}
      if (has) return;
      const inst = ctx.HeroKeyInfoCls.alloc();
      try {
        inst.method(".ctor").invoke();
      } catch {}
      try {
        const initM = inst.tryMethod("Init");
        if (initM) initM.invoke();
      } catch {}
      try {
        inst.field("m_heroID").value = heroId;
      } catch {}
      try {
        dict.method("set_Item").invoke(heroId, inst);
      } catch {}
    } catch {}
  }
  function grantSkin(ctx, heroId, skinId) {
    try {
      const dict = ctx.SystemData.field("m_heroInfos").value;
      if (!dict || dict.isNull()) return;
      let hki;
      try {
        hki = dict.method("get_Item").invoke(heroId);
      } catch {
        return;
      }
      if (!hki || hki.isNull()) return;
      let list = hki.field("m_heroskins").value;
      if (!list || list.isNull()) {
        try {
          const initM = hki.tryMethod("Init");
          if (initM) initM.invoke();
        } catch {}
        try {
          list = hki.field("m_heroskins").value;
        } catch {}
        if (!list || list.isNull()) return;
      }
      const cnt = list.method("get_Count").invoke();
      for (let i = 0; i < cnt; i++) {
        try {
          const it = list.method("get_Item").invoke(i);
          if (!it.isNull() && it.field("iId").value === skinId) {
            try {
              it.field("bSmartMagicUnlock").value = true;
            } catch {}
            return;
          }
        } catch {}
      }
      const inst = ctx.CmdHeroSkin.alloc();
      try {
        inst.method(".ctor").invoke();
      } catch {}
      try {
        inst.field("iId").value = skinId;
      } catch {}
      try {
        inst.field("bSmartMagicUnlock").value = true;
      } catch {}
      list.method("Add").invoke(inst);
    } catch {}
  }
  function collectCostumePairs(ctx) {
    const heroSet = /* @__PURE__ */ new Set();
    const pairSet = /* @__PURE__ */ new Set();
    const pairs = [];
    try {
      if (!ctx.CDataHeroCostume) return { heroes: [], pairs };
      const instances = Il2Cpp.gc.choose(ctx.CDataHeroCostume);
      for (const instance of instances) {
        try {
          if (!instance || instance.isNull()) continue;
          const heroId = Number(instance.field("m_HeroId").value);
          const skinId = Number(instance.field("m_ID").value);
          if (!Number.isFinite(heroId) || !Number.isFinite(skinId)) continue;
          heroSet.add(heroId);
          const k = `${heroId}:${skinId}`;
          if (!pairSet.has(k)) {
            pairSet.add(k);
            pairs.push([heroId, skinId]);
          }
        } catch {}
      }
    } catch {}
    return { heroes: Array.from(heroSet), pairs };
  }
  function unlockAll(ctx) {
    const { pairs } = collectCostumePairs(ctx);
    let granted = 0;
    for (const [heroId, skinId] of pairs) {
      try {
        grantHero(ctx, heroId);
        grantSkin(ctx, heroId, skinId);
        granted++;
      } catch (error) {
        console.error("Gagal grant pasangan hero-skin:", heroId, skinId, error);
      }
    }
    ctx.opts.log(`[UNLOCK] granted ${granted}/${pairs.length} pasangan.`);
    return {
      heroes: new Set(pairs.map((p) => p[0])).size,
      pairs: pairs.length,
    };
  }
  function applyServerPairsFast(ctx, pairs, onDone) {
    const resolveDict = function () {
      try {
        const dict = ctx.SystemData.field("m_heroInfos").value;
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
    let dictHandle = String(resolved.dict.handle);
    let heroCache = /* @__PURE__ */ new Map();
    const ensureHero = function (r, heroId) {
      const hit = heroCache.get(heroId);
      if (hit) return hit;
      try {
        if (!r.mContains.invoke(heroId)) {
          if (!ctx.HeroKeyInfoCls) return null;
          const inst = ctx.HeroKeyInfoCls.alloc();
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
        const owned = /* @__PURE__ */ new Set();
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
          const cur = ctx.SystemData.field("m_heroInfos").value;
          if (!cur || cur.isNull() || String(cur.handle) !== dictHandle) {
            resolved = resolveDict();
            if (!resolved) {
              ctx.serverApplyTimer = null;
              onDone();
              return;
            }
            dictHandle = String(resolved.dict.handle);
            heroCache = /* @__PURE__ */ new Map();
          }
        } catch {}
        if (!resolved) {
          ctx.serverApplyTimer = null;
          onDone();
          return;
        }
        const r = resolved;
        const end = Math.min(i + ctx.opts.batchSize, pairs.length);
        for (; i < end; i++) {
          const pr = pairs[i];
          if (!pr) continue;
          try {
            const entry = ensureHero(r, pr[0]);
            if (!entry || entry.owned.has(pr[1])) continue;
            const inst = ctx.CmdHeroSkin.alloc();
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
          ctx.serverApplyTimer = setTimeout(step, ctx.opts.batchDelayMs);
        } else {
          ctx.serverApplyTimer = null;
          onDone();
        }
      } catch (e) {
        ctx.serverApplyTimer = null;
        ctx.opts.log("[PRIVATE-SERVER][!] batch gagal: " + e);
        onDone();
      }
    };
    step();
  }

  // src/ToolLeak/unlock-skin/file-utils.ts
  function findClass(asm, name) {
    try {
      const direct = asm.image.tryClass(name);
      if (direct) return direct;
    } catch {}
    try {
      for (const a of Il2Cpp.domain.assemblies) {
        try {
          const c = a.image.tryClass(name);
          if (c) return c;
        } catch {}
      }
    } catch {}
    return null;
  }
  function persistentDataPath(asm) {
    try {
      const appCls = findClass(asm, "UnityEngine.Application");
      if (appCls) {
        const m = appCls.tryMethod("get_persistentDataPath");
        if (m) {
          const p = m.invoke();
          if (p && !p.isNull() && p.content) return p.content;
        }
      }
    } catch {}
    return "";
  }
  function tryWriteFile(asm, targetFilePath, content) {
    if (!targetFilePath) return false;
    try {
      const lastSlash = targetFilePath.lastIndexOf("/");
      if (lastSlash > 0) {
        const dirPath = targetFilePath.substring(0, lastSlash);
        try {
          const SystemDir = findClass(asm, "System.IO.Directory");
          SystemDir?.method("CreateDirectory").invoke(Il2Cpp.string(dirPath));
        } catch {}
      }
      try {
        const SystemFile = findClass(asm, "System.IO.File");
        if (!SystemFile)
          throw new Error("class System.IO.File tidak ditemukan");
        SystemFile.method("WriteAllText").invoke(
          Il2Cpp.string(targetFilePath),
          Il2Cpp.string(content),
        );
        return true;
      } catch {}
      try {
        const FridaFile = globalThis.File;
        if (FridaFile) {
          const f = new FridaFile(targetFilePath, "w");
          f.write(content);
          f.flush();
          f.close();
          return true;
        }
      } catch {}
    } catch {}
    return false;
  }
  function tryReadFile(ctx, targetFilePath) {
    if (!targetFilePath) return null;
    try {
      const SystemFile = findClass(ctx.asm, "System.IO.File");
      if (!SystemFile) throw new Error("class System.IO.File tidak ditemukan");
      try {
        const txt = SystemFile.method("ReadAllText").invoke(
          Il2Cpp.string(targetFilePath),
        );
        if (txt && !txt.isNull() && txt.content) return txt.content;
        ctx.lastDataServerError = `ReadAllText ${targetFilePath}: kosong/null`;
      } catch (e) {
        ctx.lastDataServerError = `ReadAllText ${targetFilePath}: ${e}`;
      }
    } catch (e) {
      ctx.lastDataServerError = `System.IO.File ${targetFilePath}: ${e}`;
    }
    return null;
  }
  function dataServerCandidates(ctx) {
    const cands = [];
    const persistentPath = persistentDataPath(ctx.asm);
    if (persistentPath)
      cands.push(`${persistentPath}/${ctx.opts.dataFileName}`);
    const packagesToTry = /* @__PURE__ */ new Set();
    if (persistentPath) {
      const match = persistentPath.match(/Android\/data\/([^\/]+)/);
      if (match && match[1]) packagesToTry.add(match[1]);
    }
    packagesToTry.add("com.mobile.legends");
    for (const pkg of packagesToTry) {
      cands.push(`/sdcard/Android/data/${pkg}/files/${ctx.opts.dataFileName}`);
      cands.push(
        `/storage/emulated/0/Android/data/${pkg}/files/${ctx.opts.dataFileName}`,
      );
    }
    return Array.from(new Set(cands.filter(Boolean)));
  }
  function readServerJson(ctx) {
    const rawCands = dataServerCandidates(ctx);
    const cands = ctx.serverDataPath
      ? [
          ctx.serverDataPath,
          ...rawCands.filter((c) => c !== ctx.serverDataPath),
        ]
      : rawCands;
    for (const c of cands) {
      try {
        const txt = tryReadFile(ctx, c);
        if (!txt) continue;
        return { obj: JSON.parse(txt), path: c };
      } catch {}
    }
    return null;
  }

  // src/ToolLeak/unlock-skin/server-store.ts
  function loadDataServer(ctx) {
    const rawCands = dataServerCandidates(ctx);
    const cands = ctx.serverDataPath
      ? [
          ctx.serverDataPath,
          ...rawCands.filter((c) => c !== ctx.serverDataPath),
        ]
      : rawCands;
    for (const c of cands) {
      try {
        const txt = tryReadFile(ctx, c);
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
          ctx.opts.log(`[PRIVATE-SERVER] ${c} tidak berisi pairs valid.`);
          continue;
        }
        ctx.serverPairs = pairs;
        ctx.serverHeroes = Array.isArray(obj.heroes)
          ? obj.heroes.map(Number).filter(Number.isFinite)
          : [];
        ctx.serverDataPath = c;
        try {
          const cs = obj.curSkins;
          if (cs && typeof cs === "object") {
            let n = 0;
            for (const [k, v] of Object.entries(cs)) {
              const h = Number(k);
              const s = Number(v);
              if (Number.isFinite(h) && Number.isFinite(s) && h > 0 && s > 0) {
                ctx.curSkinOverrides.set(h, s);
                n++;
              }
            }
            if (n > 0) {
              ctx.opts.log(`[CURSKIN] restore ${n} curSkins dari ${c}`);
              try {
                applyCurSkinOverrides(ctx);
              } catch {}
            }
          }
        } catch {}
        rebuildUnlockSets(ctx);
        ctx.opts.log(
          `[PRIVATE-SERVER] dimuat ${pairs.length} pairs (${ctx.serverHeroes.length} hero) dari ${c}`,
        );
        return { success: true, path: c, pairs: pairs.length };
      } catch {}
    }
    ctx.opts.log(
      `[PRIVATE-SERVER] ${ctx.opts.dataFileName} tidak ditemukan${ctx.lastDataServerError ? " (" + ctx.lastDataServerError + ")" : ""}. Jalankan UnlockAll() dulu untuk membuatnya.`,
    );
    return { success: false };
  }
  function saveDataServer(ctx) {
    try {
      const { heroes, pairs } = collectCostumePairs(ctx);
      if (pairs.length === 0) {
        ctx.opts.log(
          "[PRIVATE-SERVER] katalog kosong (tabel belum ke-load). Buka layar hero/collection dulu, lalu ulangi UnlockAll().",
        );
        return { success: false, error: "katalog kosong" };
      }
      const cur = {};
      try {
        ctx.curSkinOverrides.forEach((skinId, heroId) => {
          cur[String(heroId)] = skinId;
        });
      } catch {}
      const payload = JSON.stringify(
        { version: 1, savedAt: Date.now(), heroes, pairs, curSkins: cur },
        null,
        2,
      );
      const cands = dataServerCandidates(ctx);
      for (const c of cands) {
        if (tryWriteFile(ctx.asm, c, payload)) {
          const back = tryReadFile(ctx, c);
          if (back && back.length > 0) {
            ctx.serverDataPath = c;
            ctx.opts.log(
              `[PRIVATE-SERVER] tersimpan ${pairs.length} pairs (${heroes.length} hero) -> ${c}`,
            );
            loadDataServer(ctx);
            return { success: true, path: c, pairs: pairs.length };
          }
          ctx.opts.log(
            `[PRIVATE-SERVER] tulis ke ${c} tidak terverifikasi (baca balik gagal${ctx.lastDataServerError ? ": " + ctx.lastDataServerError : ""}), coba path berikut...`,
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
  }
  function saveCurSkinsToServer(ctx) {
    try {
      const cur = {};
      ctx.curSkinOverrides.forEach((skinId, heroId) => {
        cur[String(heroId)] = skinId;
      });
      const found = readServerJson(ctx);
      if (found) {
        try {
          found.obj.curSkins = cur;
          found.obj.savedAt = Date.now();
          if (
            tryWriteFile(
              ctx.asm,
              found.path,
              JSON.stringify(found.obj, null, 2),
            )
          ) {
            ctx.serverDataPath = found.path;
            ctx.opts.log(
              `[CURSKIN] tersimpan ${Object.keys(cur).length} curSkins -> ${found.path}`,
            );
            return true;
          }
        } catch (e) {
          ctx.opts.log("[CURSKIN] tulis balik gagal: " + e);
        }
      }
      const payload = JSON.stringify(
        {
          version: 1,
          savedAt: Date.now(),
          heroes: ctx.serverHeroes,
          pairs: ctx.serverPairs,
          curSkins: cur,
        },
        null,
        2,
      );
      for (const c of dataServerCandidates(ctx)) {
        try {
          if (tryWriteFile(ctx.asm, c, payload)) {
            const back = tryReadFile(ctx, c);
            if (back && back.length > 0) {
              ctx.serverDataPath = c;
              ctx.opts.log(
                `[CURSKIN] tersimpan ${Object.keys(cur).length} curSkins -> ${c}`,
              );
              return true;
            }
          }
        } catch {}
      }
    } catch (e) {
      ctx.opts.log("[CURSKIN] simpan gagal: " + e);
    }
    return false;
  }
  function scheduleCurSkinSave(ctx) {
    try {
      if (ctx.curSkinSaveTimer) {
        clearTimeout(ctx.curSkinSaveTimer);
        ctx.curSkinSaveTimer = null;
      }
      ctx.curSkinSaveTimer = setTimeout(() => {
        ctx.curSkinSaveTimer = null;
        try {
          saveCurSkinsToServer(ctx);
        } catch {}
      }, 2e3);
    } catch {}
  }
  function applyDataServer(ctx) {
    if (ctx.serverApplyTimer) return;
    if (ctx.serverPairs.length === 0) {
      const r = loadDataServer(ctx);
      if (!r.success || ctx.serverPairs.length === 0) return;
    }
    try {
      const d0 = ctx.SystemData.field("m_heroInfos").value;
      const c0 = !d0 || d0.isNull() ? 0 : d0.method("get_Count").invoke();
      if (c0 === 0) {
        ctx.opts.log(
          "[PRIVATE-SERVER] m_heroInfos kosong/belum siap, apply ditunda.",
        );
        return;
      }
    } catch {}
    ctx.serverLastApply = Date.now();
    const pairs = ctx.serverPairs.slice();
    ctx.opts.log(
      `[PRIVATE-SERVER] apply ${pairs.length} pairs (${ctx.opts.batchSize}/${ctx.opts.batchDelayMs}ms)...`,
    );
    applyServerPairsFast(ctx, pairs, () => {
      try {
        applyCurSkinOverrides(ctx);
      } catch {}
      ctx.opts.log(`[PRIVATE-SERVER] SELESAI ${pairs.length} pairs.`);
    });
  }
  function dbgDataServer(ctx) {
    ctx.opts.log("[PRIVATE-SERVER] === DEBUG ===");
    ctx.opts.log(
      `lastWritePath=${ctx.serverDataPath || "(kosong)"} memPairs=${ctx.serverPairs.length} lastErr=${ctx.lastDataServerError || "(tidak ada)"}`,
    );
    try {
      const SystemFile = findClass(ctx.asm, "System.IO.File");
      if (!SystemFile) {
        ctx.opts.log(
          "[PRIVATE-SERVER] class System.IO.File tidak ditemukan di semua assembly.",
        );
        return;
      }
      for (const c of dataServerCandidates(ctx)) {
        let exists = "?";
        try {
          exists = SystemFile.method("Exists").invoke(Il2Cpp.string(c));
        } catch (e) {
          exists = "ERR: " + e;
        }
        let read = "-";
        try {
          const t = SystemFile.method("ReadAllText").invoke(Il2Cpp.string(c));
          read =
            t && !t.isNull() && t.content
              ? `OK len=${t.content.length}`
              : "empty/null";
        } catch (e) {
          read = "ERR: " + e;
        }
        ctx.opts.log(`  ${c}
    exists=${exists} read=${read}`);
      }
    } catch (e) {
      ctx.opts.log("[PRIVATE-SERVER] debug gagal: " + e);
    }
  }

  // src/ToolLeak/unlock-skin/cur-skin.ts
  function applyCurSkinOverrides(ctx) {
    if (ctx.curSkinOverrides.size === 0) return;
    try {
      const dict = ctx.SystemData.field("m_heroInfos").value;
      if (!dict || dict.isNull()) return;
      ctx.curSkinOverrides.forEach((skinId, heroId) => {
        try {
          const hki = dict.method("get_Item").invoke(heroId);
          if (!hki || hki.isNull()) return;
          const cur = hki.field("m_curSkinId").value;
          if (cur !== skinId) {
            hki.field("m_curSkinId").value = skinId;
            ctx.opts.log(
              `[SETCURSKIN] re-apply Hero ${heroId}: curSkin ${cur} -> ${skinId}`,
            );
          }
        } catch {}
      });
    } catch {}
  }
  function startCurSkinReapply(ctx) {
    if (!ctx.opts.curSkinReapplyMs) return;
    try {
      setInterval(() => applyCurSkinOverrides(ctx), ctx.opts.curSkinReapplyMs);
      ctx.opts.log(
        `[+] [SETCURSKIN] interval re-apply ${ctx.opts.curSkinReapplyMs}ms aktif.`,
      );
    } catch {}
  }
  function patchHeroGetListSC(ctx, sc) {
    if (ctx.curSkinOverrides.size === 0) return;
    try {
      const vHeroList = sc.field("vHeroList").value;
      if (vHeroList && !vHeroList.isNull()) {
        const n = vHeroList.method("get_Count").invoke();
        for (let i = 0; i < n; i++) {
          try {
            const hero = vHeroList.method("get_Item").invoke(i);
            if (!hero || hero.isNull()) continue;
            const hid = Number(hero.field("iHeroId").value);
            const want = ctx.curSkinOverrides.get(hid);
            if (want === void 0) continue;
            const cur = hero.field("iCurrentSkin").value;
            if (cur !== want) {
              hero.field("iCurrentSkin").value = want;
              ctx.opts.log(
                `[SERVER_PATCH] vHeroList Hero ${hid}: iCurrentSkin ${cur} -> ${want}`,
              );
            }
          } catch {}
        }
      }
    } catch {}
    try {
      const vSkinList = sc.field("vSkinList").value;
      if (vSkinList && !vSkinList.isNull()) {
        const n = vSkinList.method("get_Count").invoke();
        const existing = /* @__PURE__ */ new Set();
        for (let i = 0; i < n; i++) {
          try {
            const sk = vSkinList.method("get_Item").invoke(i);
            if (sk && !sk.isNull()) existing.add(Number(sk.field("iId").value));
          } catch {}
        }
        ctx.curSkinOverrides.forEach((skinId) => {
          if (existing.has(skinId)) return;
          try {
            const inst = ctx.CmdHeroSkin.alloc();
            try {
              inst.method(".ctor").invoke();
            } catch {}
            try {
              inst.field("iId").value = skinId;
            } catch {}
            try {
              inst.field("bSmartMagicUnlock").value = true;
            } catch {}
            vSkinList.method("Add").invoke(inst);
            ctx.opts.log(`[SERVER_PATCH] vSkinList inject skin ${skinId}`);
          } catch (e) {
            ctx.opts.log(`[SERVER_PATCH] inject skin ${skinId} gagal: ${e}`);
          }
        });
      }
    } catch {}
  }
  function patchUnlockAllToServer(ctx, sc) {
    try {
      if (!ctx.serverFullInject) return;
      if (ctx.serverPairs.length === 0) return;
      const vSkinList = sc.field("vSkinList").value;
      if (!vSkinList || vSkinList.isNull()) return;
      const n = vSkinList.method("get_Count").invoke();
      const existing = /* @__PURE__ */ new Set();
      for (let i = 0; i < n; i++) {
        try {
          const sk = vSkinList.method("get_Item").invoke(i);
          if (sk && !sk.isNull()) existing.add(Number(sk.field("iId").value));
        } catch {}
      }
      const t0 = Date.now();
      const mAdd = vSkinList.method("Add");
      let ok = 0;
      let queued = 0;
      for (const pr of ctx.serverPairs) {
        if (!pr || existing.has(pr[1])) continue;
        queued++;
        try {
          const inst = ctx.CmdHeroSkin.alloc();
          try {
            inst.method(".ctor").invoke();
          } catch {}
          try {
            inst.field("iId").value = pr[1];
          } catch {}
          try {
            inst.field("bSmartMagicUnlock").value = true;
          } catch {}
          mAdd.invoke(inst);
          existing.add(pr[1]);
          ok++;
        } catch {}
      }
      if (queued > 0) {
        ctx.opts.log(
          `[UNLOCK-GATE] vSkinList inject ${ok}/${queued} unlock skins (${Date.now() - t0}ms)`,
        );
      }
    } catch {}
  }
  function unboxSkinId(v) {
    try {
      if (v === null || v === void 0) return null;
      if (typeof v === "number") return Number.isFinite(v) ? v : null;
      const o = v;
      if (o && typeof o.isNull === "function") {
        if (o.isNull()) return null;
        try {
          const u = o.unbox();
          const n2 = Number(u);
          if (Number.isFinite(n2)) return n2;
        } catch {}
        try {
          const n2 = Number(o.field("m_value").value);
          if (Number.isFinite(n2)) return n2;
        } catch {}
        return null;
      }
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
  function resolveSkinHeroId(ctx, self, skinId) {
    try {
      for (const f of ["m_heroId", "_heroId", "m_sourceHeroId"]) {
        try {
          const v = Number(self.field(f).value);
          if (Number.isFinite(v) && v > 0) return v;
        } catch {}
      }
    } catch {}
    try {
      if (skinId !== null) {
        const h = ctx.skinToHero.get(skinId);
        if (h !== void 0) return h;
      }
    } catch {}
    try {
      if (skinId !== null && ctx.CDataHeroCostume) {
        const insts = Il2Cpp.gc.choose(ctx.CDataHeroCostume);
        for (const it of insts) {
          try {
            if (!it || it.isNull()) continue;
            if (Number(it.field("m_ID").value) === skinId)
              return Number(it.field("m_HeroId").value);
          } catch {}
        }
      }
    } catch {}
    return null;
  }
  function hookCurSkinFromUi(ctx) {
    try {
      const UHI = ctx.asm.image.class("UIHeroInformation");
      const ocsp = UHI.tryMethod("OnChangeSkinWithPreload_Immediately");
      if (!ocsp) {
        ctx.opts.log(
          "[-] [CURSKIN] UIHeroInformation.OnChangeSkinWithPreload_Immediately tidak ditemukan.",
        );
        return;
      }
      try {
        void ocsp.nativeFunction;
      } catch {}
      ocsp.implementation = function (obj, dragonCrystalId) {
        let ret = void 0;
        try {
          ret = this.method("OnChangeSkinWithPreload_Immediately").invoke(
            obj,
            dragonCrystalId,
          );
        } catch (e) {
          ctx.opts.log(`[-] [CURSKIN] original gagal: ${e}`);
        }
        try {
          const skinId = unboxSkinId(obj);
          const heroId = resolveSkinHeroId(ctx, this, skinId);
          if (heroId !== null && skinId !== null) {
            ctx.curSkinOverrides.set(heroId, skinId);
            try {
              rebuildUnlockSets(ctx);
            } catch {}
            try {
              applyCurSkinOverrides(ctx);
            } catch {}
            try {
              scheduleCurSkinSave(ctx);
            } catch {}
            ctx.opts.log(
              `[CURSKIN] OnChangeSkin hero ${heroId} -> skin ${skinId} (m_curSkinId diset + jadwal simpan)`,
            );
          } else {
            ctx.opts.log(
              `[CURSKIN] OnChangeSkin terdeteksi tapi hero tak dikenali (skin=${skinId})`,
            );
          }
        } catch (e) {
          ctx.opts.log("[CURSKIN] hook gagal: " + e);
        }
        return ret;
      };
      ctx.opts.log(
        "[+] [CURSKIN] UIHeroInformation.OnChangeSkinWithPreload_Immediately hook terpasang.",
      );
    } catch (e) {
      ctx.opts.log("[!] [CURSKIN] hook gagal: " + e);
    }
  }
  function patchServerSkin(ctx, heroId, skinId) {
    try {
      ctx.curSkinOverrides.set(heroId, skinId);
      try {
        rebuildUnlockSets(ctx);
      } catch {}
      try {
        const Util = ctx.asm.image.class("HeroGetListCacheUtil");
        const cache = Util.field("cacheObj").value;
        if (cache && !cache.isNull()) {
          const sc = cache.field("serverObj").value;
          if (sc && !sc.isNull()) patchHeroGetListSC(ctx, sc);
        }
      } catch {}
      try {
        grantSkin(ctx, heroId, skinId);
      } catch (e) {
        ctx.opts.log("[SERVER_PATCH] grantSkin gagal: " + e);
      }
      applyCurSkinOverrides(ctx);
      ctx.opts.log(
        `[SERVER_PATCH] override disimpan: Hero ${heroId} -> ${skinId} (serverObj + m_heroInfos)`,
      );
    } catch (e) {
      ctx.opts.log("[SERVER_PATCH] gagal: " + e);
    }
  }

  // src/ToolLeak/unlock-skin/ownership-gates.ts
  function hookBool0(ctx, cls, methodName, tag) {
    try {
      const m = cls.tryMethod(methodName);
      if (!m) {
        ctx.opts.log(`[-] [${tag}] ${methodName} tidak ditemukan.`);
        return;
      }
      try {
        void m.nativeFunction;
      } catch {}
      m.implementation = function (..._args) {
        return true;
      };
      ctx.opts.log(`[+] [${tag}] ${methodName} -> true`);
    } catch (e) {
      ctx.opts.log(`[!] [${tag}] hook ${methodName} gagal: ` + e);
    }
  }
  function hookBoolFalse(ctx, cls, methodName, tag) {
    try {
      const m = cls.tryMethod(methodName);
      if (!m) {
        ctx.opts.log(`[-] [${tag}] ${methodName} tidak ditemukan.`);
        return;
      }
      try {
        void m.nativeFunction;
      } catch {}
      m.implementation = function (..._args) {
        return false;
      };
      ctx.opts.log(`[+] [${tag}] ${methodName} -> false`);
    } catch (e) {
      ctx.opts.log(`[!] [${tag}] hook ${methodName} gagal: ` + e);
    }
  }
  function hookOwnershipGates(ctx) {
    const SystemData = ctx.SystemData;
    const ensureUnlocked = function (skinId) {
      try {
        if (ctx.unlockedSkins.has(skinId)) {
          const hid = ctx.skinToHero.get(skinId);
          if (hid !== void 0) {
            try {
              grantHero(ctx, hid);
            } catch {}
            try {
              grantSkin(ctx, hid, skinId);
            } catch {}
          }
          return true;
        }
      } catch {}
      return false;
    };
    try {
      const ish = SystemData.tryMethod("IsHaveSkin");
      if (!ish) {
        ctx.opts.log(
          "[-] [UNLOCK-GATE] SystemData.IsHaveSkin tidak ditemukan.",
        );
      } else {
        try {
          void ish.nativeFunction;
        } catch {}
        ish.implementation = function (skinid) {
          const ret = this.method("IsHaveSkin").invoke(skinid);
          try {
            const o = ret;
            if (o && !o.isNull()) return ret;
          } catch {}
          try {
            const sid = Number(skinid);
            if (ensureUnlocked(sid)) {
              const ret2 = this.method("IsHaveSkin").invoke(skinid);
              try {
                const o2 = ret2;
                if (o2 && !o2.isNull()) {
                  ctx.opts.log(`[UNLOCK-GATE] IsHaveSkin(${sid}) -> granted`);
                  return ret2;
                }
              } catch {}
            }
          } catch {}
          return ret;
        };
        ctx.opts.log("[+] [UNLOCK-GATE] SystemData.IsHaveSkin hook terpasang.");
      }
    } catch (e) {
      ctx.opts.log("[!] [UNLOCK-GATE] hook IsHaveSkin gagal: " + e);
    }
    try {
      const ishf = SystemData.tryMethod("IsHaveSkinForever");
      if (!ishf) {
        ctx.opts.log(
          "[-] [UNLOCK-GATE] SystemData.IsHaveSkinForever tidak ditemukan.",
        );
      } else {
        try {
          void ishf.nativeFunction;
        } catch {}
        ishf.implementation = function (skinid) {
          const ret = this.method("IsHaveSkinForever").invoke(skinid);
          try {
            const o = ret;
            if (o && !o.isNull()) return ret;
          } catch {}
          try {
            const sid = Number(skinid);
            if (ensureUnlocked(sid)) {
              const ret2 = this.method("IsHaveSkinForever").invoke(skinid);
              try {
                const o2 = ret2;
                if (o2 && !o2.isNull()) {
                  ctx.opts.log(
                    `[UNLOCK-GATE] IsHaveSkinForever(${sid}) -> granted`,
                  );
                  return ret2;
                }
              } catch {}
            }
          } catch {}
          return ret;
        };
        ctx.opts.log(
          "[+] [UNLOCK-GATE] SystemData.IsHaveSkinForever hook terpasang.",
        );
      }
    } catch (e) {
      ctx.opts.log("[!] [UNLOCK-GATE] hook IsHaveSkinForever gagal: " + e);
    }
    for (const clsName of ["UIChooseHero", "UIChooseHeroTrain"]) {
      try {
        const cls = ctx.asm.image.class(clsName);
        const cs = cls.tryMethod("CanSelectSkin");
        if (!cs) {
          ctx.opts.log(
            `[-] [UNLOCK-GATE] ${clsName}.CanSelectSkin tidak ditemukan.`,
          );
          continue;
        }
        try {
          void cs.nativeFunction;
        } catch {}
        cs.implementation = function (skinId, heroinfo) {
          try {
            const sid = Number(skinId);
            if (ctx.unlockedSkins.has(sid)) {
              ensureUnlocked(sid);
              return true;
            }
          } catch {}
          return this.method("CanSelectSkin").invoke(skinId, heroinfo);
        };
        ctx.opts.log(
          `[+] [UNLOCK-GATE] ${clsName}.CanSelectSkin hook terpasang.`,
        );
      } catch (e) {
        ctx.opts.log(
          `[!] [UNLOCK-GATE] hook ${clsName}.CanSelectSkin gagal: ` + e,
        );
      }
    }
    hookBoolFalse(ctx, SystemData, "IsActivityForbidHeros", "FORBID");
    hookBoolFalse(ctx, SystemData, "IsForbidHeros", "FORBID");
    hookBoolFalse(ctx, SystemData, "IsForbidHeroInChooseHero", "FORBID");
    try {
      const m = SystemData.tryMethod("IsUnlockDragonCrystal");
      if (m) {
        try {
          void m.nativeFunction;
        } catch {}
        m.implementation = function () {
          return true;
        };
        ctx.opts.log("[+] IsUnlockDragonCrystal -> true");
      }
    } catch {}
    try {
      const m = SystemData.tryMethod("IsRealHaveHero");
      if (m) {
        try {
          void m.nativeFunction;
        } catch {}
        m.implementation = function () {
          return true;
        };
        ctx.opts.log("[+] IsRealHaveHero -> true");
      }
    } catch {}
    try {
      const LoadRes = ctx.asm.image.class("LoadRes");
      const m = LoadRes.tryMethod("IsHaveHeroShowRes");
      if (m) {
        try {
          void m.nativeFunction;
        } catch {}
        m.implementation = function () {
          return true;
        };
        ctx.opts.log("[+] LoadRes.IsHaveHeroShowRes -> true");
      }
    } catch (e) {
      ctx.opts.log("[!] hook IsHaveHeroShowRes gagal: " + e);
    }
    hookBool0(ctx, SystemData, "IsRealHaveFaceBorder", "COSMETIC");
    try {
      const UIChangeHeadFramePage = ctx.asm.image.class(
        "UIChangeHeadFramePage",
      );
      const m = UIChangeHeadFramePage.tryMethod("IsHaveFaceBorder");
      if (m) {
        try {
          void m.nativeFunction;
        } catch {}
        m.implementation = function () {
          return true;
        };
        ctx.opts.log("[+] UIChangeHeadFramePage.IsHaveFaceBorder -> true");
      }
    } catch {}
    hookBool0(ctx, SystemData, "IsRealHaveFaceBorderByItemId", "COSMETIC");
    hookBool0(ctx, SystemData, "IsRealHaveLeader", "COSMETIC");
    try {
      const LoginReceiveMessage = ctx.asm.image.class("LoginReceiveMessage");
      const m = LoginReceiveMessage.tryMethod("get_IsAdvanceServer");
      if (m) {
        try {
          void m.nativeFunction;
        } catch {}
        m.implementation = function () {
          return true;
        };
      }
    } catch {}
    try {
      SystemData.field("m_bChangeZoneEnable").value = true;
    } catch {}
  }

  // src/ToolLeak/unlock-skin/server-hooks.ts
  function hookServerPacket(ctx) {
    try {
      const HeroGetListCache = ctx.asm.image.class("HeroGetListCache");
      const handleSC = HeroGetListCache.method("HandleSC");
      try {
        void handleSC.nativeFunction;
      } catch {}
      handleSC.implementation = function (retMsg) {
        const ret = this.method("HandleSC").invoke(retMsg);
        try {
          const sc = this.field("serverObj").value;
          ctx.opts.log(`
[SERVER_HOOK] === HeroGetListCache.HandleSC: serverObj ${sc && !sc.isNull() ? sc.handle : "NULL"} ===`);
          if (sc && !sc.isNull()) {
            try {
              patchHeroGetListSC(ctx, sc);
            } catch {}
            try {
              patchUnlockAllToServer(ctx, sc);
            } catch {}
            try {
              applyCurSkinOverrides(ctx);
            } catch {}
          }
        } catch (e) {
          ctx.opts.log(`[SERVER_HOOK] HandleSC dump gagal: ${e}`);
        }
        return ret;
      };
      ctx.opts.log("[+] HeroGetListCache.HandleSC hook terpasang.");
    } catch (e) {
      ctx.opts.log("[!] Hook HeroGetListCache.HandleSC gagal: " + e);
    }
    try {
      let GetListSC = null;
      try {
        GetListSC = ctx.asm.image.class("MTTDProto.Cmd_Hero_GetList_SC");
      } catch {
        GetListSC =
          ctx.asm.image.classes.find((c) => c.name === "Cmd_Hero_GetList_SC") ??
          null;
      }
      if (!GetListSC) {
        ctx.opts.log(
          "[-] [SERVER_PATCH] class Cmd_Hero_GetList_SC tidak ditemukan.",
        );
      } else {
        const visits = GetListSC.methods.filter((m) => m.name === "visit");
        if (visits.length === 0) {
          ctx.opts.log(
            "[-] [SERVER_PATCH] Cmd_Hero_GetList_SC.visit tidak ditemukan.",
          );
        }
        visits.forEach((visit) => {
          let sig = "";
          try {
            sig = visit.parameters
              .map((p) => `${p.type?.name ?? ""} ${p.name ?? ""}`)
              .join(",");
          } catch {}
          if (sig && !sig.includes("Unpack")) return;
          try {
            const originalVisit = new NativeFunction(
              visit.virtualAddress,
              "void",
              ["pointer", "pointer", "int"],
            );
            visit.implementation = function (t, bOpt) {
              try {
                const self = this;
                const tObj = t;
                originalVisit(
                  self.handle,
                  tObj && !tObj.isNull() ? tObj.handle : ptr(0),
                  bOpt ? 1 : 0,
                );
              } catch (e) {
                ctx.opts.log(`[-] [SERVER_PATCH] original visit gagal: ${e}`);
              }
              try {
                patchHeroGetListSC(ctx, this);
              } catch {}
              try {
                patchUnlockAllToServer(ctx, this);
              } catch {}
            };
            ctx.opts.log(`[+] [SERVER_PATCH] visit hook terpasang (${sig}).`);
          } catch (e) {
            ctx.opts.log(`[!] [SERVER_PATCH] visit hook gagal (${sig}): ${e}`);
          }
        });
      }
    } catch (e) {
      ctx.opts.log("[!] [SERVER_PATCH] hook visit gagal: " + e);
    }
    try {
      const GRM = ctx.asm.image.class("GameReceiveMessage");
      const setCur = GRM.tryMethod("on_Item_Set_CurSkin_SC");
      if (!setCur) {
        ctx.opts.log(
          "[-] [SERVER_PATCH] on_Item_Set_CurSkin_SC tidak ditemukan.",
        );
      } else {
        try {
          void setCur.nativeFunction;
        } catch {}
        setCur.implementation = function (retMsg) {
          const ret = this.method("on_Item_Set_CurSkin_SC").invoke(retMsg);
          try {
            applyCurSkinOverrides(ctx);
          } catch {}
          return ret;
        };
        ctx.opts.log(
          "[+] [SERVER_PATCH] on_Item_Set_CurSkin_SC hook terpasang.",
        );
      }
    } catch (e) {
      ctx.opts.log(
        "[!] [SERVER_PATCH] hook on_Item_Set_CurSkin_SC gagal: " + e,
      );
    }
    try {
      let CHC = null;
      try {
        CHC = ctx.asm.image.tryClass("CreateHeroCard");
      } catch {}
      if (!CHC) {
        try {
          CHC = ctx.asm.image.class("CreateHeroCard");
        } catch {}
      }
      if (!CHC) {
        CHC =
          ctx.asm.image.classes.find((c) => c.name === "CreateHeroCard") ??
          null;
      }
      let gds = null;
      try {
        gds = CHC ? CHC.tryMethod("GetHeroDressSkin") : null;
      } catch {
        gds = null;
      }
      if (!gds) {
        ctx.opts.log(
          "[-] [SETCURSKIN] CreateHeroCard.GetHeroDressSkin tidak ditemukan.",
        );
      } else {
        try {
          void gds.nativeFunction;
        } catch {}
        gds.implementation = function (heroId) {
          try {
            const hid = Number(heroId);
            const want = ctx.curSkinOverrides.get(hid);
            if (want !== void 0) return want;
          } catch {}
          return this.method("GetHeroDressSkin").invoke(heroId);
        };
        ctx.opts.log(
          "[+] [SETCURSKIN] CreateHeroCard.GetHeroDressSkin hook terpasang.",
        );
      }
    } catch (e) {
      ctx.opts.log("[!] [SETCURSKIN] hook GetHeroDressSkin gagal: " + e);
    }
    try {
      const UIF = ctx.asm.image.class("UIFuncs");
      const ghk = UIF.tryMethod("GetHeroKeyInfoList");
      if (ghk) {
        try {
          void ghk.nativeFunction;
        } catch {}
        ghk.implementation = function (
          heros,
          infoTable,
          ownHerolist,
          starVip,
          experienceDict,
        ) {
          return this.method("GetHeroKeyInfoList").invoke(
            heros,
            infoTable,
            ownHerolist,
            starVip,
            experienceDict,
          );
        };
        ctx.opts.log(
          "[+] [SETCURSKIN] UIFuncs.GetHeroKeyInfoList hook terpasang.",
        );
      } else {
        ctx.opts.log(
          "[-] [SETCURSKIN] UIFuncs.GetHeroKeyInfoList tidak ditemukan.",
        );
      }
    } catch (e) {
      ctx.opts.log("[!] [SETCURSKIN] hook GetHeroKeyInfoList gagal: " + e);
    }
    try {
      const addHeroSkin = ctx.SystemData.tryMethod("AddHeroSkin");
      if (addHeroSkin) {
        addHeroSkin.implementation = function (heroskin) {
          try {
            const skinId = heroskin.field("iId").value;
            const isMagicUnlock = heroskin.field("bSmartMagicUnlock").value;
            const limitTime = heroskin.field("iLimitTime").value;
            ctx.opts.log(
              `[SERVER_HOOK] AddHeroSkin called: skinId=${skinId} iLimitTime=${limitTime} bSmartMagicUnlock=${isMagicUnlock}`,
            );
          } catch {}
          return this.method("AddHeroSkin").invoke(heroskin);
        };
        ctx.opts.log("[+] SystemData.AddHeroSkin hook terpasang.");
      } else {
        ctx.opts.log("[-] SystemData.AddHeroSkin tidak ditemukan.");
      }
    } catch (e) {
      ctx.opts.log("[!] Hook SystemData.AddHeroSkin gagal: " + e);
    }
    if (ctx.opts.enableAutoApplyTrigger) {
      try {
        if (!ctx.CDataHeroCostume) throw new Error("CData class null");
        const GetMaxDataLength =
          ctx.CDataHeroCostume.method("GetMaxDataLength");
        Interceptor.attach(GetMaxDataLength.virtualAddress, {
          onLeave(_retval) {
            try {
              const now = Date.now();
              if (
                !ctx.serverApplyTimer &&
                now - ctx.serverLastApply > ctx.opts.serverApplyCooldownMs
              ) {
                ctx.opts.log("ServerPatch");
                applyDataServer(ctx);
              }
            } catch {}
          },
        });
        ctx.opts.log("[+] GetMaxDataLength auto-apply trigger terpasang.");
      } catch (e) {
        ctx.opts.log("[!] trigger GetMaxDataLength gagal: " + e);
      }
    }
  }

  // src/ToolLeak/unlock-skin/dumps.ts
  function dumpHeroGetListSC(ctx, sc) {
    try {
      const dumpList = function (listName, list, fields, maxShow) {
        try {
          if (!list || list.isNull()) {
            ctx.opts.log(`[SERVER_HOOK] ${listName} = NULL`);
            return;
          }
          const cnt = list.method("get_Count").invoke();
          ctx.opts.log(`[SERVER_HOOK] ${listName} count = ${cnt}`);
          const n = Math.min(cnt, maxShow);
          for (let i = 0; i < n; i++) {
            try {
              const it = list.method("get_Item").invoke(i);
              if (!it || it.isNull()) continue;
              const parts = [];
              for (const f of fields) {
                try {
                  parts.push(`${f}=${it.field(f).value}`);
                } catch {
                  parts.push(`${f}=?`);
                }
              }
              ctx.opts.log(`[SERVER_HOOK]   [${i}] ${parts.join(" ")}`);
            } catch {}
          }
          if (cnt > maxShow)
            ctx.opts.log(
              `[SERVER_HOOK]   ... (${cnt - maxShow} lagi, panggil dumpHeroGetList() untuk full)`,
            );
        } catch (e) {
          ctx.opts.log(`[SERVER_HOOK] ${listName} dump error: ${e}`);
        }
      };
      dumpList(
        "vHeroList (CmdHeroData)",
        sc.field("vHeroList").value,
        [
          "iHeroId",
          "iCurrentSkin",
          "iLimitTime",
          "iSkinSource",
          "iCurrentStatue",
          "iStatueSource",
          "iFightPowerLvl",
          "iFightPowerValue",
        ],
        50,
      );
      dumpList(
        "vSkinList (CmdHeroSkin)",
        sc.field("vSkinList").value,
        [
          "iId",
          "iLimitTime",
          "iSource",
          "iLimitTimeMagicChess",
          "iGetTime",
          "uiCurDragonCrystalId",
          "bSmartMagicUnlock",
          "iButtonSkin",
        ],
        50,
      );
      dumpList(
        "vStatueList (CmdHeroStatue)",
        sc.field("vStatueList").value,
        ["iId", "iLimitTime", "iSource"],
        20,
      );
      try {
        const mc = sc.field("vSkinListMagicChess").value;
        ctx.opts.log(
          `[SERVER_HOOK] vSkinListMagicChess count = ${mc && !mc.isNull() ? mc.method("get_Count").invoke() : "NULL"}`,
        );
      } catch {}
      try {
        ctx.opts.log(
          `[SERVER_HOOK] iHerosRewardIdx=${sc.field("iHerosRewardIdx").value} sMd5=${sc.field("sMd5").value}`,
        );
      } catch {}
    } catch (e) {
      ctx.opts.log(`[SERVER_HOOK] dumpHeroGetListSC error: ${e}`);
    }
  }
  function dumpCachedHeroGetList(ctx) {
    try {
      const Util = ctx.asm.image.class("HeroGetListCacheUtil");
      const cache = Util.field("cacheObj").value;
      if (!cache || cache.isNull()) {
        ctx.opts.log(
          "[SERVER_HOOK] HeroGetListCacheUtil.cacheObj = NULL (paket mentah sudah lewat/di-GC).",
        );
        ctx.opts.log(
          "[SERVER_HOOK] Pakai dumpServerHeroSkin() untuk data server yang sudah diproses game.",
        );
        return;
      }
      const sc = cache.field("serverObj").value;
      if (!sc || sc.isNull()) {
        ctx.opts.log("[SERVER_HOOK] cacheObj.serverObj = NULL");
        return;
      }
      ctx.opts.log(`
[SERVER_HOOK] === DUMP cached Cmd_Hero_GetList_SC (${sc.handle}) ===`);
      dumpHeroGetListSC(ctx, sc);
    } catch (e) {
      ctx.opts.log("[SERVER_HOOK] dumpHeroGetList gagal: " + e);
    }
  }
  function dumpServerHeroSkin(ctx, onlyOwned) {
    try {
      const dict = ctx.SystemData.field("m_heroInfos").value;
      if (!dict || dict.isNull()) {
        ctx.opts.log("[SERVER_HOOK] SystemData.m_heroInfos = NULL");
        return;
      }
      const enumerator = dict.method("GetEnumerator").invoke();
      let heroCount = 0;
      ctx.opts.log(`
[SERVER_HOOK] === SystemData.m_heroInfos ===`);
      while (
        enumerator &&
        !enumerator.isNull() &&
        enumerator.method("MoveNext").invoke()
      ) {
        try {
          const kvp = enumerator.method("get_Current").invoke();
          if (!kvp || kvp.isNull()) continue;
          const hki = kvp.method("get_Value").invoke();
          if (!hki || hki.isNull()) continue;
          heroCount++;
          const heroId = hki.field("m_heroID").value;
          const curSkin = hki.field("m_curSkinId").value;
          const defSkin = hki.field("m_defaultSkinId").value;
          const list = hki.field("m_heroskins").value;
          const cnt =
            list && !list.isNull() ? list.method("get_Count").invoke() : 0;
          if (onlyOwned && cnt === 0) continue;
          ctx.opts.log(
            `[SERVER_HOOK] Hero ${heroId}: curSkin=${curSkin} defaultSkin=${defSkin} skins=${cnt}`,
          );
          for (let j = 0; j < cnt; j++) {
            try {
              const sk = list.method("get_Item").invoke(j);
              if (!sk || sk.isNull()) continue;
              ctx.opts.log(
                `[SERVER_HOOK]   skin iId=${sk.field("iId").value} iLimitTime=${sk.field("iLimitTime").value} iSource=${sk.field("iSource").value} bSmartMagicUnlock=${sk.field("bSmartMagicUnlock").value} iButtonSkin=${sk.field("iButtonSkin").value}`,
              );
            } catch {}
          }
        } catch {}
      }
      ctx.opts.log(`[SERVER_HOOK] === END (${heroCount} hero) ===
`);
    } catch (e) {
      ctx.opts.log("[SERVER_HOOK] dumpServerHeroSkin gagal: " + e);
    }
  }
  function dumpSkinData(ctx, targetPath) {
    try {
      const inputPath =
        targetPath || "/Android/data/com.package.name/files/skin.json";
      ctx.opts.log("[*] Memulai ekstraksi data CData_HeroCostume_Element...");
      const persistentPath = persistentDataPath(ctx.asm);
      let realPackage = "";
      if (persistentPath) {
        const match = persistentPath.match(/Android\/data\/([^\/]+)/);
        if (match && match[1]) realPackage = match[1];
      }
      if (!ctx.CDataHeroCostume)
        return { success: false, error: "CData_HeroCostume_Element null" };
      const costumeInstances = Il2Cpp.gc.choose(ctx.CDataHeroCostume);
      const results = [];
      const seenSkinIds = /* @__PURE__ */ new Set();
      for (const instance of costumeInstances) {
        try {
          if (!instance || instance.isNull()) continue;
          const skinId = instance.field("m_ID").value;
          if (skinId === void 0 || skinId === null) continue;
          if (seenSkinIds.has(skinId)) continue;
          seenSkinIds.add(skinId);
          const heroId = instance.field("m_HeroId").value ?? 0;
          let namaSkin = "";
          try {
            const strName = instance.field("m_mName").value;
            if (strName && !strName.isNull()) namaSkin = strName.content ?? "";
          } catch {}
          let fileSkin = "";
          try {
            const strPrefab = instance.field("m_Prefabs").value;
            if (strPrefab && !strPrefab.isNull())
              fileSkin = strPrefab.content ?? "";
          } catch {}
          let uiSkin = "";
          try {
            const strSmallMap = instance.field("m_SmallMap").value;
            if (strSmallMap && !strSmallMap.isNull())
              uiSkin = strSmallMap.content ?? "";
          } catch {}
          results.push({
            ID_Skin: skinId,
            ID_Hero: heroId,
            Nama_Skin: namaSkin,
            File_Skin: fileSkin,
            UI_Skin: uiSkin,
          });
        } catch {}
      }
      const jsonStr = JSON.stringify(results, null, 2);
      const candidatePaths = [];
      candidatePaths.push(inputPath);
      if (inputPath.startsWith("/Android/")) {
        candidatePaths.push("/sdcard" + inputPath);
        candidatePaths.push("/storage/emulated/0" + inputPath);
      }
      const packagesToTry = /* @__PURE__ */ new Set();
      if (realPackage) packagesToTry.add(realPackage);
      packagesToTry.add("com.mobile.legends");
      for (const pkg of packagesToTry) {
        if (inputPath.includes("com.package.name")) {
          const pkgPath = inputPath.replace("com.package.name", pkg);
          candidatePaths.push(pkgPath);
          if (pkgPath.startsWith("/Android/")) {
            candidatePaths.push("/sdcard" + pkgPath);
            candidatePaths.push("/storage/emulated/0" + pkgPath);
          }
        }
      }
      if (persistentPath) {
        const fileName =
          inputPath.substring(inputPath.lastIndexOf("/") + 1) || "skin.json";
        candidatePaths.push(`${persistentPath}/${fileName}`);
        candidatePaths.push(`${persistentPath}/skin.json`);
      }
      candidatePaths.push(
        "/home/petwirkepo/MLBBLeakTool/fetchFromFile/skin.json",
      );
      const successfulPaths = [];
      const uniqueCandidates = Array.from(new Set(candidatePaths));
      for (const candidate of uniqueCandidates) {
        if (tryWriteFile(ctx.asm, candidate, jsonStr)) {
          successfulPaths.push(candidate);
        }
      }
      if (successfulPaths.length > 0) {
        ctx.opts.log(
          `[DUMP SKIN] Berhasil mengekstrak ${results.length} skin ke: ${successfulPaths[0]}`,
        );
        if (successfulPaths.length > 1) {
          ctx.opts.log(
            `[DUMP SKIN] Tertulis juga di: ${successfulPaths.slice(1).join(", ")}`,
          );
        }
        return {
          success: true,
          count: results.length,
          path: successfulPaths[0],
          paths: successfulPaths,
        };
      }
      const errMsg = `Gagal menulis ke semua lokasi kandidat: ${uniqueCandidates.join(", ")}`;
      ctx.opts.log(`[DUMP SKIN] ${errMsg}`);
      return { success: false, error: errMsg, count: results.length };
    } catch (err) {
      ctx.opts.log(`[DUMP SKIN] Error: ${err?.message ?? err}`);
      return { success: false, error: String(err?.message ?? err) };
    }
  }
  function dressSkin(ctx, skinId) {
    try {
      const sd = ctx.SystemData.method("AddSkinDressInfo");
      const isD = ctx.SystemData.method("IsDressSkin");
      const isH = ctx.SystemData.method("IsHaveSkinForever");
      const isS = ctx.SystemData.method("IsHaveSkin");
      let before = "";
      try {
        before = `IsDressSkin=${isD.invoke(skinId)} IsHaveSkinForever=${isH.invoke(skinId)} IsHaveSkin=${isS.invoke(skinId) !== null}`;
      } catch (e) {
        before = "cek-gagal: " + e;
      }
      ctx.opts.log(
        `[DRESS] sebelum AddSkinDressInfo(${skinId}, true): ${before}`,
      );
      sd.invoke(skinId, true);
      let after = "";
      try {
        after = `IsDressSkin=${isD.invoke(skinId)} IsHaveSkinForever=${isH.invoke(skinId)} IsHaveSkin=${isS.invoke(skinId) !== null}`;
      } catch (e) {
        after = "cek-gagal: " + e;
      }
      ctx.opts.log(
        `[DRESS] sesudah AddSkinDressInfo(${skinId}, true): ${after}`,
      );
    } catch (e) {
      ctx.opts.log("[DRESS] gagal: " + e);
    }
  }
  function checkDressSkinInHero(ctx, skinid) {
    ctx.opts.log(`
[SKIN_ANALYZE] === MENCARI skinid=${skinid} di semua HeroKeyInfo ===`);
    try {
      const hkiCls = ctx.asm.image.class("SystemData/HeroKeyInfo");
      const instances = Il2Cpp.gc.choose(hkiCls);
      for (const hki of instances) {
        try {
          const heroId = hki.field("m_heroID").value;
          const curSkinId = hki.field("m_curSkinId").value;
          const list = hki.field("m_heroskins").value;
          let hasSkin = false;
          if (list && !list.isNull()) {
            const cnt = list.method("get_Count").invoke();
            for (let i = 0; i < cnt; i++) {
              try {
                const skin = list.method("get_Item").invoke(i);
                if (
                  skin &&
                  !skin.isNull() &&
                  skin.field("iId").value === skinid
                ) {
                  hasSkin = true;
                  break;
                }
              } catch {}
            }
          }
          if (curSkinId === skinid) {
            ctx.opts.log(
              `[SKIN_ANALYZE] *** HERO ${heroId} memakai skin ${skinid} sebagai m_curSkinId! ***`,
            );
          } else if (hasSkin) {
            ctx.opts.log(
              `[SKIN_ANALYZE] Hero ${heroId} punya skin ${skinid} di m_heroskins tapi bukan curSkinId`,
            );
          }
        } catch {}
      }
    } catch (e) {
      ctx.opts.log("[SKIN_ANALYZE] Error: " + e);
    }
    ctx.opts.log("[SKIN_ANALYZE] === END SEARCH ===\n");
  }
  function registerDumpCommands(ctx) {
    globalThis.dumpHeroGetList = function () {
      dumpCachedHeroGetList(ctx);
    };
    globalThis.dumpServerHeroSkin = function (onlyOwned) {
      dumpServerHeroSkin(ctx, onlyOwned);
    };
    globalThis.dumpSkinData = function (targetPath) {
      return dumpSkinData(ctx, targetPath);
    };
    globalThis.dumpSkin = function (targetPath) {
      return dumpSkinData(ctx, targetPath);
    };
    globalThis.dressSkin = function (skinId) {
      dressSkin(ctx, skinId);
    };
    globalThis.checkDressSkinInHero = function (skinid) {
      checkDressSkinInHero(ctx, skinid);
    };
    globalThis.dumpSkinDictBeforeAfter = function (skinid) {
      ctx.opts.log(`
[SKIN_ANALYZE] === SKIN ID ${skinid} STATUS ===`);
      checkDressSkinInHero(ctx, skinid);
    };
    void findClass;
  }

  // src/ToolLeak/unlock-skin/index.ts
  var active = null;
  function runPrivateServerUnlockSkin(asm, coreRef, opts) {
    const resolved = asm ?? Il2Cpp.domain.assembly("Assembly-CSharp");
    const ctx = createCtx(resolved, opts);
    active = ctx;
    const log2 = ctx.opts.log;
    hookOwnershipGates(ctx);
    startCurSkinReapply(ctx);
    hookCurSkinFromUi(ctx);
    hookServerPacket(ctx);
    registerDumpCommands(ctx);
    if (ctx.opts.autoLoad) {
      try {
        loadDataServer(ctx);
      } catch {}
    }
    try {
      if (coreRef) {
        coreRef.current = {
          curSkinOverrides: ctx.curSkinOverrides,
          rebuildUnlockSets: () => rebuildUnlockSets(ctx),
          applyCurSkinOverrides: () => applyCurSkinOverrides(ctx),
        };
      }
    } catch {}
    globalThis.setCurSkin = function (heroId, skinId) {
      try {
        ctx.curSkinOverrides.set(heroId, skinId);
        try {
          rebuildUnlockSets(ctx);
        } catch {}
        applyCurSkinOverrides(ctx);
        log2(
          `[SETCURSKIN] override disimpan: Hero ${heroId} -> ${skinId} (re-apply tiap ${ctx.opts.curSkinReapplyMs}ms)`,
        );
      } catch (e) {
        log2("[SETCURSKIN] gagal: " + e);
      }
    };
    globalThis.clearCurSkinOverrides = function () {
      ctx.curSkinOverrides.clear();
      log2("[SETCURSKIN] semua override dibersihkan");
    };
    globalThis.patchServerSkin = function (heroId, skinId) {
      patchServerSkin(ctx, heroId, skinId);
    };
    globalThis.saveCurSkins = function () {
      return saveCurSkinsToServer(ctx);
    };
    globalThis.UnlockHero = function (heroid) {
      grantHero(ctx, heroid);
    };
    globalThis.UnlockAll = function () {
      const r = unlockAll(ctx);
      try {
        saveDataServer(ctx);
      } catch {}
      return r;
    };
    globalThis.saveDataServer = function () {
      return saveDataServer(ctx);
    };
    globalThis.loadDataServer = function () {
      return loadDataServer(ctx);
    };
    globalThis.applyDataServer = function () {
      applyDataServer(ctx);
    };
    globalThis.dbgDataServer = function () {
      dbgDataServer(ctx);
    };
    globalThis.serverFullInject = function (on) {
      if (on !== void 0) ctx.serverFullInject = !!on;
      return ctx.serverFullInject;
    };
    log2("[+] [UNLOCK-SKIN] private-server unlock skin aktif (standalone).");
    return {
      ctx,
      setCurSkin: (h, s) => globalThis.setCurSkin(h, s),
      clearCurSkinOverrides: () => globalThis.clearCurSkinOverrides(),
      patchServerSkin: (h, s) => patchServerSkin(ctx, h, s),
      unlockHero: (h) => grantHero(ctx, h),
      unlockAll: () => unlockAll(ctx),
      applyCurSkinOverrides: () => applyCurSkinOverrides(ctx),
      rebuildUnlockSets: () => rebuildUnlockSets(ctx),
    };
  }
  function runUnlockSkinStandalone(opts) {
    return runPrivateServerUnlockSkin(void 0, void 0, opts);
  }

  // src/debug-unlock-skin.ts
  console.log("[*] unlock-skin standalone: IL2CPP siap, pasang hook...");
  runUnlockSkinStandalone();

  console.log(
    "[+] Skin & Statue System Hooked Successfully with 'Assembly' variable.",
  );
}
