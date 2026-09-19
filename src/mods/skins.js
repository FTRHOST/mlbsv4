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

  // ===== Filter forbid skin => tidak pernah di-forbid ===== //
  // Pola dari snippet terbukti (bool-safe): filter Lua/UI yang menyembunyikan
  // skin selalu lolos agar skin grant terlihat.
  hookMethod(SystemData, "IsForbidSkin", function (skinid, filterLuaCheck) {
    if (!allowed()) {
      return this.method("IsForbidSkin").invoke(skinid, filterLuaCheck);
    }
    return false;
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
          debugLog("Skin", "GetHeroKeyInfoList fired heros=" + count);
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
  // (dinamis, tanpa hardcode). Init() dipanggil agar field turunan
  // (m_curSkinId/default/list) terisi default game, bukan nol mentah —
  // entri setengah-jadi diduga alasan hero tersembunyi tak tampil walau
  // sudah di dict. m_heroID di-set ulang setelah Init (Init bisa me-reset).
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
        inst.method("Init").invoke();
      } catch (e) {}
      try {
        inst.field("m_heroID").value = heroid;
      } catch (e) {}
      try {
        dict.method("set_Item").invoke(heroid, inst);
      } catch (e) {}
    } catch (e) {}
  };

  // Ukuran dict live (diagnostik admin: bandingkan dengan hero unik katalog).
  const dictHeroCount = function () {
    try {
      const dict = SystemData.field("m_heroInfos").value;
      if (!dict || dict.isNull()) return -1;
      return dict.method("get_Count").invoke();
    } catch (e) {
      return -1;
    }
  };

  // ===== Grant skin ke HeroKeyInfo.m_heroskins (satu hero) ===== //
  // Menulis CmdHeroSkin{iId, bSmartMagicUnlock:true} ke list milik hero.
  // Idempoten: skin yang sudah ada di-skip TAPI flag unlock-nya dipastikan
  // true (menyamai perilaku snippet terbukti).
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
            if (Number(el.field("iId").value) === Number(skinid)) {
              try {
                el.field("bSmartMagicUnlock").value = true;
              } catch (e) {}
              return;
            }
          } catch (e) {}
        }
      } catch (e) {}

      try {
        const inst = fakeSkin(skinid);
        try {
          inst.field("bSmartMagicUnlock").value = true;
        } catch (e) {}
        skins.method("Add").invoke(inst);
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
          // Union dengan heap-scan gc.choose (konsep snippet yang terbukti):
          // tabel query hanya mengembalikan baris kanonis (1478), sedangkan
          // heap memuat instance live tambahan (duplikat/varian/unreleased)
          // yang menggenapkan ke 1724. Dedupe via seen agar tetap unik.
          try {
            const elemCls = safeClass("CData_HeroCostume_Element");
            if (elemCls) {
              const objs = Il2Cpp.gc.choose(elemCls);
              for (let k = 0; k < objs.length; k++) {
                try {
                  const o = objs[k];
                  if (!o || o.isNull()) continue;
                  const hid = Number(o.field("m_HeroId").value) | 0;
                  const sid = Number(o.field("m_ID").value) | 0;
                  if (!hid || !sid) continue;
                  const key = hid + ":" + sid;
                  if (seen[key]) continue;
                  seen[key] = 1;
                  pairs.push([hid, sid]);
                } catch (e) {}
              }
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
    if (pairs.length) {
      catalogCache = pairs;
      catalogBuildTime = now;
    }
    return pairs;
  };

  // ===== Grant massal dua fase (hero tampil + skin unlock, anti-hitch) ===== //
  // Fase 1 — hero (sinkron, cepat): grant distinct hero ID ke dict sehingga
  // semua hero termasuk yang tersembunyi tampil (sumber: katalog 1724).
  // Fase 2 — skin (batched 20/500ms): unlock distinct skin ID ke hero-nya
  // (sumber: katalog skin unik, mis. 1478).
  // grantedKeys membuat semuanya idempoten: run parsial otomatis
  // dilanjutkan (delta) di entry berikutnya, tidak mengulang dari nol.
  let grantTimer = null;

  const grantAllSkinsFromCatalog = function (batched, heroIds, forceVerify) {
    try {
      const pairs = getCatalogPairs(heroIds);
      if (!pairs.length) {
        debugLog("Skin", "katalog kosong (tabel belum siap), grant ditunda.");
        return false;
      }
      // Kunci katalog untuk batch ini.
      lockedCatalog = true;
      catalogCache = pairs;

      // ---- Fase 1: hero tampil (live re-grant tiap panggilan) ----
      // grantHeroToDict mengecek ContainsKey live: entri yang di-wipe sync
      // server otomatis ditambah lagi di sini. grantedKeys hanya telemetri,
      // bukan gate — re-grant 156 ContainsKey murah, ketinggalan lebih mahal.
      const seenH = {};
      const heroList = [];
      for (let k = 0; k < pairs.length; k++) {
        const hid = pairs[k][0];
        if (!seenH[hid]) {
          seenH[hid] = 1;
          heroList.push(hid);
        }
      }
      let heroesGranted = 0;
      for (let h = 0; h < heroList.length; h++) {
        try {
          let has = false;
          try {
            const dict = SystemData.field("m_heroInfos").value;
            if (dict && !dict.isNull()) {
              has = dict.method("ContainsKey").invoke(heroList[h]);
            }
          } catch (e) {}
          grantHeroToDict(heroList[h]);
          grantedKeys["hero:" + heroList[h]] = 1;
          if (!has) heroesGranted++;
        } catch (e) {}
      }
      debugLog(
        "Skin",
        "hero unik=" +
          heroList.length +
          " granted=" +
          heroesGranted +
          " dict=" +
          dictHeroCount() +
          (lockedCatalog ? " (TERKUNCI)" : ""),
      );

      // ---- Fase 2: skin unlock (distinct sid) ----
      const seenS = {};
      const skinList = [];
      for (let k = 0; k < pairs.length; k++) {
        const sid = pairs[k][1];
        if (!seenS[sid]) {
          seenS[sid] = 1;
          skinList.push(pairs[k]);
        }
      }
      const todo = [];
      for (let k = 0; k < skinList.length; k++) {
        const key = skinList[k][0] + ":" + skinList[k][1];
        // forceVerify (mis. pasca-snapshot server): abaikan grantedKeys,
        // grantSkinToHero tetap dedupe live via isi m_heroskins.
        if (forceVerify || !grantedKeys[key]) todo.push(skinList[k]);
      }
      if (!todo.length) {
        debugLog(
          "Skin",
          "skin sudah granted semua (" + skinList.length + ").",
        );
        return true;
      }
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
            skinList.length +
            " granted=" +
            granted +
            (lockedCatalog ? " (TERKUNCI)" : ""),
        );
        return true;
      }
      if (grantTimer) {
        debugLog("Skin", "grant batch sudah berjalan, skip");
        return true;
      }
      let i = 0;
      let granted = 0;
      debugLog(
        "Skin",
        "mulai grant batch n=" +
          todo.length +
          " (skin unik " +
          skinList.length +
          " dari katalog " +
          pairs.length +
          ")",
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
                skinList.length +
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
      return true;
    } catch (e) {
      debugLog("Skin", "grant all skins gagal: " + e);
      return false;
    }
  };

  // Pemicu saat memasuki game: hook UIFuncs.GetHeroKeyInfoList di atas
  // fired tiap daftar hero dibangun (lobby). Universe hero dari daftar
  // tersebut diteruskan agar katalog per-hero lengkap. Throttle 10 dtk agar
  // rebuild tabel tidak terlalu sering.
  //
  // Berbeda dengan skrip live-inject (perform langsung jalan karena runtime
  // sudah siap), di sini ada rantai gate: lobby event -> allowed() (auth
  // async) -> throttle -> batch. Event lobby bisa fired SEKALI saat auth
  // belum siap, atau tabel belum termuat — maka kick yang tertunda TIDAK
  // hilang diam-diam: dijadwalkan ulang tiap 15 dtk (maks 20x) sampai batch
  // benar-benar jalan, plus log alasan skip (throttled) agar terbaca logcat.
  let lastKickTime = 0;
  let lastSkipLog = 0;
  let lastHeroIds = [];
  let pendingRetry = null;
  let retryCount = 0;
  const scheduleRetry = function () {
    try {
      if (pendingRetry || retryCount >= 20) return;
      retryCount++;
      pendingRetry = setTimeout(() => {
        pendingRetry = null;
        kickCatalogGrant(lastHeroIds, true);
      }, 15000);
    } catch (e) {}
  };
  const kickCatalogGrant = function (heroIds, isRetry, force) {
    try {
      if (heroIds && heroIds.length) lastHeroIds = heroIds;
      if (grantTimer) return;
      if (!allowed()) {
        const now = Date.now();
        if (now - lastSkipLog > 30000) {
          lastSkipLog = now;
          debugLog("Skin", "kick ditunda (auth belum siap), retry terjadwal.");
        }
        scheduleRetry();
        return;
      }
      const now = Date.now();
      if (!isRetry && now - lastKickTime < 10000) return;
      lastKickTime = now;
      const started = grantAllSkinsFromCatalog(true, lastHeroIds, !!force);
      // Katalog kosong (grant ditunda) -> coba lagi terjadwal; bila batch
      // sudah jalan/selesai, tidak ada retry lanjutan.
      if (!started) scheduleRetry();
    } catch (e) {}
  };

  // ===== Pemicu pasca-snapshot server (anti-race sync) ===== //
  // GameReceiveMessage.on_Role_Init_SC fired saat snapshot init server
  // diterapkan — momen ketika grant yang terlalu dini berisiko tertimpa.
  // Setelah original return, jadwalkan verifikasi penuh (+3 dtk, menunggu
  // Framing2/3 selesai). Throttle via grantTimer + kick 10 dtk.
  try {
    const GRM = safeClass("GameReceiveMessage");
    if (!GRM) throw new Error("GameReceiveMessage missing");
    const okInit = hookMethod(GRM, "on_Role_Init_SC", function (retMsg) {
      const r = this.method("on_Role_Init_SC").invoke(retMsg);
      try {
        debugLog("Skin", "on_Role_Init_SC selesai -> grant terjadwal.");
        setTimeout(() => {
          try {
            kickCatalogGrant(lastHeroIds, true, true);
          } catch (e) {}
        }, 3000);
      } catch (e) {}
      return r;
    });
    debugLog(
      "Skin",
      okInit ? "hook on_Role_Init_SC ok" : "hook on_Role_Init_SC gagal",
    );
  } catch (e) {
    debugLog("Skin", "hook on_Role_Init_SC gagal: " + e.message);
  }
  const fakeSkin = (skinid) => {
    const instance = CmdHeroSkin.alloc();
    instance.method(".ctor").invoke();
    instance.field("iId").value = skinid;
    instance.field("iLimitTime").value = 0;
    instance.field("iSource").value = 0;
    try {
      instance.field("bSmartMagicUnlock").value = true;
    } catch (e) {}
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
