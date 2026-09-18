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
  const ChangeShow = Assembly.class("UIRankHero/ChangeShow"); // 1. Ambil referensi ke kelas dan metodenya

  const BActFreeSkin = ChooseHeroMgr.method("BActFreeSkin");
  const IsSkinUseable = ChooseHeroMgr.method("IsSkinUseable");
  const CanSelectSkin = UIChooseHero.method("CanSelectSkin");

  /*BActFreeSkin.implementation = function () {
    return true;
  };*/

  /*CanSelectSkin.implementation = function () {
    return true;
  };

  IsSkinUseable.implementation = function () {
    return true;
  };*/

  /* let m_SkinID = 0;
  let m_HeroID = 0;

 const sss = ChooseHeroMgr.method("SendSelectSkin");
  Interceptor.attach(sss.virtualAddress, {
    onEnter(args) {
      if (args && args[1] && args[2]) {
        const skinid = args[1].toInt32();
        const heroid = args[2].toInt32();
        if (skinid > 0) {
          m_SkinID = skinid;
          m_HeroID = heroid;
          console.log(`[Lobby] Memilih Skin: ${skinid}`);
        }
        args[1] = ptr(0);
      }
    },
  });

  const getUiID = () => {
    try {
      const val = SystemData.field("m_uiID").value;
      if (val !== null && val !== undefined) return val.toString();
    } catch (e) {
      try {
        const instances = Il2Cpp.gc.choose(SystemData);
        if (instances && instances.length > 0 && instances[0]) {
          const iVal = instances[0].field("m_uiID").value;
          if (iVal !== null && iVal !== undefined) return iVal.toString();
        }
      } catch (e2) {}
    }
    return "0";
  };
  */

  // ===== Dragon Crystal (pewarnaan skin) => dimiliki semua ===== //
  // Gate utama kepemilikan: selalu anggap crystal sudah di-unlock
  SystemData.method("IsUnlockDragonCrystal").implementation = function (
    crystalID,
    bCheckShareInfo,
  ) {
    return true;
  };

  // Validasi kombinasi skin + crystal selalu lolos agar semua warna bisa dipakai
  SystemData.method("IsRealHaveHero").implementation = function (heroid) {
    return true;
  };

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
      console.log("[!] class HeroKeyInfo tidak ditemukan: " + e2);
    }
  }

  const fakeHeroKeyInfo = function (heroid) {
    const inst = HeroKeyInfoCls.alloc();
    try {
      inst.method(".ctor").invoke();
    } catch (e) {}
    try {
      inst.field("m_heroID").value = heroid;
    } catch (e) {}
    return inst;
  };

  try {
    const uif2 = Assembly.class("UIFuncs");
    uif2.method("GetHeroKeyInfoList").implementation = function (
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
        console.log("[!] grant hero bulk gagal: " + e);
      }

      const ret = this.method("GetHeroKeyInfoList").invoke(
        heros,
        infoTable,
        ownHerolist,
        starVip,
        experienceDict,
      );

      // Setelah bulk hero terdaftar, pastikan semua skin katalog ikut
      // ter-grant (m_heroskins dibaca langsung oleh Collection/UI).
      // Dijadwalkan batch async agar tidak memblokir UI thread (anti-freeze).
      try {
        setTimeout(() => grantAllSkinsFromCatalog(true), 1000);
      } catch (e) {}

      return ret;
    };
  } catch (e) {
    console.log("[!] hook UIFuncs.GetHeroKeyInfoList gagal: " + e);
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
  /*

  UIChooseHero.method("BatttleSelectSkin").implementation = function (
    uid,
    skinid,
  ) {
    const myUiId = getUiID();
    if (uid.toString() === myUiId && m_SkinID > 0) {
      return this.method("BatttleSelectSkin").invoke(uid, m_SkinID);
    }
    return this.method("BatttleSelectSkin").invoke(uid, skinid);
  };

const setPlayerData = BattleReceiveMessage.method("SetPlayerData").overload("MTTDProto.BattlePlayerInfo", "System.UInt32");

Interceptor.attach(setPlayerData.virtualAddress, {
    onEnter(args) {
        if (!args || !args[1]) return;
        
        const playerInfoHandle = args[1];
        // Menggunakan compare ptr agar aman di arsitektur 32-bit maupun 64-bit
        if (playerInfoHandle.isNull() || playerInfoHandle.compare(ptr(0x1000)) < 0) return;

        try {
            const info = new Il2Cpp.Object(playerInfoHandle);
            const lUid = info.field("lUid").value.toString();
            const myUiId = getUiID(); // Pastikan fungsi getUiID() mengembalikan string

            // Pastikan m_SkinID ada dan valid
            if (typeof m_SkinID !== 'undefined' && m_SkinID !== 0 && lUid === myUiId.toString()) {
                
                // Gunakan casting atau penulisan langsung sesuai kebutuhan il2cpp-bridge
                info.field("uiSkinId").value = m_SkinID;
                
                try {
                    info.field("uiHeroSkinIDChoose").value = m_SkinID;
                } catch (e) {
                    // Field uiHeroSkinIDChoose mungkin tidak ada di struktur class
                }
                
                // Memperbaiki string literal menggunakan backtick
                console.log(`[BattleInject] Berhasil menyuntik Skin ${m_SkinID} ke UID ${lUid}`);
            }
        } catch (e) {
            // console.error(`[Error] Terjadi kesalahan saat membaca object: ${e}`);
        }
    }
});*/

  console.log(
    "[+] Skin & Statue System Hooked Successfully with 'Assembly' variable.",
  );
}
