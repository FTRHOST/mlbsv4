import { debugLog } from "../tools/utils";

function strOf(v) {
  try {
    if (!v || v.isNull()) return "";
    try {
      return String(v.toString()).replace(/^"|"$/g, "");
    } catch (e) {
      return String(v.content);
    }
  } catch (e) {
    return "";
  }
}

export function heroWithId(Assembly) {
  let logged = 0;
  let count = 0;
  const patch = function (clsName) {
    try {
      const cls = Assembly.class(clsName);
      cls.method("RefreshHeroName").implementation = function (
        herodata,
        label,
      ) {
        try {
          this.method("RefreshHeroName").invoke(herodata, label);
        } catch (e) {}
        try {
          count++;
          const hdNull = !herodata || herodata.isNull();
          const lbNull = !label || label.isNull();
          let hid = -1;
          let nm = "";
          let before = "";
          if (!hdNull) {
            try {
              hid = Number(herodata.field("m_ID").value);
            } catch (e) {}
            try {
              nm = strOf(herodata.field("m_mName").value);
            } catch (e) {
              nm = "READ-ERR";
            }
          }
          if (!lbNull) {
            try {
              before = strOf(label.method("get_text").invoke());
            } catch (e) {}
          }
          if (logged < 12) {
            logged++;
            debugLog(
              "[UINAME][DBG][" +
                clsName +
                "] hdNull=" +
                hdNull +
                " lbNull=" +
                lbNull +
                " hid=" +
                hid +
                ' nm="' +
                nm +
                '" labelBefore="' +
                before +
                '"',
            );
          }
          if (hdNull || lbNull || !hid || !nm || nm === "READ-ERR") return;
          const prefix = hid + " (";
          if (nm.indexOf(prefix) === 0) return; // tabel sudah di-rename -> biarkan
          const baru = hid + " (" + nm + ")";
          label.method("set_text").invoke(Il2Cpp.string(baru));
        } catch (e) {}
      };
      debugLog("[UINAME] hook " + clsName + ".RefreshHeroName terpasang");
    } catch (e) {
      debugLog("[UINAME][!] hook " + clsName + " gagal: " + e);
    }
  };
  patch("UIChooseHero");
  patch("UIChooseHeroTrain");
  debugLog("[UINAME] resident. Buka layar pick hero: nama tampil 'ID (Nama)'.");
  setInterval(() => {
    if (count > 0) debugLog("[UINAME] total label ditempel=" + count);
  }, 30000);
}
