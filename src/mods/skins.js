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
        let hidList = [];
        try {
          const count = heros.method("get_Count").invoke();
          for (let i = 0; i < count; i++) {
            try {
              const el = heros.method("get_Item").invoke(i);
              if (el.isNull()) continue;
              const hid = el.field("m_ID").value;
              grantHeroToDict(hid);
              hidList.push(hid);
            } catch (e) {}
          }
        } catch (e) {
          debugLog("Skin", "grant hero bulk gagal: " + e.message);
        }
        // Memasuki game (daftar hero lobby dibangun): tendang grant batch
        // katalog skin, async agar tidak hitch. Universe hero diteruskan
        // agar enumerasi per-hero lengkap (n=1724, bukan n=205).
        try {
          kickCatalogGrant(hidList);
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
  // Sumber utama: CData_HeroCostume.GetValues_ByHeroId per hero — daftar
  // LENGKAP tanpa filter (termasuk m_IsHidden). GetValues_TempletIDNotZero
  // hanya fallback: terbukti memangkas tabel penuh (kasus n=205 vs 1724).
  // Universe hero = katalog yang dikirim game via GetHeroKeyInfoList.
  // grantedKeys membuat batch idempoten per pasangan: bila run pertama
  // hanya dapat sebagian (tabel lazy-load), entry berikutnya otomatis
  // melanjutkan sisanya (delta), bukan mengulang dari nol.
  let catalogCache = null;
  let catalogBuildTime = 0;
  let lockedCatalog = false;
  const grantedKeys = {};

  const readCostumeRows = function (list, seen, pairs) {
    try {
      const count = list.method("get_Count").invoke();
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
  };

  const getCatalogPairs = function (heroIds) {
    const now = Date.now();
    if (lockedCatalog && catalogCache && now - catalogBuildTime < 60000) {
      return catalogCache;
    }
    const pairs = [];
    try {
      const table = safeClass("CData_HeroCostume");
      if (table) {
        const inst = table.method("GetInstance").invoke();
        if (inst && !inst.isNull()) {
          const seen = {};
          if (heroIds && heroIds.length) {
            for (let h = 0; h < heroIds.length; h++) {
              let list = null;
              try {
                list = inst
                  .method("GetValues_ByHeroId")
                  .invoke(Number(heroIds[h]) | 0);
              } catch (e) {
                list = null;
              }
              if (!list || list.isNull()) continue;
              readCostumeRows(list, seen, pairs);
            }
          }
          if (!pairs.length) {
            try {
              const list = inst.method("GetValues_TempletIDNotZero").invoke();
              if (list && !list.isNull()) readCostumeRows(list, seen, pairs);
            } catch (e) {}
          }
        }
      }
    } catch (e) {}
    if (pairs.length) {
      catalogCache = pairs;
      catalogBuildTime = now;
    }
    return pairs;
  };

  // ===== Grant massal seluruh katalog (batched, anti-hitch) ===== //
  // batched=false: sekaligus (cepat tapi bisa hitch untuk n~1724).
  // batched=true: 20 entri per 500ms (~43 dtk untuk n=1724), single-flight
  // via grantTimer. Hanya pasangan yang belum granted yang dikerjakan,
  // sehingga run parsial (mis. n=205 saat tabel belum penuh) otomatis
  // dilanjutkan di entry berikutnya sampai katalog penuh (n=1724).
  let grantTimer = null;

  const grantAllSkinsFromCatalog = function (batched, heroIds) {
    try {
      const pairs = getCatalogPairs(heroIds);
      if (!pairs.length) {
        debugLog("Skin", "katalog kosong (tabel belum siap), grant ditunda.");
        return;
      }
      const todo = [];
      for (let k = 0; k < pairs.length; k++) {
        const key = pairs[k][0] + ":" + pairs[k][1];
        if (!grantedKeys[key]) todo.push(pairs[k]);
      }
      if (!todo.length) {
        debugLog(
          "Skin",
          "katalog sudah granted semua (" + pairs.length + ").",
        );
        return;
      }
      // Kunci katalog untuk batch ini.
      lockedCatalog = true;
      catalogCache = pairs;
      if (!batched) {
        let granted = 0;
        for (const [hid, sid] of todo) {
          try {
            grantHeroToDict(hid);
            grantSkinToHero(hid, sid);
            granted++;
            grantedKeys[hid + ":" + sid] = 1;
          } catch (e) {}
        }
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
      let i = 0;
      let granted = 0;
      debugLog(
        "Skin",
        "mulai grant batch n=" + todo.length + " (katalog " + pairs.length + ")",
      );
      const step = function () {
        try {
          const end = Math.min(i + 20, todo.length);
          for (; i < end; i++) {
            try {
              const [hid, sid] = todo[i];
              grantHeroToDict(hid);
              grantSkinToHero(hid, sid);
              granted++;
              grantedKeys[hid + ":" + sid] = 1;
            } catch (e) {}
          }
          if (i < todo.length) {
            grantTimer = setTimeout(step, 500);
          } else {
            grantTimer = null;
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

  // Pemicu saat memasuki game: hook UIFuncs.GetHeroKeyInfoList di atas
  // fired tiap daftar hero dibangun (lobby). Universe hero dari daftar
  // tersebut diteruskan agar katalog per-hero lengkap. Throttle 10 dtk agar
  // rebuild tabel tidak terlalu sering; bila katalog masih kosong/tumbuh,
  // entry berikutnya otomatis mencoba/melanjutkan.
  let lastKickTime = 0;
  const kickCatalogGrant = function (heroIds) {
    try {
      if (!allowed() || grantTimer) return;
      const now = Date.now();
      if (now - lastKickTime < 10000) return;
      lastKickTime = now;
      grantAllSkinsFromCatalog(true, heroIds);
      // Bila katalog masih kosong (grant ditunda) atau baru ter-grant
      // sebagian, entry lobby berikutnya otomatis mencoba/melanjutkan.
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
  // ===== Top-up NewbieOffLineMgr.GetFakeHeroList (jalur offline/newbie) ===== //
  // Setiap ack diperkaya: hero yang belum ada ditambah (CmdHeroData) dan
  // semua skin katalog ditambah ke vSkinList (bSmartMagicUnlock=true).
  // Dedupe ganda: heroSeen untuk vHeroList, skinSeen untuk vSkinList —
  // tanpa ini ack yang dipakai ulang akan membengkak tiap panggilan.
  // Tanpa izin: teruskan asli (no-op, stealth untuk banned).
  try {
    const NOM = safeClass("NewbieOffLineMgr");
    const HeroDataCls = safeClass("MTTDProto.CmdHeroData");
    if (!NOM || !HeroDataCls) throw new Error("NewbieOffLineMgr missing");
    const ok = hookMethod(NOM, "GetFakeHeroList", function (...args) {
      const ack = this.method("GetFakeHeroList").invoke(...args);
      if (!allowed()) return ack;
      try {
        if (ack && !ack.isNull()) {
          let vHero = null;
          let vSkin = null;
          try {
            vHero = ack.field("vHeroList").value;
          } catch (e) {}
          try {
            vSkin = ack.field("vSkinList").value;
          } catch (e) {}

          const heroSeen = {};
          const ackHeroIds = [];
          if (vHero && !vHero.isNull()) {
            try {
              const hc = vHero.method("get_Count").invoke();
              for (let i = 0; i < hc; i++) {
                try {
                  const hid =
                    Number(
                      vHero.method("get_Item").invoke(i).field("iHeroId").value,
                    ) | 0;
                  if (hid) {
                    heroSeen[hid] = 1;
                    ackHeroIds.push(hid);
                  }
                } catch (e) {}
              }
            } catch (e) {}
          }
          const skinSeen = {};
          if (vSkin && !vSkin.isNull()) {
            try {
              const sc = vSkin.method("get_Count").invoke();
              for (let i = 0; i < sc; i++) {
                try {
                  const sid =
                    Number(
                      vSkin.method("get_Item").invoke(i).field("iId").value,
                    ) | 0;
                  if (sid) skinSeen[sid] = 1;
                } catch (e) {}
              }
            } catch (e) {}
          }

          // Katalog terkunci (penuh dari lobby) diutamakan; bila belum ada,
          // bangun dari universe hero ack ini; fallback terakhir 205.
          const pairs =
            lockedCatalog && catalogCache && catalogCache.length
              ? catalogCache
              : getCatalogPairs(ackHeroIds);

          for (const [hid, sid] of pairs) {
            try {
              if (vHero && !vHero.isNull() && !heroSeen[hid]) {
                heroSeen[hid] = 1;
                const hd = HeroDataCls.alloc();
                hd.method(".ctor").invoke();
                hd.field("iHeroId").value = hid;
                vHero.method("Add").invoke(hd);
              }
              if (vSkin && !vSkin.isNull() && !skinSeen[sid]) {
                skinSeen[sid] = 1;
                const sk = fakeSkin(sid);
                try {
                  sk.field("bSmartMagicUnlock").value = true;
                } catch (e) {}
                vSkin.method("Add").invoke(sk);
              }
            } catch (e) {}
          }
          debugLog(
            "PSRV",
            "GetFakeHeroList top-up skins=" +
              pairs.length +
              (lockedCatalog ? " (TERKUNCI)" : ""),
          );
        }
      } catch (e) {
        debugLog("PSRV", "top-up fakeherolist gagal: " + e.message);
      }
      return ack;
    });
    debugLog(
      "PSRV",
      ok ? "hook GetFakeHeroList ok" : "hook GetFakeHeroList gagal",
    );
  } catch (e) {
    debugLog("PSRV", "hook GetFakeHeroList gagal: " + e.message);
  }

  debugLog("Skin", "Skin & Statue hooks installed.");
}
