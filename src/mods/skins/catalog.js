/**
 * Skin module — katalog (hero, skin) dinamis dari tabel game.
 *
 * Sumber utama: CData_HeroCostume.GetValues_ByHeroId per hero — daftar
 * LENGKAP tanpa filter (termasuk m_IsHidden). GetValues_TempletIDNotZero
 * hanya fallback: terbukti memangkas tabel penuh (kasus n=205 vs 1724).
 * Universe hero = katalog yang dikirim game via GetHeroKeyInfoList.
 * granted membuat batch idempoten per pasangan: bila run pertama
 * hanya dapat sebagian (tabel lazy-load), entry berikutnya otomatis
 * melanjutkan sisanya (delta), bukan mengulang dari nol.
 */

import { safeClass } from "../../tools/hooking.js";

export const catalogStore = {
  cache: null,
  buildTime: 0,
  locked: false,
  granted: {},
};

function readCostumeRows(list, seen, pairs) {
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
}

export function getCatalogPairs(Assembly, heroIds) {
  const now = Date.now();
  if (
    catalogStore.locked &&
    catalogStore.cache &&
    now - catalogStore.buildTime < 60000
  ) {
    return catalogStore.cache;
  }
  const pairs = [];
  try {
    const table = safeClass(Assembly, "CData_HeroCostume");
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
          const elemCls = safeClass(Assembly, "CData_HeroCostume_Element");
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
    catalogStore.cache = pairs;
    catalogStore.buildTime = now;
  }
  return pairs;
}
