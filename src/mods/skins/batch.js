/**
 * Skin module — grant massal dua fase + pemicu (lobby & pasca-snapshot).
 *
 * Fase 1 — hero (sinkron, cepat): grant distinct hero ID ke dict sehingga
 * semua hero termasuk yang tersembunyi tampil. Live re-grant tiap panggilan:
 * entri yang di-wipe sync server otomatis ditambah lagi.
 * Fase 2 — skin (batched 20/500ms): unlock distinct skin ID ke hero-nya.
 * granted membuat semuanya idempoten: run parsial otomatis dilanjutkan
 * (delta) di entry berikutnya, tidak mengulang dari nol.
 */

import { debugLog } from "../../tools/utils";
import { hookMethod, safeClass } from "../../tools/hooking.js";
import { grantHeroToDict, dictHeroCount, probeHeroAccess } from "./hero.js";
import { catalogStore, getCatalogPairs } from "./catalog.js";

let grantTimer = null;
let lastKickTime = 0;
let lastSkipLog = 0;
let lastHeroIds = [];
let pendingRetry = null;
let retryCount = 0;

// ===== Grant skin ke HeroKeyInfo.m_heroskins (satu hero) ===== //
// Menulis CmdHeroSkin{iId, bSmartMagicUnlock:true} ke list milik hero.
// Idempoten: skin yang sudah ada di-skip TAPI flag unlock-nya dipastikan
// true (menyamai perilaku snippet terbukti).
export function grantSkinToHero(ctx, heroid, skinid) {
  try {
    const dict = ctx.SystemData.field("m_heroInfos").value;
    if (!dict || dict.isNull()) return;

    let has = false;
    try {
      has = dict.method("ContainsKey").invoke(heroid);
    } catch (e) {}
    if (!has) grantHeroToDict(ctx, heroid);

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
        const skinListCls = listGeneric.inflate(ctx.CmdHeroSkin);
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
      const inst = ctx.fakeSkin(skinid);
      try {
        inst.field("bSmartMagicUnlock").value = true;
      } catch (e) {}
      skins.method("Add").invoke(inst);
    } catch (e) {}
  } catch (e) {}
}

export function grantAllSkinsFromCatalog(ctx, batched, heroIds, forceVerify) {
  try {
    const pairs = getCatalogPairs(ctx.Assembly, heroIds);
    if (!pairs.length) {
      debugLog("Skin", "katalog kosong (tabel belum siap), grant ditunda.");
      return false;
    }
    // Kunci katalog untuk batch ini.
    catalogStore.locked = true;
    catalogStore.cache = pairs;

    // ---- Fase 1: hero tampil (live re-grant tiap panggilan) ----
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
          const dict = ctx.SystemData.field("m_heroInfos").value;
          if (dict && !dict.isNull()) {
            has = dict.method("ContainsKey").invoke(heroList[h]);
          }
        } catch (e) {}
        grantHeroToDict(ctx, heroList[h]);
        catalogStore.granted["hero:" + heroList[h]] = 1;
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
        dictHeroCount(ctx) +
        (catalogStore.locked ? " (TERKUNCI)" : ""),
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
      // forceVerify (mis. pasca-snapshot server): abaikan granted,
      // grantSkinToHero tetap dedupe live via isi m_heroskins.
      if (forceVerify || !catalogStore.granted[key]) todo.push(skinList[k]);
    }
    if (!todo.length) {
      debugLog("Skin", "skin sudah granted semua (" + skinList.length + ").");
      return true;
    }
    if (!batched) {
      let granted = 0;
      for (const [hid, sid] of todo) {
        try {
          grantHeroToDict(ctx, hid);
          grantSkinToHero(ctx, hid, sid);
          granted++;
          catalogStore.granted[hid + ":" + sid] = 1;
        } catch (e) {}
      }
      debugLog(
        "Skin",
        "katalog unik=" +
          skinList.length +
          " granted=" +
          granted +
          (catalogStore.locked ? " (TERKUNCI)" : ""),
      );
      try {
        probeHeroAccess(ctx, heroList);
      } catch (e) {}
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
            grantHeroToDict(ctx, hid);
            grantSkinToHero(ctx, hid, sid);
            granted++;
            catalogStore.granted[hid + ":" + sid] = 1;
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
              (catalogStore.locked ? " (TERKUNCI)" : "") +
              " (batch selesai)",
          );
          try {
            probeHeroAccess(ctx, heroList);
          } catch (e) {}
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
}

