/**
 * Telemetry Hook Module
 */

import { sessionState } from "../tools/config";
import { debugLog } from "../tools/utils";
import { sendRoomData, sendBattleStats } from "../tools/telemetry";
import { verifyUserWithRestApiAsync } from "../tools/auth";
import { loadAuthCache } from "../tools/cache";

let cachedOperatorId = "";
let isUserAuthChecked = false;

export function getOperatorId(SystemData) {
  if (cachedOperatorId) return cachedOperatorId;
  try {
    let opIdStr = "";

    // Attempt 1: Try reading from LoginServerInfo.m_iAccountId
    try {
      const LoginServerInfoClass = Il2Cpp.domain
        .assembly("Assembly-CSharp")
        .image.class("LoginServerInfo");
      if (LoginServerInfoClass) {
        // Try to get a valid instance of LoginServerInfo if it's not a static field
        const instances = Il2Cpp.gc.choose(LoginServerInfoClass);
        if (instances.length > 0) {
          const accountIdField = instances[0].field("m_iAccountId");
          if (accountIdField && accountIdField.value) {
            const accIdStr = accountIdField.value.toString();
            if (accIdStr && accIdStr !== "0" && accIdStr !== "undefined") {
              opIdStr = accIdStr;
            }
          }
        }
      }
    } catch (e) {
      // Fallback
    }

    // Attempt 2: Fallback to reading m_uiID from SystemData
    if (!opIdStr || opIdStr === "0" || opIdStr === "undefined") {
      const OpID = SystemData.field("m_uiID").value;
      opIdStr = OpID ? OpID.toString() : "";
    }

    if (opIdStr && opIdStr !== "0" && opIdStr !== "undefined") {
      cachedOperatorId = opIdStr;
      if (!isUserAuthChecked) {
        isUserAuthChecked = true;
        loadAuthCache();
        verifyUserWithRestApiAsync(opIdStr);

        setInterval(() => {
          try {
            if (cachedOperatorId) {
              debugLog(
                "Auth Periodic",
                `Performing periodic role verification check for ${cachedOperatorId}...`,
              );
              verifyUserWithRestApiAsync(cachedOperatorId);
            }
          } catch (err) {
            // Ignore
          }
        }, 60000);
      }
      return opIdStr;
    }
  } catch (e) {
    // Ignore
  }
  return "";
}

export function setupAuthID(Assembly) {
  const SystemData = Assembly.class("SystemData");

  // Startup Auth Polling Loop
  let authChecksCount = 0;
  function pollOperatorIdForVerification() {
    try {
      const opId = getOperatorId(SystemData);
      if (opId && opId !== "0") {
        debugLog(
          "REST API User",
          `Yess, Operator ID found during startup poll: ${opId}`,
        );
      } else {
        authChecksCount++;
        // Keep polling indefinitely every 2 seconds until the user logs in
        setTimeout(pollOperatorIdForVerification, 2000);
      }
    } catch (e) {
      authChecksCount++;
      setTimeout(pollOperatorIdForVerification, 2000);
    }
  }

  pollOperatorIdForVerification();
}
