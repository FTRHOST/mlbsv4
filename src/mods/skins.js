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
  const ChangeShow = Assembly.class("UIRankHero/ChangeShow");

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

  SystemData.method("IsCanUseSkin").implementation = function () {
    return true;
  };

  UIRankHero.method("BRankHeroCanUse").implementation = function () {
    return true;
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

  console.log(
    "[+] Skin & Statue System Hooked Successfully with 'Assembly' variable.",
  );
}