function scheduleRetry(ctx) {
  try {
    if (pendingRetry || retryCount >= 20) return;
    retryCount++;
    pendingRetry = setTimeout(() => {
      pendingRetry = null;
      kickCatalogGrant(ctx, lastHeroIds, true);
    }, 15000);
  } catch (e) {}
}

export function kickCatalogGrant(ctx, heroIds, isRetry, force) {
  try {
    if (heroIds && heroIds.length) lastHeroIds = heroIds;
    if (grantTimer) return;
    if (!ctx.allowed()) {
      const now = Date.now();
      if (now - lastSkipLog > 30000) {
        lastSkipLog = now;
        debugLog("Skin", "kick ditunda (auth belum siap), retry terjadwal.");
      }
      scheduleRetry(ctx);
      return;
    }
    const now = Date.now();
    if (!isRetry && now - lastKickTime < 10000) return;
    lastKickTime = now;
    const started = grantAllSkinsFromCatalog(ctx, true, lastHeroIds, !!force);
    // Katalog kosong (grant ditunda) -> coba lagi terjadwal; bila batch
    // sudah jalan/selesai, tidak ada retry lanjutan.
    if (!started) scheduleRetry(ctx);
  } catch (e) {}
}

// Pemicu: lobby (GetHeroKeyInfoList, universe hero) + pasca-snapshot server
// (on_Role_Init_SC, verifikasi penuh). Throttle + retry lihat kick di atas.
export function setupSkinTriggers(ctx) {
  // ===== Hero bulk-list (pengisi ownHerolist Lua) ===== //
  // GetHeroKeyInfoList mengisi LuaTable ownHerolist dari m_heroInfos.
  // Hook satuan tidak memengaruhi pengisian bulk ini, jadi pastikan tiap
  // hero di katalog param terdaftar di dict, baru original.
  try {
    const uif2 = safeClass(ctx.Assembly, "UIFuncs");
    if (!uif2) throw new Error("UIFuncs missing");
    hookMethod(
      uif2,
      "GetHeroKeyInfoList",
      function (heros, infoTable, ownHerolist, starVip, experienceDict) {
        // Daftarkan katalog hero ke dict (jalur data, bukan UI)
        if (ctx.allowed()) {
          let hidList = [];
          try {
            const count = heros.method("get_Count").invoke();
            debugLog("Skin", "GetHeroKeyInfoList fired heros=" + count);
            for (let i = 0; i < count; i++) {
              try {
                const el = heros.method("get_Item").invoke(i);
                if (el.isNull()) continue;
                const hid = el.field("m_ID").value;
                grantHeroToDict(ctx, hid);
                hidList.push(hid);
              } catch (e) {}
            }
          } catch (e) {
            debugLog("Skin", "grant hero bulk gagal: " + e.message);
          }
          // Memasuki game (daftar hero lobby dibangun): tendang grant batch
          // katalog skin, async agar tidak hitch. Universe hero diteruskan
          // agar enumerasi per-hero lengkap.
          try {
            kickCatalogGrant(ctx, hidList);
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
      },
    );
  } catch (e) {
    debugLog("Skin", "hook UIFuncs.GetHeroKeyInfoList gagal: " + e.message);
  }

  // ===== Pemicu pasca-snapshot server (anti-race sync) ===== //
  // GameReceiveMessage.on_Role_Init_SC fired saat snapshot init server
  // diterapkan — momen ketika grant yang terlalu dini berisiko tertimpa.
  // Setelah original return, jadwalkan verifikasi penuh (+3 dtk, menunggu
  // Framing2/3 selesai). Throttle via grantTimer + kick 10 dtk.
  try {
    const GRM = safeClass(ctx.Assembly, "GameReceiveMessage");
    if (!GRM) throw new Error("GameReceiveMessage missing");
    const okInit = hookMethod(GRM, "on_Role_Init_SC", function (retMsg) {
      const r = this.method("on_Role_Init_SC").invoke(retMsg);
      try {
        debugLog("Skin", "on_Role_Init_SC selesai -> grant terjadwal.");
        setTimeout(() => {
          try {
            kickCatalogGrant(ctx, lastHeroIds, true, true);
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
}
