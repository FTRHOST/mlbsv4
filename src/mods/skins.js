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

  // Izin dicek di DALAM tiap hook (bukan saat setup), karena verifikasi
  // auth operator bersifat async dan biasanya belum selesai saat setup.
  // Tanpa izin: teruskan ke fungsi asli (no-op, stealth untuk banned).
  const allowed = () =>
    sessionState.isAuthorized && sessionState.permissions.allowFreeSkin;

  // ===== Dragon Crystal (pewarnaan skin) => dimiliki semua ===== //
  hookMethod(SystemData, "IsUnlockDragonCrystal", function (
    crystalID,
    bCheckShareInfo,
  ) {
    if (!allowed()) {
      return this.method("IsUnlockDragonCrystal").invoke(
        crystalID,
        bCheckShareInfo,
      );
    }
    return true;
  });

  hookMethod(SystemData, "IsRealHaveHero", function (heroid) {
    if (!allowed()) {
      return this.method("IsRealHaveHero").invoke(heroid);
    }
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
      if (allowed()) {
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
        // Memasuki game (daftar hero lobby dibangun): tendang grant batch
        // katalog skin sekali per sesi, async agar tidak hitch.
        try {
          kickCatalogGrant();
        } catch (e) {}
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

  // ===== Grant skin ke HeroKeyInfo.m_heroskins (satu hero) ===== //
  // Menulis CmdHeroSkin{iId, iLimitTime:0, iSource:0} ke list milik hero.
  // Idempoten: skin yang sudah ada di-skip.
  const grantSkinToHero = function (heroid, skinid) {
    try {
      const dict = SystemData.field("m_heroInfos").value;
      if (!dict || dict.isNull()) return;

      let has = false;
      try {
        has = dict.method("ContainsKey").invoke(heroid);
      } catch (e) {}
      if (!has) grantHeroToDict(heroid);

      let info = null;
      try {
        info = dict.method("get_Item").invoke(heroid);
      } catch (e) {
        return;
      }
      if (!info || info.isNull()) return;

      let skins = null;
      try {
        skins = info.field("m_heroskins").value;
      } catch (e) {}
      if (!skins || skins.isNull()) {
        // Entri buatan .ctor kadang list-nya null — coba Init(), lalu
        // fallback buat List<CmdHeroSkin> generik via inflate.
        try {
          info.method("Init").invoke();
          skins = info.field("m_heroskins").value;
        } catch (e) {}
      }
      if (!skins || skins.isNull()) {
        try {
          const listGeneric = Il2Cpp.corlib.class(
            "System.Collections.Generic.List`1",
          );
          const skinListCls = listGeneric.inflate(CmdHeroSkin);
          skins = skinListCls.alloc();
          skins.method(".ctor").invoke();
          info.field("m_heroskins").value = skins;
        } catch (e) {
          return;
        }
      }
      if (!skins || skins.isNull()) return;

      try {
        const count = skins.method("get_Count").invoke();
        for (let i = 0; i < count; i++) {
          try {
            const el = skins.method("get_Item").invoke(i);
            if (!el || el.isNull()) continue;
            if (Number(el.field("iId").value) === Number(skinid)) return;
          } catch (e) {}
        }
      } catch (e) {}

      try {
        skins.method("Add").invoke(fakeSkin(skinid));
      } catch (e) {}
    } catch (e) {}
  };

  // ===== Katalog (hero, skin) dinamis dari tabel game ===== //
  // CData_HeroCostume mencakup semua skin termasuk yang tersembunyi
  // (m_IsHidden) — tanpa hardcode ID. Setelah dikunci, katalog di-freeze
  // agar batch tidak balapan dengan perubahan tabel.
  let catalogCache = null;
  let lockedCatalog = false;

  const getCatalogPairs = function () {
    if (lockedCatalog && catalogCache) return catalogCache;
    const pairs = [];
    try {
      const table = safeClass("CData_HeroCostume");
      if (!table) return pairs;
      const inst = table.method("GetInstance").invoke();
      if (!inst || inst.isNull()) return pairs;
      const list = inst.method("GetValues_TempletIDNotZero").invoke();
      if (!list || list.isNull()) return pairs;
      const count = list.method("get_Count").invoke();
      const seen = {};
      for (let i = 0; i < count; i++) {
        try {
          const el = list.method("get_Item").invoke(i);
          if (!el || el.isNull()) continue;
          const hid = Number(el.field("m_HeroId").value) | 0;
          const sid = Number(el.field("m_ID").value) | 0;
          if (!hid || !sid) continue;
          const key = hid + ":" + sid;
          if (seen[key]) continue;
          seen[key] = 1;
          pairs.push([hid, sid]);
        } catch (e) {}
      }
    } catch (e) {}
    return pairs;
  };

  // ===== Grant massal seluruh katalog (batched, anti-hitch) ===== //
  // batched=false: sekaligus (cepat tapi bisa hitch untuk n~1724).
  // batched=true: 20 entri per 500ms (~43 dtk untuk n=1724), single-flight
  // via grantTimer, sekali per sesi via grantBatchDone.
  let grantTimer = null;
  let grantBatchDone = false;

  const grantAllSkinsFromCatalog = function (batched) {
    try {
      const pairs = getCatalogPairs();
      if (!pairs.length) {
        debugLog("Skin", "katalog kosong (tabel belum siap), grant ditunda.");
        return;
      }
      // Kunci katalog untuk batch ini.
      lockedCatalog = true;
      catalogCache = pairs;
      if (!batched) {
        let granted = 0;
        for (const [hid, sid] of pairs) {
          try {
            grantHeroToDict(hid);
            grantSkinToHero(hid, sid);
            granted++;
          } catch (e) {}
        }
        grantBatchDone = true;
        debugLog(
          "Skin",
          "katalog unik=" +
            pairs.length +
            " granted=" +
            granted +
            (lockedCatalog ? " (TERKUNCI)" : ""),
        );
        return;
      }
      if (grantTimer) {
        debugLog("Skin", "grant batch sudah berjalan, skip");
        return;
      }
      if (grantBatchDone) return;
      let i = 0;
      let granted = 0;
      debugLog("Skin", "mulai grant batch n=" + pairs.length);
      const step = function () {
        try {
          const end = Math.min(i + 20, pairs.length);
          for (; i < end; i++) {
            try {
              const [hid, sid] = pairs[i];
              grantHeroToDict(hid);
              grantSkinToHero(hid, sid);
              granted++;
            } catch (e) {}
          }
          if (i < pairs.length) {
            grantTimer = setTimeout(step, 500);
          } else {
            grantTimer = null;
            grantBatchDone = true;
            debugLog(
              "Skin",
              "katalog unik=" +
                pairs.length +
                " granted=" +
                granted +
                (lockedCatalog ? " (TERKUNCI)" : "") +
                " (batch selesai)",
            );
          }
        } catch (e) {
          grantTimer = null;
          debugLog("Skin", "grant batch gagal: " + e);
        }
      };
      step();
    } catch (e) {
      debugLog("Skin", "grant all skins gagal: " + e);
    }
  };

  // Pemicu sekali saat memasuki game: hook UIFuncs.GetHeroKeyInfoList di
  // atas fired tiap daftar hero dibangun (lobby). Di sini hanya menendang
  // batch; bila katalog belum siap, dicoba lagi di entry berikutnya.
  const kickCatalogGrant = function () {
    try {
      if (!allowed() || grantTimer || grantBatchDone) return;
      grantAllSkinsFromCatalog(true);
      // Bila katalog masih kosong (grant ditunda), grantBatchDone tetap
      // false sehingga entry lobby berikutnya mencoba lagi.
    } catch (e) {}
  };
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
    if (!allowed()) return ret;
    return fakeSkin(skinid);
  });

  hookMethod(SystemData, "IsHaveSkin", function (skinid) {
    const ret = this.method("IsHaveSkin").invoke(skinid);
    if (!ret.handle.isNull() && ret.handle.toInt32() > 0x100) return ret;
    if (!allowed()) return ret;
    return fakeSkin(skinid);
  });

  hookMethod(SystemData, "IsHaveSkinForever", function (skinid) {
    const ret = this.method("IsHaveSkinForever").invoke(skinid);
    if (!ret.handle.isNull() && ret.handle.toInt32() > 0x100) return ret;
    if (!allowed()) return ret;
    return fakeSkin(skinid);
  });

  hookMethod(SystemData, "IsHaveStatue", function (statueid) {
    const ret = this.method("IsHaveStatue").invoke(statueid);
    if (!ret.handle.isNull() && ret.handle.toInt32() > 0x100) return ret;
    if (!allowed()) return ret;
    return fakeStatue(statueid);
  });

  hookMethod(SystemData, "IsHaveStatueForever", function (statueid) {
    const ret = this.method("IsHaveStatueForever").invoke(statueid);
    if (!ret.handle.isNull() && ret.handle.toInt32() > 0x100) return ret;
    if (!allowed()) return ret;
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
    if (!allowed()) return ret;
    return fakeStatue(statueid);
  });
  debugLog("Skin", "Skin & Statue hooks installed.");
}
