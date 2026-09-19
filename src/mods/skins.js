/**
 * Free Skin Hook Module (orkestrator).
 *
 * Logika dipecah per concern di src/mods/skins/:
 *  - hero.js: grant hero ke dict + probe akses
 *  - catalog.js: katalog (hero, skin) dinamis + cache/kunci
 *  - forbid.js: fake objects + hook baca + bypass filter
 *  - batch.js: grant massal dua fase + pemicu lobby & pasca-snapshot
 */

import { sessionState } from "../tools/config";
import { debugLog } from "../tools/utils";
import { safeClass } from "../tools/hooking.js";
import { setupHeroModule } from "./skins/hero.js";
import { setupSkinForbids } from "./skins/forbid.js";
import { setupSkinTriggers } from "./skins/batch.js";

export function setupSkinHooks(Assembly) {
  const SystemData = safeClass(Assembly, "SystemData");
  const CmdHeroSkin = safeClass(Assembly, "MTTDProto.CmdHeroSkin");
  const CmdHeroStatue = safeClass(Assembly, "MTTDProto.CmdHeroStatue");
  if (!SystemData || !CmdHeroSkin || !CmdHeroStatue) return;

  // Izin dicek di DALAM tiap hook (bukan saat setup), karena verifikasi
  // auth operator bersifat async dan biasanya belum selesai saat setup.
  // Tanpa izin: teruskan ke fungsi asli (no-op, stealth untuk banned).
  const allowed = () =>
    sessionState.isAuthorized && sessionState.permissions.allowFreeSkin;

  const ctx = {
    Assembly,
    SystemData,
    CmdHeroSkin,
    CmdHeroStatue,
    allowed,
    HeroKeyInfoCls: null,
    fakeSkin: null,
    fakeStatue: null,
  };

  setupHeroModule(ctx);
  setupSkinForbids(ctx);
  setupSkinTriggers(ctx);
  debugLog("Skin", "Skin & Statue hooks installed.");
}
