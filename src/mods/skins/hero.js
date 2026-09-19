/**
 * Skin module — hero dict grants + access probe.
 *
 * ctx: { Assembly, SystemData, allowed }
 * Dipanggil dengan ctx yang sama oleh orkestrator skins.js.
 */

import { debugLog } from "../../tools/utils";

let HeroKeyInfoCls = null;

export function setupHeroModule(ctx) {
  try {
    HeroKeyInfoCls = ctx.Assembly.class("SystemData/HeroKeyInfo");
  } catch (e) {
    try {
      HeroKeyInfoCls = ctx.Assembly.class("HeroKeyInfo");
    } catch (e2) {
      debugLog("Skin", "class HeroKeyInfo tidak ditemukan.");
    }
  }
}

// ===== Grant hero ke m_heroInfos (jalur baca game yang sebenarnya) ===== //
// Terbukti di device: AddOwnHero TIDAK menulis ke dict, set_Item ya.
// Daftar ID berasal dari katalog yang dikirim game via GetHeroKeyInfoList
// (dinamis, tanpa hardcode). Init() dipanggil agar field turunan
// (m_curSkinId/default/list) terisi default game, bukan nol mentah —
// entri setengah-jadi diduga alasan hero tersembunyi tak tampil walau
// sudah di dict. m_heroID di-set ulang setelah Init (Init bisa me-reset).
export function grantHeroToDict(ctx, heroid) {
  try {
    const dict = ctx.SystemData.field("m_heroInfos").value;
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
}

// Ukuran dict live (diagnostik admin: bandingkan dengan hero unik katalog).
export function dictHeroCount(ctx) {
  try {
    const dict = ctx.SystemData.field("m_heroInfos").value;
    if (!dict || dict.isNull()) return -1;
    return dict.method("get_Count").invoke();
  } catch (e) {
    return -1;
  }
}

// ===== Probe akses hero (diagnostik admin, sekali per sesi) ===== //
// Dict penuh belum tentu terlihat: cek tiga lapis yang bisa memfilter:
//  1. SystemData.GetHeroKeyInfo(hid) null? (filter level accessor)
//  2. m_bLimitHero=true pada entri? (Init() bisa menandainya limited!)
//  3. IsForbidHeros(hid) masih true? (bypass onLeave tidak efektif?)
// Hasilnya menentukan fix berikutnya: hook GetHeroKeyInfo fake-object,
// paksa m_bLimitHero=false, atau perbaiki bypass forbid.
let probeDone = false;
export function probeHeroAccess(ctx, heroList) {
  if (probeDone) return;
  probeDone = true;
  try {
    if (!heroList || !heroList.length) return;
    let checked = 0;
    let nullCount = 0;
    let limitTrue = 0;
    let sampleInfo = "";
    const step = Math.max(1, Math.floor(heroList.length / 40));
    for (let k = 0; k < heroList.length; k += step) {
      const hid = heroList[k];
      checked++;
      try {
        const e = ctx.SystemData.method("GetHeroKeyInfo").invoke(hid);
        if (!e || e.isNull()) {
          nullCount++;
          continue;
        }
        try {
          if (e.field("m_bLimitHero").value) limitTrue++;
        } catch (e2) {}
        if (!sampleInfo) {
          try {
            const lst = e.field("m_heroskins").value;
            const sc =
              lst && !lst.isNull() ? lst.method("get_Count").invoke() : -1;
            sampleInfo =
              " sample hid=" +
              hid +
              " cur=" +
              e.field("m_curSkinId").value +
              " lim=" +
              e.field("m_bLimitHero").value +
              " skins=" +
              sc;
          } catch (e2) {}
        }
      } catch (e) {
        nullCount++;
      }
    }
    debugLog(
      "Skin",
      "probe GetHeroKeyInfo checked=" +
        checked +
        " null=" +
        nullCount +
        " limit=" +
        limitTrue +
        sampleInfo,
    );
    try {
      const f1 = ctx.SystemData.method("IsForbidHeros").invoke(heroList[0]);
      debugLog("Skin", "probe IsForbidHeros(" + heroList[0] + ")=" + f1);
    } catch (e) {
      debugLog("Skin", "probe IsForbidHeros err=" + e.message);
    }
  } catch (e) {}
}
