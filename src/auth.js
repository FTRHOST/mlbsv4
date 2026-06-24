/**
 * Licensing & User Authentication API Handler
 */

import { updateSession, sessionState } from "./config";
import { debugLog } from "./utils";
import { saveAuthCache } from "./cache";

export function verifyUserWithRestApi(uid) {
  debugLog("REST API User", `Verifying operator ID ${uid} using native call...`);
  try {
    let register_user_native_ptr = null;
    
    // Systematically search loaded modules for our patch library exports
    const modules = Process.enumerateModules();
    for (let i = 0; i < modules.length; i++) {
      const mod = modules[i];
      if (mod.name.indexOf("mypatch") !== -1) {
        try {
          const exp = mod.findExportByName("register_user_native");
          if (exp && !exp.isNull()) {
            register_user_native_ptr = exp;
            debugLog("REST API User", `Found export register_user_native in module ${mod.name} at ${exp}`);
            break;
          }
        } catch (e) {
          // Ignore
        }
      }
    }

    if (!register_user_native_ptr) {
      const exp = Module.findExportByName(null, "register_user_native");
      if (exp && !exp.isNull()) {
        register_user_native_ptr = exp;
      }
    }

    if (register_user_native_ptr && !register_user_native_ptr.isNull()) {
      const registerUser = new NativeFunction(register_user_native_ptr, 'pointer', ['pointer']);
      const uidPtr = Memory.allocUtf8String(uid);
      const resPtr = registerUser(uidPtr);
      if (resPtr && !resPtr.isNull()) {
        const responseJson = resPtr.readUtf8String();
        debugLog("REST API User", `User Data from Native: ${responseJson}`);
        if (responseJson) {
          try {
            const res = JSON.parse(responseJson);
            if (res && res.data) {
              const serverUid = res.data.uid || uid;
              const role = res.data.role || "user";
              const ban = res.data.ban;
              const is_allowed = res.data.is_allowed;
              
              const success = updateSession(serverUid, role, ban, is_allowed);
              if (success) {
                debugLog("REST API User", `ACCESS GRANTED: User ${serverUid} verified as [${role.toUpperCase()}].`);
                saveAuthCache(serverUid, role, ban, is_allowed);
              } else {
                debugLog("REST API User", `ACCESS DENIED: User ${serverUid} is BANNED or NOT ALLOWED.`);
                saveAuthCache(serverUid, role, ban, is_allowed);
              }
            } else {
              updateSession(uid, "user", false, false);
              debugLog("REST API User", `ACCESS DENIED: Invalid user schema.`);
            }
          } catch (err) {
            updateSession(uid, "user", false, false);
            debugLog("REST API User", `ACCESS DENIED: Failed to parse user response.`);
          }
        } else {
          updateSession(uid, "user", false, false);
          debugLog("REST API User", `Empty user info response from Native.`);
        }
      } else {
        updateSession(uid, "user", false, false);
        debugLog("REST API User", `Null response from Native verification.`);
      }
    } else {
      debugLog("REST API User", `Error: register_user_native export not found!`);
    }
  } catch (err) {
    debugLog("REST API User", `Error in native verification: ${err.message}`);
  }
}

export function verifyUserWithRestApiAsync(uid) {
  debugLog("REST API User", `Scheduling verification for operator ID ${uid} in background...`);
  try {
    if (Java.available) {
      Java.perform(() => {
        try {
          const Runnable = Java.use("java.lang.Runnable");
          const runnableInstance = Runnable.$new({
            run: function () {
              try {
                verifyUserWithRestApi(uid);
              } catch (e) {
                debugLog("REST API User", `Background verification error: ${e.message}`);
              }
            }
          });
          const Thread = Java.use("java.lang.Thread");
          const thread = Thread.$new(runnableInstance);
          thread.start();
        } catch (je) {
          debugLog("REST API User", `Failed to instantiate background thread: ${je.message}. Running synchronously.`);
          verifyUserWithRestApi(uid);
        }
      });
    } else {
      verifyUserWithRestApi(uid);
    }
  } catch (err) {
    debugLog("REST API User", `Failed to execute background task: ${err.message}. Running synchronously.`);
    verifyUserWithRestApi(uid);
  }
}
