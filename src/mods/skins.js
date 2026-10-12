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
  /*
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

  // src/ToolLeak/unlock-skin/ownership-gates.ts
  function hookBool0(ctx, cls, methodName, tag) {
    try {
      const m = cls.tryMethod(methodName);
      if (!m) {
        ctx.opts.log(`[-] [${tag}] ${methodName} tidak ditemukan.`);
        return;
      }
      try {
        void m.nativeFunction;
      } catch {}
      m.implementation = function (..._args) {
        return true;
      };
      ctx.opts.log(`[+] [${tag}] ${methodName} -> true`);
    } catch (e) {
      ctx.opts.log(`[!] [${tag}] hook ${methodName} gagal: ` + e);
    }
  }
  function hookBoolFalse(ctx, cls, methodName, tag) {
    try {
      const m = cls.tryMethod(methodName);
      if (!m) {
        ctx.opts.log(`[-] [${tag}] ${methodName} tidak ditemukan.`);
        return;
      }
      try {
        void m.nativeFunction;
      } catch {}
      m.implementation = function (..._args) {
        return false;
      };
      ctx.opts.log(`[+] [${tag}] ${methodName} -> false`);
    } catch (e) {
      ctx.opts.log(`[!] [${tag}] hook ${methodName} gagal: ` + e);
    }
  }
  function hookOwnershipGates(ctx) {
    const SystemData = ctx.SystemData;
    const ensureUnlocked = function (skinId) {
      try {
        if (ctx.unlockedSkins.has(skinId)) {
          const hid = ctx.skinToHero.get(skinId);
          if (hid !== void 0) {
            try {
              grantHero(ctx, hid);
            } catch {}
            try {
              grantSkin(ctx, hid, skinId);
            } catch {}
          }
          return true;
        }
      } catch {}
      return false;
    };
    try {
      const ish = SystemData.tryMethod("IsHaveSkin");
      if (!ish) {
        ctx.opts.log(
          "[-] [UNLOCK-GATE] SystemData.IsHaveSkin tidak ditemukan.",
        );
      } else {
        try {
          void ish.nativeFunction;
        } catch {}
        ish.implementation = function (skinid) {
          const ret = this.method("IsHaveSkin").invoke(skinid);
          try {
            const o = ret;
            if (o && !o.isNull()) return ret;
          } catch {}
          try {
            const sid = Number(skinid);
            if (ensureUnlocked(sid)) {
              const ret2 = this.method("IsHaveSkin").invoke(skinid);
              try {
                const o2 = ret2;
                if (o2 && !o2.isNull()) {
                  ctx.opts.log(`[UNLOCK-GATE] IsHaveSkin(${sid}) -> granted`);
                  return ret2;
                }
              } catch {}
            }
          } catch {}
          return ret;
        };
        ctx.opts.log("[+] [UNLOCK-GATE] SystemData.IsHaveSkin hook terpasang.");
      }
    } catch (e) {
      ctx.opts.log("[!] [UNLOCK-GATE] hook IsHaveSkin gagal: " + e);
    }
    try {
      const ishf = SystemData.tryMethod("IsHaveSkinForever");
      if (!ishf) {
        ctx.opts.log(
          "[-] [UNLOCK-GATE] SystemData.IsHaveSkinForever tidak ditemukan.",
        );
      } else {
        try {
          void ishf.nativeFunction;
        } catch {}
        ishf.implementation = function (skinid) {
          const ret = this.method("IsHaveSkinForever").invoke(skinid);
          try {
            const o = ret;
            if (o && !o.isNull()) return ret;
          } catch {}
          try {
            const sid = Number(skinid);
            if (ensureUnlocked(sid)) {
              const ret2 = this.method("IsHaveSkinForever").invoke(skinid);
              try {
                const o2 = ret2;
                if (o2 && !o2.isNull()) {
                  ctx.opts.log(
                    `[UNLOCK-GATE] IsHaveSkinForever(${sid}) -> granted`,
                  );
                  return ret2;
                }
              } catch {}
            }
          } catch {}
          return ret;
        };
        ctx.opts.log(
          "[+] [UNLOCK-GATE] SystemData.IsHaveSkinForever hook terpasang.",
        );
      }
    } catch (e) {
      ctx.opts.log("[!] [UNLOCK-GATE] hook IsHaveSkinForever gagal: " + e);
    }
    for (const clsName of ["UIChooseHero", "UIChooseHeroTrain"]) {
      try {
        const cls = ctx.asm.image.class(clsName);
        const cs = cls.tryMethod("CanSelectSkin");
        if (!cs) {
          ctx.opts.log(
            `[-] [UNLOCK-GATE] ${clsName}.CanSelectSkin tidak ditemukan.`,
          );
          continue;
        }
        try {
          void cs.nativeFunction;
        } catch {}
        cs.implementation = function (skinId, heroinfo) {
          try {
            const sid = Number(skinId);
            if (ctx.unlockedSkins.has(sid)) {
              ensureUnlocked(sid);
              return true;
            }
          } catch {}
          return this.method("CanSelectSkin").invoke(skinId, heroinfo);
        };
        ctx.opts.log(
          `[+] [UNLOCK-GATE] ${clsName}.CanSelectSkin hook terpasang.`,
        );
      } catch (e) {
        ctx.opts.log(
          `[!] [UNLOCK-GATE] hook ${clsName}.CanSelectSkin gagal: ` + e,
        );
      }
    }
    hookBoolFalse(ctx, SystemData, "IsActivityForbidHeros", "FORBID");
    hookBoolFalse(ctx, SystemData, "IsForbidHeros", "FORBID");
    hookBoolFalse(ctx, SystemData, "IsForbidHeroInChooseHero", "FORBID");
    try {
      const m = SystemData.tryMethod("IsUnlockDragonCrystal");
      if (m) {
        try {
          void m.nativeFunction;
        } catch {}
        m.implementation = function () {
          return true;
        };
        ctx.opts.log("[+] IsUnlockDragonCrystal -> true");
      }
    } catch {}
    try {
      const m = SystemData.tryMethod("IsRealHaveHero");
      if (m) {
        try {
          void m.nativeFunction;
        } catch {}
        m.implementation = function () {
          return true;
        };
        ctx.opts.log("[+] IsRealHaveHero -> true");
      }
    } catch {}
    try {
      const LoadRes = ctx.asm.image.class("LoadRes");
      const m = LoadRes.tryMethod("IsHaveHeroShowRes");
      if (m) {
        try {
          void m.nativeFunction;
        } catch {}
        m.implementation = function () {
          return true;
        };
        ctx.opts.log("[+] LoadRes.IsHaveHeroShowRes -> true");
      }
    } catch (e) {
      ctx.opts.log("[!] hook IsHaveHeroShowRes gagal: " + e);
    }
    hookBool0(ctx, SystemData, "IsRealHaveFaceBorder", "COSMETIC");
    try {
      const UIChangeHeadFramePage = ctx.asm.image.class(
        "UIChangeHeadFramePage",
      );
      const m = UIChangeHeadFramePage.tryMethod("IsHaveFaceBorder");
      if (m) {
        try {
          void m.nativeFunction;
        } catch {}
        m.implementation = function () {
          return true;
        };
        ctx.opts.log("[+] UIChangeHeadFramePage.IsHaveFaceBorder -> true");
      }
    } catch {}
    hookBool0(ctx, SystemData, "IsRealHaveFaceBorderByItemId", "COSMETIC");
    hookBool0(ctx, SystemData, "IsRealHaveLeader", "COSMETIC");
    try {
      const LoginReceiveMessage = ctx.asm.image.class("LoginReceiveMessage");
      const m = LoginReceiveMessage.tryMethod("get_IsAdvanceServer");
      if (m) {
        try {
          void m.nativeFunction;
        } catch {}
        m.implementation = function () {
          return true;
        };
      }
    } catch {}
    try {
      SystemData.field("m_bChangeZoneEnable").value = true;
    } catch {}
  }

  // src/ToolLeak/unlock-skin/server-hooks.ts
  function hookServerPacket(ctx) {
    try {
      const HeroGetListCache = ctx.asm.image.class("HeroGetListCache");
      const handleSC = HeroGetListCache.method("HandleSC");
      try {
        void handleSC.nativeFunction;
      } catch {}
      handleSC.implementation = function (retMsg) {
        const ret = this.method("HandleSC").invoke(retMsg);
        try {
          const sc = this.field("serverObj").value;
          ctx.opts.log(`
[SERVER_HOOK] === HeroGetListCache.HandleSC: serverObj ${sc && !sc.isNull() ? sc.handle : "NULL"} ===`);
          if (sc && !sc.isNull()) {
            try {
              patchHeroGetListSC(ctx, sc);
            } catch {}
            try {
              patchUnlockAllToServer(ctx, sc);
            } catch {}
            try {
              applyCurSkinOverrides(ctx);
            } catch {}
          }
        } catch (e) {
          ctx.opts.log(`[SERVER_HOOK] HandleSC dump gagal: ${e}`);
        }
        return ret;
      };
      ctx.opts.log("[+] HeroGetListCache.HandleSC hook terpasang.");
    } catch (e) {
      ctx.opts.log("[!] Hook HeroGetListCache.HandleSC gagal: " + e);
    }
    try {
      let GetListSC = null;
      try {
        GetListSC = ctx.asm.image.class("MTTDProto.Cmd_Hero_GetList_SC");
      } catch {
        GetListSC =
          ctx.asm.image.classes.find((c) => c.name === "Cmd_Hero_GetList_SC") ??
          null;
      }
      if (!GetListSC) {
        ctx.opts.log(
          "[-] [SERVER_PATCH] class Cmd_Hero_GetList_SC tidak ditemukan.",
        );
      } else {
        const visits = GetListSC.methods.filter((m) => m.name === "visit");
        if (visits.length === 0) {
          ctx.opts.log(
            "[-] [SERVER_PATCH] Cmd_Hero_GetList_SC.visit tidak ditemukan.",
          );
        }
        visits.forEach((visit) => {
          let sig = "";
          try {
            sig = visit.parameters
              .map((p) => `${p.type?.name ?? ""} ${p.name ?? ""}`)
              .join(",");
          } catch {}
          if (sig && !sig.includes("Unpack")) return;
          try {
            const originalVisit = new NativeFunction(
              visit.virtualAddress,
              "void",
              ["pointer", "pointer", "int"],
            );
            visit.implementation = function (t, bOpt) {
              try {
                const self = this;
                const tObj = t;
                originalVisit(
                  self.handle,
                  tObj && !tObj.isNull() ? tObj.handle : ptr(0),
                  bOpt ? 1 : 0,
                );
              } catch (e) {
                ctx.opts.log(`[-] [SERVER_PATCH] original visit gagal: ${e}`);
              }
              try {
                patchHeroGetListSC(ctx, this);
              } catch {}
              try {
                patchUnlockAllToServer(ctx, this);
              } catch {}
            };
            ctx.opts.log(`[+] [SERVER_PATCH] visit hook terpasang (${sig}).`);
          } catch (e) {
            ctx.opts.log(`[!] [SERVER_PATCH] visit hook gagal (${sig}): ${e}`);
          }
        });
      }
    } catch (e) {
      ctx.opts.log("[!] [SERVER_PATCH] hook visit gagal: " + e);
    }
    try {
      const GRM = ctx.asm.image.class("GameReceiveMessage");
      const setCur = GRM.tryMethod("on_Item_Set_CurSkin_SC");
      if (!setCur) {
        ctx.opts.log(
          "[-] [SERVER_PATCH] on_Item_Set_CurSkin_SC tidak ditemukan.",
        );
      } else {
        try {
          void setCur.nativeFunction;
        } catch {}
        setCur.implementation = function (retMsg) {
          const ret = this.method("on_Item_Set_CurSkin_SC").invoke(retMsg);
          try {
            applyCurSkinOverrides(ctx);
          } catch {}
          return ret;
        };
        ctx.opts.log(
          "[+] [SERVER_PATCH] on_Item_Set_CurSkin_SC hook terpasang.",
        );
      }
    } catch (e) {
      ctx.opts.log(
        "[!] [SERVER_PATCH] hook on_Item_Set_CurSkin_SC gagal: " + e,
      );
    }
    try {
      let CHC = null;
      try {
        CHC = ctx.asm.image.tryClass("CreateHeroCard");
      } catch {}
      if (!CHC) {
        try {
          CHC = ctx.asm.image.class("CreateHeroCard");
        } catch {}
      }
      if (!CHC) {
        CHC =
          ctx.asm.image.classes.find((c) => c.name === "CreateHeroCard") ??
          null;
      }
      let gds = null;
      try {
        gds = CHC ? CHC.tryMethod("GetHeroDressSkin") : null;
      } catch {
        gds = null;
      }
      if (!gds) {
        ctx.opts.log(
          "[-] [SETCURSKIN] CreateHeroCard.GetHeroDressSkin tidak ditemukan.",
        );
      } else {
        try {
          void gds.nativeFunction;
        } catch {}
        gds.implementation = function (heroId) {
          try {
            const hid = Number(heroId);
            const want = ctx.curSkinOverrides.get(hid);
            if (want !== void 0) return want;
          } catch {}
          return this.method("GetHeroDressSkin").invoke(heroId);
        };
        ctx.opts.log(
          "[+] [SETCURSKIN] CreateHeroCard.GetHeroDressSkin hook terpasang.",
        );
      }
    } catch (e) {
      ctx.opts.log("[!] [SETCURSKIN] hook GetHeroDressSkin gagal: " + e);
    }
    try {
      const UIF = ctx.asm.image.class("UIFuncs");
      const ghk = UIF.tryMethod("GetHeroKeyInfoList");
      if (ghk) {
        try {
          void ghk.nativeFunction;
        } catch {}
        ghk.implementation = function (
          heros,
          infoTable,
          ownHerolist,
          starVip,
          experienceDict,
        ) {
          return this.method("GetHeroKeyInfoList").invoke(
            heros,
            infoTable,
            ownHerolist,
            starVip,
            experienceDict,
          );
        };
        ctx.opts.log(
          "[+] [SETCURSKIN] UIFuncs.GetHeroKeyInfoList hook terpasang.",
        );
      } else {
        ctx.opts.log(
          "[-] [SETCURSKIN] UIFuncs.GetHeroKeyInfoList tidak ditemukan.",
        );
      }
    } catch (e) {
      ctx.opts.log("[!] [SETCURSKIN] hook GetHeroKeyInfoList gagal: " + e);
    }
    try {
      const addHeroSkin = ctx.SystemData.tryMethod("AddHeroSkin");
      if (addHeroSkin) {
        addHeroSkin.implementation = function (heroskin) {
          try {
            const skinId = heroskin.field("iId").value;
            const isMagicUnlock = heroskin.field("bSmartMagicUnlock").value;
            const limitTime = heroskin.field("iLimitTime").value;
            ctx.opts.log(
              `[SERVER_HOOK] AddHeroSkin called: skinId=${skinId} iLimitTime=${limitTime} bSmartMagicUnlock=${isMagicUnlock}`,
            );
          } catch {}
          return this.method("AddHeroSkin").invoke(heroskin);
        };
        ctx.opts.log("[+] SystemData.AddHeroSkin hook terpasang.");
      } else {
        ctx.opts.log("[-] SystemData.AddHeroSkin tidak ditemukan.");
      }
    } catch (e) {
      ctx.opts.log("[!] Hook SystemData.AddHeroSkin gagal: " + e);
    }
    if (ctx.opts.enableAutoApplyTrigger) {
      try {
        if (!ctx.CDataHeroCostume) throw new Error("CData class null");
        const GetMaxDataLength =
          ctx.CDataHeroCostume.method("GetMaxDataLength");
        Interceptor.attach(GetMaxDataLength.virtualAddress, {
          onLeave(_retval) {
            try {
              const now = Date.now();
              if (
                !ctx.serverApplyTimer &&
                now - ctx.serverLastApply > ctx.opts.serverApplyCooldownMs
              ) {
                ctx.opts.log("ServerPatch");
                applyDataServer(ctx);
              }
            } catch {}
          },
        });
        ctx.opts.log("[+] GetMaxDataLength auto-apply trigger terpasang.");
      } catch (e) {
        ctx.opts.log("[!] trigger GetMaxDataLength gagal: " + e);
      }
    }
  }

  // src/ToolLeak/unlock-skin/dumps.ts
  function dumpHeroGetListSC(ctx, sc) {
    try {
      const dumpList = function (listName, list, fields, maxShow) {
        try {
          if (!list || list.isNull()) {
            ctx.opts.log(`[SERVER_HOOK] ${listName} = NULL`);
            return;
          }
          const cnt = list.method("get_Count").invoke();
          ctx.opts.log(`[SERVER_HOOK] ${listName} count = ${cnt}`);
          const n = Math.min(cnt, maxShow);
          for (let i = 0; i < n; i++) {
            try {
              const it = list.method("get_Item").invoke(i);
              if (!it || it.isNull()) continue;
              const parts = [];
              for (const f of fields) {
                try {
                  parts.push(`${f}=${it.field(f).value}`);
                } catch {
                  parts.push(`${f}=?`);
                }
              }
              ctx.opts.log(`[SERVER_HOOK]   [${i}] ${parts.join(" ")}`);
            } catch {}
          }
          if (cnt > maxShow)
            ctx.opts.log(
              `[SERVER_HOOK]   ... (${cnt - maxShow} lagi, panggil dumpHeroGetList() untuk full)`,
            );
        } catch (e) {
          ctx.opts.log(`[SERVER_HOOK] ${listName} dump error: ${e}`);
        }
      };
      dumpList(
        "vHeroList (CmdHeroData)",
        sc.field("vHeroList").value,
        [
          "iHeroId",
          "iCurrentSkin",
          "iLimitTime",
          "iSkinSource",
          "iCurrentStatue",
          "iStatueSource",
          "iFightPowerLvl",
          "iFightPowerValue",
        ],
        50,
      );
      dumpList(
        "vSkinList (CmdHeroSkin)",
        sc.field("vSkinList").value,
        [
          "iId",
          "iLimitTime",
          "iSource",
          "iLimitTimeMagicChess",
          "iGetTime",
          "uiCurDragonCrystalId",
          "bSmartMagicUnlock",
          "iButtonSkin",
        ],
        50,
      );
      dumpList(
        "vStatueList (CmdHeroStatue)",
        sc.field("vStatueList").value,
        ["iId", "iLimitTime", "iSource"],
        20,
      );
      try {
        const mc = sc.field("vSkinListMagicChess").value;
        ctx.opts.log(
          `[SERVER_HOOK] vSkinListMagicChess count = ${mc && !mc.isNull() ? mc.method("get_Count").invoke() : "NULL"}`,
        );
      } catch {}
      try {
        ctx.opts.log(
          `[SERVER_HOOK] iHerosRewardIdx=${sc.field("iHerosRewardIdx").value} sMd5=${sc.field("sMd5").value}`,
        );
      } catch {}
    } catch (e) {
      ctx.opts.log(`[SERVER_HOOK] dumpHeroGetListSC error: ${e}`);
    }
  }
  function dumpCachedHeroGetList(ctx) {
    try {
      const Util = ctx.asm.image.class("HeroGetListCacheUtil");
      const cache = Util.field("cacheObj").value;
      if (!cache || cache.isNull()) {
        ctx.opts.log(
          "[SERVER_HOOK] HeroGetListCacheUtil.cacheObj = NULL (paket mentah sudah lewat/di-GC).",
        );
        ctx.opts.log(
          "[SERVER_HOOK] Pakai dumpServerHeroSkin() untuk data server yang sudah diproses game.",
        );
        return;
      }
      const sc = cache.field("serverObj").value;
      if (!sc || sc.isNull()) {
        ctx.opts.log("[SERVER_HOOK] cacheObj.serverObj = NULL");
        return;
      }
      ctx.opts.log(`
[SERVER_HOOK] === DUMP cached Cmd_Hero_GetList_SC (${sc.handle}) ===`);
      dumpHeroGetListSC(ctx, sc);
    } catch (e) {
      ctx.opts.log("[SERVER_HOOK] dumpHeroGetList gagal: " + e);
    }
  }
  function dumpServerHeroSkin(ctx, onlyOwned) {
    try {
      const dict = ctx.SystemData.field("m_heroInfos").value;
      if (!dict || dict.isNull()) {
        ctx.opts.log("[SERVER_HOOK] SystemData.m_heroInfos = NULL");
        return;
      }
      const enumerator = dict.method("GetEnumerator").invoke();
      let heroCount = 0;
      ctx.opts.log(`
[SERVER_HOOK] === SystemData.m_heroInfos ===`);
      while (
        enumerator &&
        !enumerator.isNull() &&
        enumerator.method("MoveNext").invoke()
      ) {
        try {
          const kvp = enumerator.method("get_Current").invoke();
          if (!kvp || kvp.isNull()) continue;
          const hki = kvp.method("get_Value").invoke();
          if (!hki || hki.isNull()) continue;
          heroCount++;
          const heroId = hki.field("m_heroID").value;
          const curSkin = hki.field("m_curSkinId").value;
          const defSkin = hki.field("m_defaultSkinId").value;
          const list = hki.field("m_heroskins").value;
          const cnt =
            list && !list.isNull() ? list.method("get_Count").invoke() : 0;
          if (onlyOwned && cnt === 0) continue;
          ctx.opts.log(
            `[SERVER_HOOK] Hero ${heroId}: curSkin=${curSkin} defaultSkin=${defSkin} skins=${cnt}`,
          );
          for (let j = 0; j < cnt; j++) {
            try {
              const sk = list.method("get_Item").invoke(j);
              if (!sk || sk.isNull()) continue;
              ctx.opts.log(
                `[SERVER_HOOK]   skin iId=${sk.field("iId").value} iLimitTime=${sk.field("iLimitTime").value} iSource=${sk.field("iSource").value} bSmartMagicUnlock=${sk.field("bSmartMagicUnlock").value} iButtonSkin=${sk.field("iButtonSkin").value}`,
              );
            } catch {}
          }
        } catch {}
      }
      ctx.opts.log(`[SERVER_HOOK] === END (${heroCount} hero) ===
`);
    } catch (e) {
      ctx.opts.log("[SERVER_HOOK] dumpServerHeroSkin gagal: " + e);
    }
  }
  function dumpSkinData(ctx, targetPath) {
    try {
      const inputPath =
        targetPath || "/Android/data/com.package.name/files/skin.json";
      ctx.opts.log("[*] Memulai ekstraksi data CData_HeroCostume_Element...");
      const persistentPath = persistentDataPath(ctx.asm);
      let realPackage = "";
      if (persistentPath) {
        const match = persistentPath.match(/Android\/data\/([^\/]+)/);
        if (match && match[1]) realPackage = match[1];
      }
      if (!ctx.CDataHeroCostume)
        return { success: false, error: "CData_HeroCostume_Element null" };
      const costumeInstances = Il2Cpp.gc.choose(ctx.CDataHeroCostume);
      const results = [];
      const seenSkinIds = /* @__PURE__ */ new Set();
      for (const instance of costumeInstances) {
        try {
          if (!instance || instance.isNull()) continue;
          const skinId = instance.field("m_ID").value;
          if (skinId === void 0 || skinId === null) continue;
          if (seenSkinIds.has(skinId)) continue;
          seenSkinIds.add(skinId);
          const heroId = instance.field("m_HeroId").value ?? 0;
          let namaSkin = "";
          try {
            const strName = instance.field("m_mName").value;
            if (strName && !strName.isNull()) namaSkin = strName.content ?? "";
          } catch {}
          let fileSkin = "";
          try {
            const strPrefab = instance.field("m_Prefabs").value;
            if (strPrefab && !strPrefab.isNull())
              fileSkin = strPrefab.content ?? "";
          } catch {}
          let uiSkin = "";
          try {
            const strSmallMap = instance.field("m_SmallMap").value;
            if (strSmallMap && !strSmallMap.isNull())
              uiSkin = strSmallMap.content ?? "";
          } catch {}
          results.push({
            ID_Skin: skinId,
            ID_Hero: heroId,
            Nama_Skin: namaSkin,
            File_Skin: fileSkin,
            UI_Skin: uiSkin,
          });
        } catch {}
      }
      const jsonStr = JSON.stringify(results, null, 2);
      const candidatePaths = [];
      candidatePaths.push(inputPath);
      if (inputPath.startsWith("/Android/")) {
        candidatePaths.push("/sdcard" + inputPath);
        candidatePaths.push("/storage/emulated/0" + inputPath);
      }
      const packagesToTry = /* @__PURE__ */ new Set();
      if (realPackage) packagesToTry.add(realPackage);
      packagesToTry.add("com.mobile.legends");
      for (const pkg of packagesToTry) {
        if (inputPath.includes("com.package.name")) {
          const pkgPath = inputPath.replace("com.package.name", pkg);
          candidatePaths.push(pkgPath);
          if (pkgPath.startsWith("/Android/")) {
            candidatePaths.push("/sdcard" + pkgPath);
            candidatePaths.push("/storage/emulated/0" + pkgPath);
          }
        }
      }
      if (persistentPath) {
        const fileName =
          inputPath.substring(inputPath.lastIndexOf("/") + 1) || "skin.json";
        candidatePaths.push(`${persistentPath}/${fileName}`);
        candidatePaths.push(`${persistentPath}/skin.json`);
      }
      candidatePaths.push(
        "/home/petwirkepo/MLBBLeakTool/fetchFromFile/skin.json",
      );
      const successfulPaths = [];
      const uniqueCandidates = Array.from(new Set(candidatePaths));
      for (const candidate of uniqueCandidates) {
        if (tryWriteFile(ctx.asm, candidate, jsonStr)) {
          successfulPaths.push(candidate);
        }
      }
      if (successfulPaths.length > 0) {
        ctx.opts.log(
          `[DUMP SKIN] Berhasil mengekstrak ${results.length} skin ke: ${successfulPaths[0]}`,
        );
        if (successfulPaths.length > 1) {
          ctx.opts.log(
            `[DUMP SKIN] Tertulis juga di: ${successfulPaths.slice(1).join(", ")}`,
          );
        }
        return {
          success: true,
          count: results.length,
          path: successfulPaths[0],
          paths: successfulPaths,
        };
      }
      const errMsg = `Gagal menulis ke semua lokasi kandidat: ${uniqueCandidates.join(", ")}`;
      ctx.opts.log(`[DUMP SKIN] ${errMsg}`);
      return { success: false, error: errMsg, count: results.length };
    } catch (err) {
      ctx.opts.log(`[DUMP SKIN] Error: ${err?.message ?? err}`);
      return { success: false, error: String(err?.message ?? err) };
    }
  }
  function dressSkin(ctx, skinId) {
    try {
      const sd = ctx.SystemData.method("AddSkinDressInfo");
      const isD = ctx.SystemData.method("IsDressSkin");
      const isH = ctx.SystemData.method("IsHaveSkinForever");
      const isS = ctx.SystemData.method("IsHaveSkin");
      let before = "";
      try {
        before = `IsDressSkin=${isD.invoke(skinId)} IsHaveSkinForever=${isH.invoke(skinId)} IsHaveSkin=${isS.invoke(skinId) !== null}`;
      } catch (e) {
        before = "cek-gagal: " + e;
      }
      ctx.opts.log(
        `[DRESS] sebelum AddSkinDressInfo(${skinId}, true): ${before}`,
      );
      sd.invoke(skinId, true);
      let after = "";
      try {
        after = `IsDressSkin=${isD.invoke(skinId)} IsHaveSkinForever=${isH.invoke(skinId)} IsHaveSkin=${isS.invoke(skinId) !== null}`;
      } catch (e) {
        after = "cek-gagal: " + e;
      }
      ctx.opts.log(
        `[DRESS] sesudah AddSkinDressInfo(${skinId}, true): ${after}`,
      );
    } catch (e) {
      ctx.opts.log("[DRESS] gagal: " + e);
    }
  }
  function checkDressSkinInHero(ctx, skinid) {
    ctx.opts.log(`
[SKIN_ANALYZE] === MENCARI skinid=${skinid} di semua HeroKeyInfo ===`);
    try {
      const hkiCls = ctx.asm.image.class("SystemData/HeroKeyInfo");
      const instances = Il2Cpp.gc.choose(hkiCls);
      for (const hki of instances) {
        try {
          const heroId = hki.field("m_heroID").value;
          const curSkinId = hki.field("m_curSkinId").value;
          const list = hki.field("m_heroskins").value;
          let hasSkin = false;
          if (list && !list.isNull()) {
            const cnt = list.method("get_Count").invoke();
            for (let i = 0; i < cnt; i++) {
              try {
                const skin = list.method("get_Item").invoke(i);
                if (
                  skin &&
                  !skin.isNull() &&
                  skin.field("iId").value === skinid
                ) {
                  hasSkin = true;
                  break;
                }
              } catch {}
            }
          }
          if (curSkinId === skinid) {
            ctx.opts.log(
              `[SKIN_ANALYZE] *** HERO ${heroId} memakai skin ${skinid} sebagai m_curSkinId! ***`,
            );
          } else if (hasSkin) {
            ctx.opts.log(
              `[SKIN_ANALYZE] Hero ${heroId} punya skin ${skinid} di m_heroskins tapi bukan curSkinId`,
            );
          }
        } catch {}
      }
    } catch (e) {
      ctx.opts.log("[SKIN_ANALYZE] Error: " + e);
    }
    ctx.opts.log("[SKIN_ANALYZE] === END SEARCH ===\n");
  }
  function registerDumpCommands(ctx) {
    globalThis.dumpHeroGetList = function () {
      dumpCachedHeroGetList(ctx);
    };
    globalThis.dumpServerHeroSkin = function (onlyOwned) {
      dumpServerHeroSkin(ctx, onlyOwned);
    };
    globalThis.dumpSkinData = function (targetPath) {
      return dumpSkinData(ctx, targetPath);
    };
    globalThis.dumpSkin = function (targetPath) {
      return dumpSkinData(ctx, targetPath);
    };
    globalThis.dressSkin = function (skinId) {
      dressSkin(ctx, skinId);
    };
    globalThis.checkDressSkinInHero = function (skinid) {
      checkDressSkinInHero(ctx, skinid);
    };
    globalThis.dumpSkinDictBeforeAfter = function (skinid) {
      ctx.opts.log(`
[SKIN_ANALYZE] === SKIN ID ${skinid} STATUS ===`);
      checkDressSkinInHero(ctx, skinid);
    };
    void findClass;
  }

  // src/ToolLeak/unlock-skin/index.ts
  var active = null;
  function runPrivateServerUnlockSkin(asm, coreRef, opts) {
    const resolved = asm ?? Il2Cpp.domain.assembly("Assembly-CSharp");
    const ctx = createCtx(resolved, opts);
    active = ctx;
    const log2 = ctx.opts.log;
    hookOwnershipGates(ctx);
    startCurSkinReapply(ctx);
    hookCurSkinFromUi(ctx);
    hookServerPacket(ctx);
    registerDumpCommands(ctx);
    if (ctx.opts.autoLoad) {
      try {
        loadDataServer(ctx);
      } catch {}
    }
    try {
      if (coreRef) {
        coreRef.current = {
          curSkinOverrides: ctx.curSkinOverrides,
          rebuildUnlockSets: () => rebuildUnlockSets(ctx),
          applyCurSkinOverrides: () => applyCurSkinOverrides(ctx),
        };
      }
    } catch {}
    globalThis.setCurSkin = function (heroId, skinId) {
      try {
        ctx.curSkinOverrides.set(heroId, skinId);
        try {
          rebuildUnlockSets(ctx);
        } catch {}
        applyCurSkinOverrides(ctx);
        log2(
          `[SETCURSKIN] override disimpan: Hero ${heroId} -> ${skinId} (re-apply tiap ${ctx.opts.curSkinReapplyMs}ms)`,
        );
      } catch (e) {
        log2("[SETCURSKIN] gagal: " + e);
      }
    };
    globalThis.clearCurSkinOverrides = function () {
      ctx.curSkinOverrides.clear();
      log2("[SETCURSKIN] semua override dibersihkan");
    };
    globalThis.patchServerSkin = function (heroId, skinId) {
      patchServerSkin(ctx, heroId, skinId);
    };
    globalThis.saveCurSkins = function () {
      return saveCurSkinsToServer(ctx);
    };
    globalThis.UnlockHero = function (heroid) {
      grantHero(ctx, heroid);
    };
    globalThis.UnlockAll = function () {
      const r = unlockAll(ctx);
      try {
        saveDataServer(ctx);
      } catch {}
      return r;
    };
    globalThis.saveDataServer = function () {
      return saveDataServer(ctx);
    };
    globalThis.loadDataServer = function () {
      return loadDataServer(ctx);
    };
    globalThis.applyDataServer = function () {
      applyDataServer(ctx);
    };
    globalThis.dbgDataServer = function () {
      dbgDataServer(ctx);
    };
    globalThis.serverFullInject = function (on) {
      if (on !== void 0) ctx.serverFullInject = !!on;
      return ctx.serverFullInject;
    };
    log2("[+] [UNLOCK-SKIN] private-server unlock skin aktif (standalone).");
    return {
      ctx,
      setCurSkin: (h, s) => globalThis.setCurSkin(h, s),
      clearCurSkinOverrides: () => globalThis.clearCurSkinOverrides(),
      patchServerSkin: (h, s) => patchServerSkin(ctx, h, s),
      unlockHero: (h) => grantHero(ctx, h),
      unlockAll: () => unlockAll(ctx),
      applyCurSkinOverrides: () => applyCurSkinOverrides(ctx),
      rebuildUnlockSets: () => rebuildUnlockSets(ctx),
    };
  }
  function runUnlockSkinStandalone(opts) {
    return runPrivateServerUnlockSkin(void 0, void 0, opts);
  }

  // src/debug-unlock-skin.ts
  startPipeline(() => {
    console.log("[*] unlock-skin standalone: IL2CPP siap, pasang hook...");
    runUnlockSkinStandalone();
  });

  console.log(
    "[+] Skin & Statue System Hooked Successfully with 'Assembly' variable.",
  );
}
