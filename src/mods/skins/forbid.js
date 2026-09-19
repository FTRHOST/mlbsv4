/**
 * Skin module — fake objects + read-path hooks + forbid bypasses.
 *
 * setupSkinForbids(ctx) mengisi ctx.fakeSkin / ctx.fakeStatue untuk dipakai
 * modul batch, lalu memasang hook baca + filter. Tanpa izin: teruskan ke
 * fungsi asli (no-op, stealth untuk banned).
 */

import { hookMethod } from "../../tools/hooking.js";

export function setupSkinForbids(ctx) {
  const { SystemData, CmdHeroSkin, CmdHeroStatue, allowed } = ctx;

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
  ctx.fakeSkin = fakeSkin;
  ctx.fakeStatue = fakeStatue;

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
}
