/**
 * Free Skin Hook Module
 */

import { sessionState } from "../tools/config";
import { debugLog } from "../tools/utils";

export function setupSkinHooks(Assembly) {
  const safeClass = (name) => {
    try {
      const cls =
        (Assembly.tryClass && Assembly.tryClass(name)) || Assembly.class(name);
      if (!cls || !cls.handle || cls.handle.isNull()) return null;
      return cls;
    } catch (e) {
      return null;
    }
  };
  const hookMethod = (cls, name, fn) => {
    try {
      if (!cls) return false;
      const m = (cls.tryMethod && cls.tryMethod(name)) || cls.method(name);
      if (!m) return false;
      m.implementation = fn;
      return true;
    } catch (e) {
      return false;
    }
  };

  const SystemData = safeClass("SystemData");
  const CmdHeroSkin = safeClass("MTTDProto.CmdHeroSkin");
  const CmdHeroStatue = safeClass("MTTDProto.CmdHeroStatue");
  if (!SystemData || !CmdHeroSkin || !CmdHeroStatue) return;

  // Stealth: user tanpa izin = zero hook (tanpa jejak .implementation).
  if (!(sessionState.isAuthorized && sessionState.permissions.allowFreeSkin)) {
    debugLog("Skin", "Skipped (no allowFreeSkin).");
    return;
  }

  // ===== Dragon Crystal (pewarnaan skin) => dimiliki semua ===== //
  hookMethod(SystemData, "IsUnlockDragonCrystal", function (
    crystalID,
    bCheckShareInfo,
  ) {
    return true;
  });

  hookMethod(SystemData, "IsRealHaveHero", function (heroid) {
    return true;
  });

  // ===== Hero object-model (mirip pola skin: kembalikan objek palsu bila null) ===== //
  // GetHeroKeyInfo / GetHeroInfo mengembalikan SystemData.HeroKeyInfo (objek,
  // bukan bool) — pola fake-object sama seperti CmdHeroSkin pada skin.
  let HeroKeyInfoCls = null;
  try {
    HeroKeyInfoCls = Assembly.class("SystemData/HeroKeyInfo");
  } catch (e) {
    try {
      HeroKeyInfoCls = Assembly.class("HeroKeyInfo");
    } catch (e2) {
      debugLog("Skin", "class HeroKeyInfo tidak ditemukan.");
    }
  }

  try {
    const uif2 = safeClass("UIFuncs");
    if (!uif2) throw new Error("UIFuncs missing");
    hookMethod(uif2, "GetHeroKeyInfoList", function (
      heros,
      infoTable,
      ownHerolist,
      starVip,
      experienceDict,
    ) {
      // Daftarkan katalog hero ke dict (jalur data, bukan UI)
      try {
        const count = heros.method("get_Count").invoke();
        for (let i = 0; i < count; i++) {
          try {
            const el = heros.method("get_Item").invoke(i);
            if (el.isNull()) continue;
            grantHeroToDict(el.field("m_ID").value);
          } catch (e) {}
        }
      } catch (e) {
        debugLog("Skin", "grant hero bulk gagal: " + e.message);
      }

      const ret = this.method("GetHeroKeyInfoList").invoke(
        heros,
        infoTable,
        ownHerolist,
        starVip,
        experienceDict,
      );

      return ret;
    });
  } catch (e) {
    debugLog("Skin", "hook UIFuncs.GetHeroKeyInfoList gagal: " + e.message);
  }

  // ===== Grant hero ke m_heroInfos (jalur baca game yang sebenarnya) ===== //
  // Terbukti di device: AddOwnHero TIDAK menulis ke dict, set_Item ya.
  // Daftar ID berasal dari katalog yang dikirim game via GetHeroKeyInfoList
  // (dinamis, tanpa hardcode).
  const grantHeroToDict = function (heroid) {
    try {
      const dict = SystemData.field("m_heroInfos").value;
      if (!dict || dict.isNull()) return;

      let has = false;
      try {
        has = dict.method("ContainsKey").invoke(heroid);
      } catch (e) {}

      if (has || !HeroKeyInfoCls) return;

      const inst = HeroKeyInfoCls.alloc();
      try {
        inst.method(".ctor").invoke();
      } catch (e) {}
      try {
        inst.field("m_heroID").value = heroid;
      } catch (e) {}
      try {
        dict.method("set_Item").invoke(heroid, inst);
      } catch (e) {}
    } catch (e) {}
  };

  // --- MODIFIKASI SISTEM SKIN & STATUE (JAVASCRIPT MODE) ---
  const fakeSkin = (skinid) => {
    const instance = CmdHeroSkin.alloc();
    instance.method(".ctor").invoke();
    instance.field("iId").value = skinid;
    instance.field("iLimitTime").value = 0;
    instance.field("iSource").value = 0;
    return instance;
  };
  const fakeStatue = (statueid) => {
    const instance = CmdHeroStatue.alloc();
    instance.method(".ctor").invoke();
    instance.field("iId").value = statueid;
    instance.field("iLimitTime").value = 0;
    instance.field("iSource").value = 0;
    return instance;
  };

  hookMethod(SystemData, "GetHeroSkin", function (m_heroskins, skinid) {
    const ret = this.method("GetHeroSkin").invoke(m_heroskins, skinid);
    if (!ret.handle.isNull() && ret.handle.toInt32() > 0x100) return ret;
    return fakeSkin(skinid);
  });

  hookMethod(SystemData, "IsHaveSkin", function (skinid) {
    const ret = this.method("IsHaveSkin").invoke(skinid);
    if (!ret.handle.isNull() && ret.handle.toInt32() > 0x100) return ret;
    return fakeSkin(skinid);
  });

  hookMethod(SystemData, "IsHaveSkinForever", function (skinid) {
    const ret = this.method("IsHaveSkinForever").invoke(skinid);
    if (!ret.handle.isNull() && ret.handle.toInt32() > 0x100) return ret;
    return fakeSkin(skinid);
  });

  hookMethod(SystemData, "IsHaveStatue", function (statueid) {
    const ret = this.method("IsHaveStatue").invoke(statueid);
    if (!ret.handle.isNull() && ret.handle.toInt32() > 0x100) return ret;
    return fakeStatue(statueid);
  });

  hookMethod(SystemData, "IsHaveStatueForever", function (statueid) {
    const ret = this.method("IsHaveStatueForever").invoke(statueid);
    if (!ret.handle.isNull() && ret.handle.toInt32() > 0x100) return ret;
    return fakeStatue(statueid);
  });

  hookMethod(SystemData, "GetHeroHolyStatue", function (
    m_herostatues,
    statueid,
  ) {
    const ret = this.method("GetHeroHolyStatue").invoke(
      m_herostatues,
      statueid,
    );
    if (!ret.handle.isNull() && ret.handle.toInt32() > 0x100) return ret;
    return fakeStatue(statueid);
  });
  debugLog("Skin", "Skin & Statue hooks installed.");
}
