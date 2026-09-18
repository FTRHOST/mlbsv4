/**
 * Telemetry Hook Module — DISABLED (stealth).
 * Semua Interceptor.attach draft/battle + polling pengiriman dimatikan
 * sesuai keputusan user. Modul dipertahankan sebagai stub kompatibel:
 * - getOperatorId: baca ID operator sekali + verifikasi auth satu kali
 *   (tanpa interval 60s, tanpa kirim room/battle data).
 * - getMergedPlayers: no-op, kembalikan cache kosong.
 * - setupTelemetryHooks: poll ringan sampai operator ID ketemu untuk
 *   kebutuhan lisensi, tanpa hook apa pun.
 */

import { debugLog } from "../tools/utils";
import { verifyUserWithRestApiAsync } from "../tools/auth";
import { loadAuthCache } from "../tools/cache";

let cachedOperatorId = "";
let isUserAuthChecked = false;

export function getOperatorId(SystemData) {
  if (cachedOperatorId) return cachedOperatorId;
  try {
    let opIdStr = "";
    try {
      const LoginServerInfoClass =
        Il2Cpp.domain.assembly("Assembly-CSharp").image.class("LoginServerInfo");
      if (LoginServerInfoClass) {
        const instances = Il2Cpp.gc.choose(LoginServerInfoClass);
        if (instances && instances.length > 0) {
          const f = instances[0].field("m_iAccountId");
          if (f && f.value) {
            const s = f.value.toString();
            if (s && s !== "0" && s !== "undefined") opIdStr = s;
          }
        }
      }
    } catch (e) {}
    if (!opIdStr || opIdStr === "0" || opIdStr === "undefined") {
      try {
        const OpID = SystemData.field("m_uiID").value;
        opIdStr = OpID ? OpID.toString() : "";
      } catch (e) {}
    }
    if (opIdStr && opIdStr !== "0" && opIdStr !== "undefined") {
      cachedOperatorId = opIdStr;
      if (!isUserAuthChecked) {
        isUserAuthChecked = true;
        try {
          loadAuthCache();
        } catch (e) {}
        try {
          verifyUserWithRestApiAsync(opIdStr);
        } catch (e) {}
      }
      return opIdStr;
    }
  } catch (e) {}
  return "";
}

export function getMergedPlayers(activeUid, updateFn, forceScan = false) {
  return [];
}

export function setupTelemetryHooks(Assembly) {
  // Telemetry dimatikan: tanpa Interceptor.attach, tanpa interval pengiriman.
  // Hanya poll ringan untuk verifikasi lisensi operator (berhenti saat ketemu).
  try {
    let SystemData = null;
    try {
      SystemData =
        (Assembly.tryClass && Assembly.tryClass("SystemData")) ||
        Assembly.class("SystemData");
    } catch (e) {
      return;
    }
    if (!SystemData) return;
    let tries = 0;
    const poll = () => {
      try {
        const opId = getOperatorId(SystemData);
        if (opId && opId !== "0") {
          debugLog("REST API User", "Operator ID found: " + opId);
          return;
        }
      } catch (e) {}
      tries++;
      if (tries < 30) setTimeout(poll, 2000);
    };
    setTimeout(poll, 2000);
  } catch (e) {}
}
