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

  SystemData.field("m_uiDamond").value = 989876;
  SystemData.field("m_uiCoupons").value = 878688;

  SystemData.field("m_buttonSkinOpen").value = true;

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
    let HeroHolyStatueKeyInfoCls = null;
    try {
      HeroHolyStatueKeyInfoCls = asm.image.class(
        "SystemData/HeroHolyStatueKeyInfo",
      );
    } catch {}
    try {
      if (!HeroHolyStatueKeyInfoCls)
        HeroHolyStatueKeyInfoCls = asm.image.class("HeroHolyStatueKeyInfo");
    } catch {}
    let CDataHeroTower = null;
    try {
      CDataHeroTower = asm.image.class("CData_HeroTower_Element");
    } catch {}
    let CDataBattleAniEmoji = null;
    try {
      CDataBattleAniEmoji = asm.image.class("CData_BattleAniEmoji_Element");
    } catch {}
    let CDataEmoji = null;
    try {
      CDataEmoji = asm.image.class("CData_Emoji_Element");
    } catch {}
    let CDataBattleAniEmojiObj = null;
    try {
      CDataBattleAniEmojiObj = asm.image.class("CData_BattleAniEmoji");
    } catch {}
    let CDataEmojiObj = null;
    try {
      CDataEmojiObj = asm.image.class("CData_Emoji");
    } catch {}
    let HeroLeaderInfoCls = null;
    try {
      HeroLeaderInfoCls = asm.image.class("SystemData/HeroLeaderInfo");
    } catch {}
    try {
      if (!HeroLeaderInfoCls)
        HeroLeaderInfoCls = asm.image.class("HeroLeaderInfo");
    } catch {}
    let CDataHero = null;
    try {
      CDataHero = asm.image.class("CData_Hero_Element");
    } catch {}
    return {
      asm,
      SystemData,
      CmdHeroSkin,
      CmdHeroStatue: asm.image.class("MTTDProto.CmdHeroStatue"),
      HeroKeyInfoCls,
      HeroHolyStatueKeyInfoCls,
      CDataHeroCostume,
      CDataHeroTower,
      CDataBattleAniEmoji,
      CDataEmoji,
      CDataBattleAniEmojiObj,
      CDataEmojiObj,
      HeroLeaderInfoCls,
      CDataHero,
      CmdAniEmojiData: asm.image.class("MTTDProto.CmdAniEmojiData"),
      opts: resolveOptions(opts),
      curSkinOverrides: /* @__PURE__ */ new Map(),
      curStatueOverrides: /* @__PURE__ */ new Map(),
      curLeaderOverrides: /* @__PURE__ */ new Map(),
      serverPairs: [],
      serverStatuePairs: [],
      serverEmojiIds: [],
      serverLeaderIds: [],
      serverHeroes: [],
      serverDataPath: "",
      serverFullInject: true,
      unlockedSkins: /* @__PURE__ */ new Set(),
      unlockedStatues: /* @__PURE__ */ new Set(),
      unlockedEmojiIds: /* @__PURE__ */ new Set(),
      emojiFailLogged: /* @__PURE__ */ new Set(),
      emojiCatalogIds: /* @__PURE__ */ new Set(),
      leaderSkins: /* @__PURE__ */ new Set(),
      skinToHero: /* @__PURE__ */ new Map(),
      statueToHero: /* @__PURE__ */ new Map(),
      serverApplyTimer: null,
      serverLastApply: 0,
      lastDataServerError: "",
      curSkinSaveTimer: null,
    };
  }
  function rebuildUnlockSets(ctx) {
    const us = /* @__PURE__ */ new Set();
    const mp = /* @__PURE__ */ new Map();
    const uss = /* @__PURE__ */ new Set();
    const mps = /* @__PURE__ */ new Map();
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
    try {
      for (const pr of ctx.serverStatuePairs) {
        if (!pr) continue;
        uss.add(pr[1]);
        if (!mps.has(pr[1])) mps.set(pr[1], pr[0]);
      }
      ctx.curStatueOverrides.forEach((statueId, heroId) => {
        uss.add(statueId);
        if (!mps.has(statueId)) mps.set(statueId, heroId);
      });
    } catch {}
    ctx.unlockedSkins = us;
    ctx.skinToHero = mp;
    ctx.unlockedStatues = uss;
    ctx.statueToHero = mps;
    try {
      const usE = new Set(ctx.unlockedEmojiIds || []);
      for (const id of ctx.serverEmojiIds || []) usE.add(id);
      ctx.unlockedEmojiIds = usE;
    } catch {}
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
  function grantStatueInfo(ctx, heroId) {
    try {
      if (!ctx.HeroHolyStatueKeyInfoCls) return;
      const dict = ctx.SystemData.field("m_heroHolyStatueInfos").value;
      if (!dict || dict.isNull()) return;
      let has = false;
      try {
        has = dict.method("ContainsKey").invoke(heroId);
      } catch {}
      if (has) return;
      const inst = ctx.HeroHolyStatueKeyInfoCls.alloc();
      try {
        inst.method(".ctor").invoke();
      } catch {}
      try {
        inst.field("m_HeroId").value = heroId;
      } catch {}
      try {
        dict.method("set_Item").invoke(heroId, inst);
      } catch {}
    } catch {}
  }
  function grantStatue(ctx, heroId, statueId) {
    try {
      grantStatueInfo(ctx, heroId);
      const dict = ctx.SystemData.field("m_heroHolyStatueInfos").value;
      if (!dict || dict.isNull()) return;
      let hsi;
      try {
        hsi = dict.method("get_Item").invoke(heroId);
      } catch {
        return;
      }
      if (!hsi || hsi.isNull()) return;
      let list = hsi.field("m_herostatues").value;
      if (!list || list.isNull()) {
        try {
          const initM = hsi.tryMethod("Init");
          if (initM) initM.invoke();
        } catch {}
        try {
          list = hsi.field("m_herostatues").value;
        } catch {}
        if (!list || list.isNull()) return;
      }
      let inst = null;
      const cnt = list.method("get_Count").invoke();
      for (let i = 0; i < cnt; i++) {
        try {
          const it = list.method("get_Item").invoke(i);
          if (!it.isNull() && it.field("iId").value === statueId) {
            inst = it;
            break;
          }
        } catch {}
      }
      if (!inst) {
        inst = ctx.CmdHeroStatue.alloc();
        try {
          inst.method(".ctor").invoke();
        } catch {}
        try {
          inst.field("iId").value = statueId;
        } catch {}
        list.method("Add").invoke(inst);
      }
      try {
        const globalDict = ctx.SystemData.field("m_HeroStatues").value;
        if (globalDict && !globalDict.isNull()) {
          let has = false;
          try {
            has = globalDict.method("ContainsKey").invoke(statueId);
          } catch {}
          if (!has) globalDict.method("set_Item").invoke(statueId, inst);
        }
      } catch {}
    } catch {}
  }
  function collectStatuePairs(ctx) {
    const heroSet = /* @__PURE__ */ new Set();
    const pairSet = /* @__PURE__ */ new Set();
    const pairs = [];
    try {
      if (!ctx.CDataHeroTower) return { heroes: [], pairs };
      const instances = Il2Cpp.gc.choose(ctx.CDataHeroTower);
      for (const instance of instances) {
        try {
          if (!instance || instance.isNull()) continue;
          const heroId = Number(instance.field("m_HeroId").value);
          const statueId = Number(instance.field("m_ID").value);
          if (!Number.isFinite(heroId) || !Number.isFinite(statueId)) continue;
          heroSet.add(heroId);
          const k = `${heroId}:${statueId}`;
          if (!pairSet.has(k)) {
            pairSet.add(k);
            pairs.push([heroId, statueId]);
          }
        } catch {}
      }
    } catch {}
    return { heroes: Array.from(heroSet), pairs };
  }
  function grantLeader(ctx, leaderId) {
    try {
      const lid = Number(leaderId);
      if (!Number.isFinite(lid) || lid <= 0) return false;
      const dict = ctx.SystemData.field("m_leaderInfos").value;
      if (!dict || dict.isNull()) return false;
      let info = null;
      try {
        info = dict.method("get_Item").invoke(lid);
      } catch {}
      if (!info || info.isNull()) {
        try {
          info = ctx.SystemData.method("ForceCreateFreeLeader").invoke(lid);
        } catch {}
        if (!info || info.isNull()) {
          try {
            info = ctx.SystemData.method("CreateFreeLeader").invoke(lid);
          } catch {}
        }
        if ((!info || info.isNull()) && ctx.HeroLeaderInfoCls) {
          try {
            info = ctx.HeroLeaderInfoCls.alloc();
            try {
              info.method(".ctor").invoke(lid);
            } catch {}
            try {
              dict.method("set_Item").invoke(lid, info);
            } catch {}
          } catch {}
        }
      }
      let ok = false;
      if (info && !info.isNull()) {
        try {
          info.field("bOwned").value = true;
          ok = true;
        } catch {}
        try {
          info.field("bFree").value = false;
        } catch {}
      }
      try {
        ctx.SystemData.method("AddOwnLeader").invoke(lid);
      } catch {}
      try {
        ctx.leaderIds.add(lid);
      } catch {}
      return ok;
    } catch {
      return false;
    }
  }
  function collectLeaderIds(ctx) {
    const ids = [];
    try {
      if (!ctx.CDataHero) return ids;
      const instances = Il2Cpp.gc.choose(ctx.CDataHero);
      for (const instance of instances) {
        try {
          if (!instance || instance.isNull()) continue;
          const id = Number(instance.field("m_ID").value);
          if (Number.isFinite(id) && id > 0) ids.push(id);
        } catch {}
      }
    } catch {}
    return Array.from(new Set(ids));
  }
  function grantLeaderSkin(ctx, skinId) {
    try {
      const sid = Number(skinId);
      if (!Number.isFinite(sid) || sid <= 0) return false;
      const addM = ctx.SystemData.tryMethod("AddLeaderSkin");
      if (!addM) return false;
      const inst = ctx.CmdHeroSkin.alloc();
      try {
        inst.method(".ctor").invoke();
      } catch {}
      try {
        inst.field("iId").value = sid;
      } catch {}
      addM.invoke(inst);
      try {
        ctx.leaderSkins.add(sid);
      } catch {}
      return true;
    } catch {
      return false;
    }
  }
  function applyCurLeaderOverrides(ctx) {
    if (ctx.curLeaderOverrides.size === 0) return;
    try {
      const IDataSet = findClass(ctx.asm, "IndividualDataSet");
      if (!IDataSet) return;
      const mSet = IDataSet.tryMethod("SetCurLeaderByPvptype");
      if (!mSet) return;
      ctx.curLeaderOverrides.forEach((leaderId, pvptype) => {
        try {
          grantLeader(ctx, leaderId);
          mSet.invoke(pvptype, leaderId);
        } catch {}
      });
    } catch {}
  }
  function reapplyLeaderData(ctx) {
    try {
      for (const lid of ctx.serverLeaderIds) {
        try {
          grantLeader(ctx, lid);
        } catch {}
      }
      for (const sid of ctx.leaderSkins) {
        try {
          grantLeaderSkin(ctx, sid);
        } catch {}
      }
    } catch {}
    try {
      applyCurLeaderOverrides(ctx);
    } catch {}
  }
  function isEmojiUnlocked(ctx, emojiId) {
    try {
      const list = ctx.SystemData.field("_aniEmojiDataList").value;
      if (!list || list.isNull()) return false;
      const cnt = list.method("get_Count").invoke();
      for (let i = 0; i < cnt; i++) {
        try {
          const it = list.method("get_Item").invoke(i);
          if (it && !it.isNull() && Number(it.field("iId").value) === emojiId)
            return true;
        } catch {}
      }
    } catch {}
    return false;
  }
  function makeEmojiData(ctx, emojiId) {
    const inst = ctx.CmdAniEmojiData.alloc();
    try {
      inst.method(".ctor").invoke();
    } catch {}
    try {
      inst.field("iId").value = emojiId;
    } catch {}
    try {
      inst.field("iLimitTime").value = 0;
    } catch {}
    try {
      inst.field("iGetTime").value = 0;
    } catch {}
    return inst;
  }
  function grantEmoji(ctx, emojiId) {
    let ok = false;
    try {
      if (!Number.isFinite(emojiId) || emojiId <= 0) return false;
      if (isEmojiUnlocked(ctx, emojiId)) {
        ok = true;
      } else {
        try {
          const list = ctx.SystemData.field("_aniEmojiDataList").value;
          if (list && !list.isNull()) {
            const inst = makeEmojiData(ctx, emojiId);
            list.method("Add").invoke(inst);
          }
        } catch {}
        if (!isEmojiUnlocked(ctx, emojiId)) {
          try {
            ctx.SystemData.method("AddAniEmojiData").invoke(emojiId, 0, 0);
          } catch (e) {
            if (!ctx.emojiFailLogged.has(emojiId)) {
              ctx.emojiFailLogged.add(emojiId);
              ctx.opts.log(`[EMOJI] AddAniEmojiData(${emojiId}) gagal: ${e}`);
            }
          }
          ok = isEmojiUnlocked(ctx, emojiId);
        } else {
          ok = true;
        }
      }
    } catch (e) {
      if (!ctx.emojiFailLogged.has(emojiId)) {
        ctx.emojiFailLogged.add(emojiId);
        ctx.opts.log(`[EMOJI] grant ${emojiId} gagal: ${e}`);
      }
      ok = isEmojiUnlocked(ctx, emojiId);
    }
    try {
      if (ok) ctx.unlockedEmojiIds.add(emojiId);
      if (!ctx.serverEmojiIds.includes(emojiId))
        ctx.serverEmojiIds.push(emojiId);
    } catch {}
    return ok;
  }
  function enumerateSharedDictValues(value) {
    const vals = [];
    try {
      if (!value || value.isNull()) return vals;
      const getEnum = value.tryMethod("GetEnumerator");
      if (getEnum) {
        const e = getEnum.invoke();
        while (e && !e.isNull() && e.method("MoveNext").invoke()) {
          try {
            const kvp = e.method("get_Current").invoke();
            vals.push(kvp.method("get_Value").invoke());
          } catch {}
        }
        return vals;
      }
      const getValues = value.tryMethod("get_Values");
      if (getValues) {
        const vc = getValues.invoke();
        const e2 = vc.method("GetEnumerator").invoke();
        while (e2 && !e2.isNull() && e2.method("MoveNext").invoke()) {
          vals.push(e2.method("get_Current").invoke());
        }
      }
    } catch {}
    return vals;
  }
  function collectEmojiIdsFromTable(ctx, mgrCls, idField, pushId) {
    try {
      if (!mgrCls) return false;
      let inst = mgrCls.field("m_Instance").value;
      if (!inst || inst.isNull()) return false;
      let data = null;
      try {
        const f = inst.tryField("m_Data");
        if (f) data = f.value;
      } catch {}
      if (!data || data.isNull()) {
        try {
          const fw = inst.tryField("m_DataWriteTarget");
          if (fw) data = fw.value;
        } catch {}
      }
      if (!data || data.isNull()) return false;
      const vals = enumerateSharedDictValues(data);
      if (vals.length === 0) return false;
      let n = 0;
      for (const v of vals) {
        try {
          if (!v || v.isNull()) continue;
          const id = Number(v.field(idField).value);
          if (Number.isFinite(id) && id > 0) {
            pushId(id);
            n++;
          }
        } catch {}
      }
      if (n > 0)
        ctx.opts.log(
          `[EMOJI] katalog ${mgrCls.name}: ${n} elemen dari m_Data.`,
        );
      return n > 0;
    } catch {
      return false;
    }
  }
  function hookEmojiCatalogCollect(ctx) {
    const addId = function (id) {
      try {
        const n = Number(id);
        if (Number.isFinite(n) && n > 0 && !ctx.emojiCatalogIds.has(n)) {
          ctx.emojiCatalogIds.add(n);
          ctx.opts.log(`[EMOJI] katalog + emoji ${n}`);
        }
      } catch {}
    };
    for (const spec of [
      { cls: "CData_BattleAniEmoji", field: "m_ID" },
      { cls: "CData_Emoji", field: "m_EmojiID" },
    ]) {
      try {
        const clsC = ctx.asm.image.class(spec.cls);
        const gm = clsC.tryMethod("GetValue_ByID");
        if (gm) {
          try {
            void gm.nativeFunction;
          } catch {}
          gm.implementation = function (id) {
            const ret = this.method("GetValue_ByID").invoke(id);
            try {
              addId(id);
              if (ret && !ret.isNull()) addId(ret.field(spec.field).value);
            } catch {}
            return ret;
          };
          ctx.opts.log(`[+] [EMOJI] ${spec.cls}.GetValue_ByID hook terpasang.`);
        }
        const pm = clsC.tryMethod("ParseElement");
        if (pm) {
          try {
            void pm.nativeFunction;
          } catch {}
          pm.implementation = function (bAddToMData) {
            const ret = this.method("ParseElement").invoke(bAddToMData);
            try {
              if (ret && !ret.isNull()) {
                try {
                  addId(ret.field("m_ID").value);
                } catch {}
                try {
                  addId(ret.field("m_EmojiID").value);
                } catch {}
              }
            } catch {}
            return ret;
          };
          ctx.opts.log(`[+] [EMOJI] ${spec.cls}.ParseElement hook terpasang.`);
        }
      } catch (e) {
        ctx.opts.log(`[!] [EMOJI] hook ${spec.cls} gagal: ` + e);
      }
    }
  }
  function collectEmojiIds(ctx) {
    const seen = /* @__PURE__ */ new Set();
    const ids = [];
    const pushId = function (id) {
      if (Number.isFinite(id) && id > 0 && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    };
    for (const id of ctx.emojiCatalogIds || []) pushId(id);
    for (const id of ctx.serverEmojiIds || []) pushId(id);
    let cntBattle = 0;
    try {
      if (ctx.CDataBattleAniEmoji) {
        const instances = Il2Cpp.gc.choose(ctx.CDataBattleAniEmoji);
        for (const instance of instances) {
          try {
            if (!instance || instance.isNull()) continue;
            const id = Number(instance.field("m_ID").value);
            if (Number.isFinite(id) && id > 0) {
              pushId(id);
              cntBattle++;
            }
          } catch {}
        }
      }
    } catch {}
    if (cntBattle < 3 && ctx.CDataBattleAniEmojiObj)
      collectEmojiIdsFromTable(
        ctx,
        ctx.CDataBattleAniEmojiObj,
        "m_ID",
        pushId,
      );
    let cntEmoji = 0;
    try {
      if (ctx.CDataEmoji) {
        const instances = Il2Cpp.gc.choose(ctx.CDataEmoji);
        for (const instance of instances) {
          try {
            if (!instance || instance.isNull()) continue;
            const id = Number(instance.field("m_EmojiID").value);
            if (Number.isFinite(id) && id > 0) {
              pushId(id);
              cntEmoji++;
            }
          } catch {}
        }
      }
    } catch {}
    if (cntEmoji < 3 && ctx.CDataEmojiObj)
      collectEmojiIdsFromTable(ctx, ctx.CDataEmojiObj, "m_EmojiID", pushId);
    return ids;
  }
  function applyEmojiServer(ctx) {
    try {
      if (ctx.serverEmojiIds.length === 0) return;
      for (const emojiId of ctx.serverEmojiIds) {
        try {
          grantEmoji(ctx, emojiId);
        } catch {}
      }
    } catch (e) {
      ctx.opts.log("[PRIVATE-SERVER] apply emoji gagal: " + e);
    }
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
    const statueCands = collectStatuePairs(ctx).pairs;
    let statueGranted = 0;
    for (const [heroId, statueId] of statueCands) {
      try {
        grantStatue(ctx, heroId, statueId);
        statueGranted++;
      } catch (error) {
        console.error(
          "Gagal grant pasangan hero-statue:",
          heroId,
          statueId,
          error,
        );
      }
    }
    ctx.serverStatuePairs = statueCands;
    const emojiCands = collectEmojiIds(ctx);
    let emojiGranted = 0;
    for (const emojiId of emojiCands) {
      try {
        if (grantEmoji(ctx, emojiId)) emojiGranted++;
      } catch {}
    }
    ctx.serverEmojiIds = emojiCands;
    const leaderCands = collectLeaderIds(ctx);
    let leaderGranted = 0;
    for (const leaderId of leaderCands) {
      try {
        if (grantLeader(ctx, leaderId)) leaderGranted++;
      } catch {}
    }
    ctx.serverLeaderIds = leaderCands;
    rebuildUnlockSets(ctx);
    ctx.opts.log(
      `[UNLOCK] granted ${granted}/${pairs.length} pasangan skin, ${statueGranted}/${statueCands.length} pasangan statue, ${emojiGranted}/${emojiCands.length} emoji, ${leaderGranted}/${leaderCands.length} leader.`,
    );
    return {
      heroes: new Set(pairs.map((p) => p[0])).size,
      pairs: pairs.length,
      statueHeroes: new Set(statueCands.map((p) => p[0])).size,
      statuePairs: statueCands.length,
      emojiIds: emojiCands.length,
      leaderIds: leaderCands.length,
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
        if (Array.isArray(obj.statuePairs)) {
          const pairsS = [];
          for (const p of obj.statuePairs) {
            if (Array.isArray(p) && p.length >= 2) {
              const h = Number(p[0]);
              const s = Number(p[1]);
              if (Number.isFinite(h) && Number.isFinite(s)) pairsS.push([h, s]);
            }
          }
          if (pairsS.length > 0) ctx.serverStatuePairs = pairsS;
        }
        if (Array.isArray(obj.emojiIds)) {
          const ids = obj.emojiIds.map(Number).filter((id) => Number.isFinite(id) && id > 0);
          if (ids.length > 0) {
            ctx.serverEmojiIds = Array.from(new Set([...(ctx.serverEmojiIds || []), ...ids]));
          }
        }
        if (Array.isArray(obj.leaderIds)) {
          const ids = obj.leaderIds.map(Number).filter((id) => Number.isFinite(id) && id > 0);
          if (ids.length > 0) ctx.serverLeaderIds = Array.from(new Set([...(ctx.serverLeaderIds || []), ...ids]));
        }
        if (
          pairs.length === 0 &&
          ctx.serverStatuePairs.length === 0 &&
          ctx.serverEmojiIds.length === 0 &&
          ctx.serverLeaderIds.length === 0
        ) {
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
        try {
          const csS = obj.curStatues;
          if (csS && typeof csS === "object") {
            let n = 0;
            for (const [k, v] of Object.entries(csS)) {
              const h = Number(k);
              const s = Number(v);
              if (Number.isFinite(h) && Number.isFinite(s) && h > 0 && s > 0) {
                ctx.curStatueOverrides.set(h, s);
                n++;
              }
            }
            if (n > 0) {
              ctx.opts.log(`[STATUE] restore ${n} curStatues dari ${c}`);
              try {
                applyCurStatueOverrides(ctx);
              } catch {}
            }
          }
        } catch {}
        try {
          const csL = obj.curLeaders;
          if (csL && typeof csL === "object") {
            let nL = 0;
            for (const [k, v] of Object.entries(csL)) {
              const pt = Number(k);
              const s = Number(v);
              if (Number.isFinite(pt) && Number.isFinite(s) && s > 0) {
                ctx.curLeaderOverrides.set(pt, s);
                nL++;
              }
            }
            if (nL > 0) ctx.opts.log(`[LEADER] restore ${nL} curLeaders dari ${c}`);
          }
        } catch {}
        try {
          if (ctx.serverEmojiIds.length > 0) {
            try {
              applyEmojiServer(ctx);
            } catch {}
          }
        } catch {}
        try {
          if (ctx.serverLeaderIds.length > 0 || ctx.curLeaderOverrides.size > 0) {
            reapplyLeaderData(ctx);
          }
        } catch {}
        rebuildUnlockSets(ctx);
        ctx.opts.log(
          `[PRIVATE-SERVER] dimuat ${pairs.length} pairs skin (${ctx.serverHeroes.length} hero) + ${ctx.serverStatuePairs.length} pairs statue + ${ctx.serverEmojiIds.length} emoji + ${ctx.serverLeaderIds.length} leader dari ${c}`,
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
      const curS = {};
      try {
        ctx.curStatueOverrides.forEach((statueId, heroId) => {
          curS[String(heroId)] = statueId;
        });
      } catch {}
      const curL = {};
      try {
        ctx.curLeaderOverrides.forEach((leaderId, pvptype) => {
          curL[String(pvptype)] = leaderId;
        });
      } catch {}
      const statueCands = collectStatuePairs(ctx).pairs;
      const merged = new Map();
      for (const pr of Array.from(ctx.serverStatuePairs || [])) {
        if (Array.isArray(pr) && pr.length >= 2)
          merged.set(`${Number(pr[0])}:${Number(pr[1])}`, [Number(pr[0]), Number(pr[1])]);
      }
      for (const pr of statueCands) {
        merged.set(`${Number(pr[0])}:${Number(pr[1])}`, [Number(pr[0]), Number(pr[1])]);
      }
      const statuePairs = Array.from(merged.values());
      ctx.serverStatuePairs = statuePairs;
      rebuildUnlockSets(ctx);
      const emojiCands = collectEmojiIds(ctx);
      const emojiMerged = new Set(ctx.serverEmojiIds || []);
        for (const id of emojiCands) emojiMerged.add(id);
      ctx.serverEmojiIds = Array.from(emojiMerged);
      try {
        if (ctx.serverLeaderIds.length === 0) {
          const leaderCands = collectLeaderIds(ctx);
          if (leaderCands.length > 0) ctx.serverLeaderIds = leaderCands;
        }
      } catch {}
      rebuildUnlockSets(ctx);
      const payload = JSON.stringify(
        {
          version: 1,
          savedAt: Date.now(),
          heroes,
          pairs,
          statuePairs,
          emojiIds: ctx.serverEmojiIds,
          leaderIds: ctx.serverLeaderIds,
          curSkins: cur,
          curStatues: curS,
          curLeaders: curL,
        },
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
              `[PRIVATE-SERVER] tersimpan ${pairs.length} pairs skin (${heroes.length} hero) + ${statuePairs.length} pairs statue + ${ctx.serverEmojiIds.length} emoji + ${ctx.serverLeaderIds.length} leader -> ${c}`,
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
      const curS = {};
      ctx.curStatueOverrides.forEach((statueId, heroId) => {
        curS[String(heroId)] = statueId;
      });
      const curL = {};
      ctx.curLeaderOverrides.forEach((leaderId, pvptype) => {
        curL[String(pvptype)] = leaderId;
      });
      const found = readServerJson(ctx);
      if (found) {
        try {
          found.obj.curSkins = cur;
          found.obj.curStatues = curS;
          found.obj.curLeaders = curL;
          if (Array.isArray(ctx.serverLeaderIds) && ctx.serverLeaderIds.length > 0)
            found.obj.leaderIds = ctx.serverLeaderIds;
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
              `[CURSKIN] tersimpan ${Object.keys(cur).length} curSkins + ${Object.keys(curS).length} curStatues -> ${found.path}`,
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
          statuePairs: ctx.serverStatuePairs,
          emojiIds: ctx.serverEmojiIds,
          leaderIds: ctx.serverLeaderIds,
          curSkins: cur,
          curStatues: curS,
          curLeaders: curL,
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
      if (
        !r.success ||
        (ctx.serverPairs.length === 0 && ctx.serverStatuePairs.length === 0)
      )
        return;
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
    const statuePairs = ctx.serverStatuePairs.slice();
    ctx.opts.log(
      `[PRIVATE-SERVER] apply ${pairs.length} pairs skin + ${statuePairs.length} pairs statue (${ctx.opts.batchSize}/${ctx.opts.batchDelayMs}ms)...`,
    );
    applyServerPairsFast(ctx, pairs, () => {
      try {
        applyStatueServer(ctx);
      } catch {}
      try {
        applyCurSkinOverrides(ctx);
      } catch {}
      ctx.opts.log(`[PRIVATE-SERVER] SELESAI ${pairs.length} pairs skin + ${ctx.serverStatuePairs.length} pairs statue.`);
    });
  }
  function applyStatueServer(ctx) {
    try {
      if (ctx.serverStatuePairs.length > 0) {
        ctx.opts.log(
          `[PRIVATE-SERVER] apply statue ${ctx.serverStatuePairs.length} pairs...`,
        );
        for (const pr of ctx.serverStatuePairs) {
          if (!pr) continue;
          try {
            grantStatue(ctx, pr[0], pr[1]);
          } catch {}
        }
      }
    } catch (e) {
      ctx.opts.log("[PRIVATE-SERVER] apply statue gagal: " + e);
    }
    try {
      applyEmojiServer(ctx);
    } catch {}
    try {
      for (const lid of ctx.serverLeaderIds) {
        try {
          grantLeader(ctx, lid);
        } catch {}
      }
    } catch {}
    try {
      applyCurLeaderOverrides(ctx);
    } catch {}
    try {
      applyCurStatueOverrides(ctx);
    } catch {}
  }
  function dbgDataServer(ctx) {
    ctx.opts.log("[PRIVATE-SERVER] === DEBUG ===");
    ctx.opts.log(
      `lastWritePath=${ctx.serverDataPath || "(kosong)"} memPairs=${ctx.serverPairs.length} memStatuePairs=${ctx.serverStatuePairs.length} memEmojiIds=${ctx.serverEmojiIds.length} lastErr=${ctx.lastDataServerError || "(tidak ada)"}`,
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
  function applyCurStatueOverrides(ctx) {
    if (ctx.curStatueOverrides.size === 0) return;
    try {
      const dict = ctx.SystemData.field("m_heroHolyStatueInfos").value;
      if (!dict || dict.isNull()) return;
      ctx.curStatueOverrides.forEach((statueId, heroId) => {
        try {
          let hsi = dict.method("get_Item").invoke(heroId);
          if (!hsi || hsi.isNull()) {
            grantStatueInfo(ctx, heroId);
            hsi = dict.method("get_Item").invoke(heroId);
            if (!hsi || hsi.isNull()) return;
          }
          const cur = Number(hsi.field("m_CurStatueId").value);
          if (cur !== statueId) {
            hsi.field("m_CurStatueId").value = statueId;
            ctx.opts.log(
              `[STATUE] re-apply Hero ${heroId}: curStatue ${cur} -> ${statueId}`,
            );
          }
        } catch {}
      });
    } catch {}
  }
  function startCurSkinReapply(ctx) {
    if (!ctx.opts.curSkinReapplyMs) return;
    try {
      setInterval(() => {
        applyCurSkinOverrides(ctx);
        applyCurStatueOverrides(ctx);
        applyEmojiServer(ctx);
      }, ctx.opts.curSkinReapplyMs);
      ctx.opts.log(
        `[+] [SETCURSKIN] interval re-apply ${ctx.opts.curSkinReapplyMs}ms aktif.`,
      );
    } catch {}
  }
  function patchHeroGetListSC(ctx, sc) {
    if (ctx.curSkinOverrides.size === 0 && ctx.curStatueOverrides.size === 0)
      return;
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
            if (want !== void 0) {
              const cur = hero.field("iCurrentSkin").value;
              if (cur !== want) {
                hero.field("iCurrentSkin").value = want;
                ctx.opts.log(
                  `[SERVER_PATCH] vHeroList Hero ${hid}: iCurrentSkin ${cur} -> ${want}`,
                );
              }
            }
            const wantStatue = ctx.curStatueOverrides.get(hid);
            if (wantStatue !== void 0) {
              const curS = Number(hero.field("iCurrentStatue").value);
              if (curS !== wantStatue) {
                hero.field("iCurrentStatue").value = wantStatue;
                ctx.opts.log(
                  `[SERVER_PATCH] vHeroList Hero ${hid}: iCurrentStatue ${curS} -> ${wantStatue}`,
                );
              }
            }
          } catch {}
        }
      }
    } catch {}
    try {
      const vStatueList = sc.field("vStatueList").value;
      if (vStatueList && !vStatueList.isNull()) {
        const n = vStatueList.method("get_Count").invoke();
        const existing = /* @__PURE__ */ new Set();
        for (let i = 0; i < n; i++) {
          try {
            const st = vStatueList.method("get_Item").invoke(i);
            if (st && !st.isNull()) existing.add(Number(st.field("iId").value));
          } catch {}
        }
        ctx.curStatueOverrides.forEach((statueId) => {
          if (existing.has(statueId)) return;
          try {
            const inst = ctx.CmdHeroStatue.alloc();
            try {
              inst.method(".ctor").invoke();
            } catch {}
            try {
              inst.field("iId").value = statueId;
            } catch {}
            vStatueList.method("Add").invoke(inst);
            existing.add(statueId);
            ctx.opts.log(`[SERVER_PATCH] vStatueList inject statue ${statueId}`);
          } catch (e) {
            ctx.opts.log(
              `[SERVER_PATCH] inject statue ${statueId} gagal: ${e}`,
            );
          }
        });
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
      if (ctx.serverPairs.length === 0 && ctx.serverStatuePairs.length === 0)
        return;
      const t0 = Date.now();
      let okS = 0;
      if (ctx.serverPairs.length > 0) {
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
          okS = ok;
          if (queued > 0) {
            ctx.opts.log(
              `[UNLOCK-GATE] vSkinList inject ${ok}/${queued} unlock skins (${Date.now() - t0}ms)`,
            );
          }
        }
      }
      if (ctx.serverStatuePairs.length > 0) {
        const vStatueList = sc.field("vStatueList").value;
        if (vStatueList && !vStatueList.isNull()) {
          const n = vStatueList.method("get_Count").invoke();
          const existing = /* @__PURE__ */ new Set();
          for (let i = 0; i < n; i++) {
            try {
              const st = vStatueList.method("get_Item").invoke(i);
              if (st && !st.isNull()) existing.add(Number(st.field("iId").value));
            } catch {}
          }
          const mAdd = vStatueList.method("Add");
          let queued = 0;
          for (const pr of ctx.serverStatuePairs) {
            if (!pr || existing.has(pr[1])) continue;
            queued++;
            try {
              const inst = ctx.CmdHeroStatue.alloc();
              try {
                inst.method(".ctor").invoke();
              } catch {}
              try {
                inst.field("iId").value = pr[1];
              } catch {}
              mAdd.invoke(inst);
              existing.add(pr[1]);
            } catch {}
          }
          if (queued > 0) {
            ctx.opts.log(
              `[UNLOCK-GATE] vStatueList inject statue (${queued} kandidat)`,
            );
          }
        }
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
        "[+] [UNLOCK-GATE] SystemData.IsHaveSkinForever hook terpasang.",
      );
    } catch (e) {
      ctx.opts.log("[!] [UNLOCK-GATE] hook IsHaveSkinForever gagal: " + e);
    }
    for (const methName of ["IsHaveStatue", "IsHaveStatueForever"]) {
      try {
        const ist = SystemData.tryMethod(methName);
        if (!ist) {
          ctx.opts.log(
            `[-] [UNLOCK-GATE] SystemData.${methName} tidak ditemukan.`,
          );
          continue;
        }
        try {
          void ist.nativeFunction;
        } catch {}
        ist.implementation = function (statueid) {
          const ret = this.method(methName).invoke(statueid);
          try {
            if (ret && !ret.isNull()) return ret;
            const sid = Number(statueid);
            if (ensureUnlockedStatue(sid)) {
              const ret2 = this.method(methName).invoke(sid);
              try {
                if (ret2 && !ret2.isNull()) {
                  ctx.opts.log(`[UNLOCK-GATE] ${methName}(${sid}) -> granted`);
                  return ret2;
                }
              } catch {}
            }
          } catch {}
          return ret;
        };
        ctx.opts.log(
          `[+] [UNLOCK-GATE] SystemData.${methName} hook terpasang.`,
        );
      } catch (e) {
        ctx.opts.log(`[!] [UNLOCK-GATE] hook ${methName} gagal: ` + e);
      }
    }
    hookBoolFalse(ctx, SystemData, "IsForbidStatue", "FORBID");
  }
  function hookStatueChangeFromUi(ctx) {
    try {
      const dst = ctx.SystemData.tryMethod("DressHeroStatueByHeroId");
      if (!dst) {
        ctx.opts.log("[-] [STATUE] DressHeroStatueByHeroId tidak ditemukan.");
      } else {
        try {
          void dst.nativeFunction;
        } catch {}
        dst.implementation = function (heroId, statusId) {
          const ret = this.method("DressHeroStatueByHeroId").invoke(
            heroId,
            statusId,
          );
          try {
            const hid = Number(heroId);
            const sid = Number(statusId);
            if (
              Number.isFinite(hid) &&
              Number.isFinite(sid) &&
              hid > 0 &&
              sid > 0
            ) {
              grantStatueInfo(ctx, hid);
              grantStatue(ctx, hid, sid);
              ctx.curStatueOverrides.set(hid, sid);
              try {
                rebuildUnlockSets(ctx);
              } catch {}
              applyCurStatueOverrides(ctx);
              try {
                scheduleCurSkinSave(ctx);
              } catch {}
              ctx.opts.log(
                `[STATUE] DressHeroStatueByHeroId Hero ${hid} -> statue ${sid} (override disimpan)`,
              );
            }
          } catch {}
          return ret;
        };
        ctx.opts.log("[+] [STATUE] DressHeroStatueByHeroId hook terpasang.");
      }
    } catch (e) {
      ctx.opts.log("[!] [STATUE] hook DressHeroStatueByHeroId gagal: " + e);
    }
    try {
      const ds = ctx.SystemData.tryMethod("DressHeroStatue");
      if (!ds) {
        ctx.opts.log("[-] [STATUE] DressHeroStatue tidak ditemukan.");
      } else {
        try {
          void ds.nativeFunction;
        } catch {}
        ds.implementation = function (statusId) {
          const ret = this.method("DressHeroStatue").invoke(statusId);
          try {
            const sid = Number(statusId);
            const hid = ctx.statueToHero.get(sid);
            if (Number.isFinite(sid) && sid > 0 && hid !== void 0) {
              grantStatueInfo(ctx, hid);
              grantStatue(ctx, hid, sid);
              ctx.curStatueOverrides.set(hid, sid);
              try {
                rebuildUnlockSets(ctx);
              } catch {}
              applyCurStatueOverrides(ctx);
              try {
                scheduleCurSkinSave(ctx);
              } catch {}
              ctx.opts.log(
                `[STATUE] DressHeroStatue statue ${sid} -> Hero ${hid} (override disimpan)`,
              );
            }
          } catch {}
          return ret;
        };
        ctx.opts.log("[+] [STATUE] DressHeroStatue hook terpasang.");
      }
    } catch (e) {
      ctx.opts.log("[!] [STATUE] hook DressHeroStatue gagal: " + e);
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
  function patchServerStatue(ctx, heroId, statueId) {
    try {
      ctx.curStatueOverrides.set(heroId, statueId);
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
        grantStatue(ctx, heroId, statueId);
      } catch (e) {
        ctx.opts.log("[SERVER_PATCH] grantStatue gagal: " + e);
      }
      applyCurStatueOverrides(ctx);
      try {
        scheduleCurSkinSave(ctx);
      } catch {}
      ctx.opts.log(
        `[SERVER_PATCH] override disimpan: Hero ${heroId} statue ${statueId} (serverObj + m_heroHolyStatueInfos)`,
      );
    } catch (e) {
      ctx.opts.log("[SERVER_PATCH] statue gagal: " + e);
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
    const ensureUnlockedStatue = function (statueId) {
      try {
        if (ctx.unlockedStatues.has(statueId)) {
          const hid = ctx.statueToHero.get(statueId);
          if (hid !== void 0) {
            try {
              grantStatueInfo(ctx, hid);
            } catch {}
            try {
              grantStatue(ctx, hid, statueId);
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
    for (const methName of ["IsHaveLeader", "IsRealHaveLeader"]) {
      try {
        const ml = SystemData.tryMethod(methName);
        if (!ml) {
          ctx.opts.log(`[-] [UNLOCK-GATE] SystemData.${methName} tidak ditemukan.`);
          continue;
        }
        try {
          void ml.nativeFunction;
        } catch {}
        ml.implementation = function (leaderid) {
          const ret = this.method(methName).invoke(leaderid);
          try {
            const sid = Number(leaderid);
            if (!ret && ctx.leaderIds.has(sid)) {
              grantLeader(ctx, sid);
              const ret2 = this.method(methName).invoke(sid);
              if (ret2) {
                ctx.opts.log(`[UNLOCK-GATE] ${methName}(${sid}) -> granted`);
                return ret2;
              }
            }
          } catch {}
          return ret;
        };
        ctx.opts.log(`[+] [UNLOCK-GATE] SystemData.${methName} hook terpasang.`);
      } catch (e) {
        ctx.opts.log(`[!] [UNLOCK-GATE] hook ${methName} gagal: ` + e);
      }
    }
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
            try {
              applyCurStatueOverrides(ctx);
            } catch {}
            try {
              applyEmojiServer(ctx);
            } catch {}
            try {
              for (const lid of ctx.serverLeaderIds) {
                try {
                  grantLeader(ctx, lid);
                } catch {}
              }
            } catch {}
            try {
              applyCurLeaderOverrides(ctx);
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
      const IDataSet = findClass(ctx.asm, "IndividualDataSet");
      if (IDataSet) {
        try {
          const initM = IDataSet.tryMethod("InitIndividualData");
          if (initM) {
            try {
              void initM.nativeFunction;
            } catch {}
            initM.implementation = function (ack) {
              const ret = this.method("InitIndividualData").invoke(ack);
              try {
                for (const lid of ctx.serverLeaderIds) {
                  try {
                    grantLeader(ctx, lid);
                  } catch {}
                }
                for (const sid of ctx.leaderSkins) {
                  try {
                    grantLeaderSkin(ctx, sid);
                  } catch {}
                }
                applyCurLeaderOverrides(ctx);
                ctx.opts.log("[LEADER] InitIndividualData: data leader di-re-grant.");
              } catch {}
              return ret;
            };
            ctx.opts.log("[+] [LEADER] IndividualDataSet.InitIndividualData hook terpasang.");
          }
        } catch {}
        try {
          const setCur = IDataSet.tryMethod("SetCurLeaderByPvptype");
          if (setCur) {
            try {
              void setCur.nativeFunction;
            } catch {}
            setCur.implementation = function (pvptype, uiCommanderID) {
              const ret = this.method("SetCurLeaderByPvptype").invoke(pvptype, uiCommanderID);
              try {
                const pt = Number(pvptype);
                const lid = Number(uiCommanderID);
                if (Number.isFinite(pt) && Number.isFinite(lid) && lid > 0) {
                  grantLeader(ctx, lid);
                  ctx.curLeaderOverrides.set(pt, lid);
                  try {
                    scheduleCurSkinSave(ctx);
                  } catch {}
                  ctx.opts.log(`[LEADER] SetCurLeader pvptype ${pt} -> commander ${lid} (precaptured)`);
                }
              } catch {}
              return ret;
            };
            ctx.opts.log("[+] [LEADER] IndividualDataSet.SetCurLeaderByPvptype hook terpasang.");
          }
        } catch {}
      } else {
        ctx.opts.log("[-] [LEADER] IndividualDataSet tidak ditemukan.");
      }
    } catch (e) {
      ctx.opts.log("[!] [LEADER] hook IndividualDataSet gagal: " + e);
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
      const GRMStatue = ctx.asm.image.class("GameReceiveMessage");
      const setHolyStatue = GRMStatue.tryMethod("on_Item_Set_HolyStatue_SC");
      if (!setHolyStatue) {
        ctx.opts.log(
          "[-] [SERVER_PATCH] on_Item_Set_HolyStatue_SC tidak ditemukan.",
        );
      } else {
        try {
          void setHolyStatue.nativeFunction;
        } catch {}
        setHolyStatue.implementation = function (retMsg) {
          const ret = this.method("on_Item_Set_HolyStatue_SC").invoke(retMsg);
          try {
            applyCurStatueOverrides(ctx);
          } catch {}
          return ret;
        };
        ctx.opts.log(
          "[+] [SERVER_PATCH] on_Item_Set_HolyStatue_SC hook terpasang.",
        );
      }
    } catch (e) {
      ctx.opts.log(
        "[!] [SERVER_PATCH] hook on_Item_Set_HolyStatue_SC gagal: " + e,
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
      try {
        const statueDict = ctx.SystemData.field("m_heroHolyStatueInfos").value;
        if (!statueDict || statueDict.isNull()) {
          ctx.opts.log("[SERVER_HOOK] SystemData.m_heroHolyStatueInfos = NULL");
          return;
        }
        const statueEnum = statueDict.method("GetEnumerator").invoke();
        let statueCount = 0;
        ctx.opts.log(`
[SERVER_HOOK] === SystemData.m_heroHolyStatueInfos ===`);
        while (
          statueEnum &&
          !statueEnum.isNull() &&
          statueEnum.method("MoveNext").invoke()
        ) {
          try {
            const kvp = statueEnum.method("get_Current").invoke();
            if (!kvp || kvp.isNull()) continue;
            const hsi = kvp.method("get_Value").invoke();
            if (!hsi || hsi.isNull()) continue;
            statueCount++;
            const heroId = hsi.field("m_HeroId").value;
            const curStatue = hsi.field("m_CurStatueId").value;
            const list = hsi.field("m_herostatues").value;
            const cnt =
              list && !list.isNull() ? list.method("get_Count").invoke() : 0;
            ctx.opts.log(
              `[SERVER_HOOK] Hero ${heroId}: curStatue=${curStatue} statues=${cnt}`,
            );
            for (let j = 0; j < cnt; j++) {
              try {
                const st = list.method("get_Item").invoke(j);
                if (!st || st.isNull()) continue;
                ctx.opts.log(
                  `[SERVER_HOOK]   statue iId=${st.field("iId").value} iLimitTime=${st.field("iLimitTime").value} iSource=${st.field("iSource").value}`,
                );
              } catch {}
            }
          } catch {}
        }
        ctx.opts.log(
          `[SERVER_HOOK] === END STATUE (${statueCount} hero) ===`,
        );
      } catch (e) {
        ctx.opts.log("[SERVER_HOOK] dump statue gagal: " + e);
      }
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
    globalThis.dumpAniEmojiData = function () {
      try {
        const list = ctx.SystemData.field("_aniEmojiDataList").value;
        if (!list || list.isNull()) {
          ctx.opts.log("[EMOJI] SystemData._aniEmojiDataList = NULL");
          return;
        }
        const cnt = list.method("get_Count").invoke();
        ctx.opts.log(`
[EMOJI] === OWNED ANI EMOJI (${cnt}) ===`);
        for (let i = 0; i < cnt; i++) {
          try {
            const it = list.method("get_Item").invoke(i);
            if (!it || it.isNull()) continue;
            ctx.opts.log(
              `[EMOJI]   iId=${it.field("iId").value} iLimitTime=${it.field("iLimitTime").value} iGetTime=${it.field("iGetTime").value}`,
            );
          } catch {}
        }
        ctx.opts.log("[EMOJI] === END ===");
      } catch (e) {
        ctx.opts.log("[EMOJI] dump gagal: " + e);
      }
    };
    globalThis.dumpLeaders = function () {
      try {
        const dict = ctx.SystemData.field("m_leaderInfos").value;
        if (!dict || dict.isNull()) {
          ctx.opts.log("[LEADER] m_leaderInfos = NULL");
          return;
        }
        ctx.opts.log("[LEADER] === m_leaderInfos ===");
        let n = 0;
        for (const lid of ctx.leaderIds) {
          try {
            const info = dict.method("get_Item").invoke(lid);
            if (!info || info.isNull()) continue;
            n++;
            const owned = info.field("bOwned").value;
            const free = info.field("bFree").value;
            const lvl = info.field("iLevel").value;
            ctx.opts.log(
              `[LEADER] Leader ${lid}: owned=${owned} free=${free} level=${lvl}`,
            );
          } catch {}
        }
        ctx.opts.log(`[LEADER] === END (${n} di-grant) ===`);
      } catch (e) {
        ctx.opts.log("[LEADER] dump gagal: " + e);
      }
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
    hookStatueChangeFromUi(ctx);
    hookServerPacket(ctx);
    hookEmojiCatalogCollect(ctx);
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
        try {
          scheduleCurSkinSave(ctx);
        } catch {}
        log2(
          `[SETCURSKIN] override disimpan: Hero ${heroId} -> ${skinId} (re-apply tiap ${ctx.opts.curSkinReapplyMs}ms)`,
        );
      } catch (e) {
        log2("[SETCURSKIN] gagal: " + e);
      }
    };
    globalThis.setCurStatue = function (heroId, statueId) {
      try {
        grantStatueInfo(ctx, heroId);
        grantStatue(ctx, heroId, statueId);
        ctx.curStatueOverrides.set(heroId, statueId);
        try {
          rebuildUnlockSets(ctx);
        } catch {}
        applyCurStatueOverrides(ctx);
        try {
          scheduleCurSkinSave(ctx);
        } catch {}
        log2(
          `[STATUE] override disimpan: Hero ${heroId} -> statue ${statueId} (re-apply tiap ${ctx.opts.curSkinReapplyMs}ms)`,
        );
      } catch (e) {
        log2("[STATUE] gagal: " + e);
      }
    };
    globalThis.clearCurStatueOverrides = function () {
      ctx.curStatueOverrides.clear();
      log2("[STATUE] semua override curStatue dibersihkan");
    };
    globalThis.UnlockStatue = function (statueId) {
      try {
        let heroId = ctx.statueToHero.get(statueId);
        if (heroId === void 0) {
          const pr = ctx.serverStatuePairs.find((p) => p && p[1] === statueId);
          if (pr) heroId = pr[0];
        }
        if (heroId === void 0) {
          log2(
            `[STATUE] hero untuk statue ${statueId} tidak dikenali. Jalankan UnlockAll() atau setCurStatue(heroId, statueId).`,
          );
          return;
        }
        grantStatueInfo(ctx, heroId);
        grantStatue(ctx, heroId, statueId);
        log2(`[STATUE] unlocked statue ${statueId} (hero ${heroId})`);
      } catch (e) {
        log2("[STATUE] gagal: " + e);
      }
    };
    globalThis.UnlockAllStatue = function () {
      try {
        if (ctx.serverStatuePairs.length === 0)
          ctx.serverStatuePairs = collectStatuePairs(ctx).pairs;
        rebuildUnlockSets(ctx);
        let n = 0;
        for (const [heroId, statueId] of ctx.serverStatuePairs) {
          try {
            grantStatue(ctx, heroId, statueId);
            n++;
          } catch {}
        }
        applyCurStatueOverrides(ctx);
        try {
          scheduleCurSkinSave(ctx);
        } catch {}
        log2(`[STATUE] UnlockAllStatue selesai: ${n} pasangan di-grant.`);
        return n;
      } catch (e) {
        log2("[STATUE] gagal: " + e);
        return 0;
      }
    };
    globalThis.UnlockEmoji = function (emojiId) {
      try {
        const added = grantEmoji(ctx, Number(emojiId));
        if (added) {
          log2(`[EMOJI] unlocked emoji ${emojiId}`);
          try {
            scheduleCurSkinSave(ctx);
          } catch {}
        } else {
          log2(`[EMOJI] emoji ${emojiId} sudah unlocked / invalid.`);
        }
        return added;
      } catch (e) {
        log2("[EMOJI] gagal: " + e);
        return false;
      }
    };
    globalThis.UnlockAllEmoji = function () {
      try {
        if (ctx.serverEmojiIds.length === 0)
          ctx.serverEmojiIds = collectEmojiIds(ctx);
        rebuildUnlockSets(ctx);
        if (ctx.serverEmojiIds.length === 0) {
          log2(
            "[EMOJI] katalog masih kosong (tabel enum belum ke-load). Buka UI chat/emoji dulu, lalu ulangi UnlockAllEmoji().",
          );
          return 0;
        }
        let n = 0;
        let ok = 0;
        for (const emojiId of ctx.serverEmojiIds) {
          try {
            if (grantEmoji(ctx, emojiId)) {
              n++;
              ok++;
            }
          } catch {}
        }
        try {
          scheduleCurSkinSave(ctx);
        } catch {}
        log2(
          `[EMOJI] UnlockAllEmoji selesai: ${ok}/${ctx.serverEmojiIds.length} emoji (${n} baru di-grant).`,
        );
        return n;
      } catch (e) {
        log2("[EMOJI] gagal: " + e);
        return 0;
      }
    };
    globalThis.UnlockLeader = function (leaderId) {
      try {
        const ok = grantLeader(ctx, Number(leaderId));
        log2(`[LEADER] UnlockLeader ${leaderId}: ${ok ? "OK" : "gagal"}`);
        try {
          scheduleCurSkinSave(ctx);
        } catch {}
        return ok;
      } catch (e) {
        log2("[LEADER] gagal: " + e);
        return false;
      }
    };
    globalThis.UnlockAllLeaders = function () {
      try {
        if (ctx.serverLeaderIds.length === 0)
          ctx.serverLeaderIds = collectLeaderIds(ctx);
        rebuildUnlockSets(ctx);
        if (ctx.serverLeaderIds.length === 0) {
          log2(
            "[LEADER] katalog hero kosong (buka layar hero dulu, lalu ulangi UnlockAllLeaders()).",
          );
          return 0;
        }
        let n = 0;
        for (const lid of ctx.serverLeaderIds) {
          try {
            if (grantLeader(ctx, lid)) n++;
          } catch {}
        }
        try {
          scheduleCurSkinSave(ctx);
        } catch {}
        log2(
          `[LEADER] UnlockAllLeaders selesai: ${n}/${ctx.serverLeaderIds.length}.`,
        );
        return n;
      } catch (e) {
        log2("[LEADER] gagal: " + e);
        return 0;
      }
    };
    globalThis.UnlockAllLeader = function () {
      return globalThis.UnlockAllLeaders();
    };
    globalThis.setLeader = function (leaderId, pvptype) {
      try {
        grantLeader(ctx, Number(leaderId));
        const IDataSet = findClass(ctx.asm, "IndividualDataSet");
        if (!IDataSet) {
          log2("[LEADER] IndividualDataSet tidak ditemukan.");
          return;
        }
        const targets = [];
        if (Number.isFinite(Number(pvptype)) && pvptype !== void 0)
          targets.push(Number(pvptype));
        else {
          try {
            const dic = IDataSet.field("m_individualDic").value;
            if (dic && !dic.isNull()) {
              const enM = dic.method("GetEnumerator").invoke();
              while (enM && !enM.isNull() && enM.method("MoveNext").invoke()) {
                try {
                  targets.push(
                    Number(enM.method("get_Current").invoke().method("get_Key").invoke()),
                  );
                } catch {}
              }
            }
          } catch {}
          if (targets.length === 0) targets.push(0);
        }
        for (const pt of targets) {
          try {
            ctx.curLeaderOverrides.set(pt, Number(leaderId));
            IDataSet.method("SetCurLeaderByPvptype").invoke(pt, Number(leaderId));
          } catch {}
        }
        applyCurLeaderOverrides(ctx);
        try {
          scheduleCurSkinSave(ctx);
        } catch {}
        log2(
          `[LEADER] setLeader ${leaderId} untuk pvptype [${targets.join(",")}].`,
        );
      } catch (e) {
        log2("[LEADER] gagal: " + e);
      }
    };
    globalThis.grantLeaderSkin = function (skinId) {
      try {
        const ok = grantLeaderSkin(ctx, Number(skinId));
        try {
          scheduleCurSkinSave(ctx);
        } catch {}
        log2(`[LEADER] grantLeaderSkin ${skinId}: ${ok ? "OK" : "gagal"}`);
        return ok;
      } catch (e) {
        log2("[LEADER] gagal: " + e);
        return false;
      }
    };
    globalThis.patchServerStatue = function (heroId, statueId) {
      patchServerStatue(ctx, heroId, statueId);
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
      setCurStatue: (h, s) => globalThis.setCurStatue(h, s),
      patchServerSkin: (h, s) => patchServerSkin(ctx, h, s),
      patchServerStatue: (h, s) => patchServerStatue(ctx, h, s),
      unlockHero: (h) => grantHero(ctx, h),
      unlockStatue: (s) => globalThis.UnlockStatue(s),
      unlockAll: () => unlockAll(ctx),
      unlockAllStatue: () => globalThis.UnlockAllStatue(),
      unlockEmoji: (e) => globalThis.UnlockEmoji(e),
      unlockAllEmoji: () => globalThis.UnlockAllEmoji(),
      unlockLeader: (l) => globalThis.UnlockLeader(l),
      unlockAllLeaders: () => globalThis.UnlockAllLeaders(),
      setLeader: (l, p) => globalThis.setLeader(l, p),
      grantLeaderSkin: (s) => globalThis.grantLeaderSkin(s),
      applyCurSkinOverrides: () => applyCurSkinOverrides(ctx),
      applyCurStatueOverrides: () => applyCurStatueOverrides(ctx),
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
