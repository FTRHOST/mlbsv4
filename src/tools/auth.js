/**
 * Licensing & User Authentication API Handler
 */

import { updateSession, sessionState } from "./config";
import { debugLog } from "./utils";
import { saveAuthCache, getFilesDir } from "./cache";
import { findNativeExport } from "./hooking";

export function verifyUserWithRestApi(uid) {
  debugLog("REST API User", `Verifying operator ID ${uid} using native call...`);
  try {
    // Dual-name tolerant: cfg_fetch (baru) atau register_user_native (lama).
    // OTA JS dan .so bisa berbeda versi di device — salah satu boleh tua.
    const cfg_fetch_ptr = findNativeExport([
      "cfg_fetch",
      "register_user_native",
    ]);
    if (cfg_fetch_ptr) {
      debugLog("REST API User", `Found native auth export.`);
    }

    if (cfg_fetch_ptr && !cfg_fetch_ptr.isNull()) {
      const registerUser = new NativeFunction(cfg_fetch_ptr, 'pointer', ['pointer']);
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
              
              const oldRole = sessionState.role;
              const wasAuthorized = sessionState.isAuthorized;
              const success = updateSession(serverUid, role, ban, is_allowed);
              if (success) {
                debugLog("REST API User", `ACCESS GRANTED: User ${serverUid} verified as [${role.toUpperCase()}].`);
                saveAuthCache(serverUid, role, ban, is_allowed);
              } else {
                debugLog("REST API User", `ACCESS DENIED: User ${serverUid} is BANNED or NOT ALLOWED.`);
                saveAuthCache(serverUid, role, ban, is_allowed);
              }

              if (oldRole !== role) {
                const isInitialBootTransition = (oldRole === "user" && !wasAuthorized);
                handleRoleChange(oldRole, role, isInitialBootTransition);
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
      debugLog("REST API User", `Error: cfg_fetch export not found!`);
    }
  } catch (err) {
    debugLog("REST API User", `Error in native verification: ${err.message}`);
  }
}

export function verifyUserWithRestApiAsync(uid) {
  debugLog("REST API User", `Scheduling verification for operator ID ${uid} via native background thread...`);
  try {
    // Dual-name tolerant (lihat verifyUserWithRestApi).
    const register_async_ptr = findNativeExport([
      "cfg_fetch_async",
      "register_user_native_async",
    ]);
    const is_ready_ptr = findNativeExport([
      "cfg_fetch_ready",
      "is_async_registration_ready",
    ]);
    const get_resp_ptr = findNativeExport([
      "cfg_fetch_resp",
      "get_async_registration_response",
    ]);
    if (register_async_ptr && is_ready_ptr && get_resp_ptr) {
      debugLog("REST API User", `Found async native exports.`);
    }

    if (register_async_ptr && is_ready_ptr && get_resp_ptr && !register_async_ptr.isNull()) {
      const registerUserAsync = new NativeFunction(register_async_ptr, 'void', ['pointer']);
      const isRegistrationReady = new NativeFunction(is_ready_ptr, 'bool', []);
      const getRegistrationResponse = new NativeFunction(get_resp_ptr, 'pointer', []);

      const uidPtr = Memory.allocUtf8String(uid);
      registerUserAsync(uidPtr);

      let checkCount = 0;
      function pollAsyncResponse() {
        try {
          if (isRegistrationReady()) {
            const resPtr = getRegistrationResponse();
            if (resPtr && !resPtr.isNull()) {
              const responseJson = resPtr.readUtf8String();
              debugLog("REST API User", `Async User Data from Native: ${responseJson}`);
              if (responseJson) {
                try {
                  const res = JSON.parse(responseJson);
                  if (res && res.data) {
                    const serverUid = res.data.uid || uid;
                    const role = res.data.role || "user";
                    const ban = res.data.ban;
                    const is_allowed = res.data.is_allowed;
                    const branch = res.data.branch || "production";
                    
                    const oldRole = sessionState.role;
                    const wasAuthorized = sessionState.isAuthorized;
                    const success = updateSession(serverUid, role, ban, is_allowed);
                    if (success) {
                      debugLog("REST API User", `ACCESS GRANTED (Async): User ${serverUid} verified as [${role.toUpperCase()}].`);
                      saveAuthCache(serverUid, role, ban, is_allowed, branch);
                    } else {
                      debugLog("REST API User", `ACCESS DENIED (Async): User ${serverUid} is BANNED or NOT ALLOWED.`);
                      saveAuthCache(serverUid, role, ban, is_allowed, branch);
                    }

                    sessionState.isFullyReady = true;
                    if (oldRole !== role) {
                      // Do not trigger hot reload if this is just the initial boot transition from default 'user' to cached role
                      // and it's the very first startup check. We track this by seeing if the session was previously unauthorized.
                      const isInitialBootTransition = (oldRole === "user" && !wasAuthorized);
                      handleRoleChange(oldRole, role, isInitialBootTransition);
                    }
                  } else {
                    updateSession(uid, "user", false, false);
                    sessionState.isFullyReady = true;
                    debugLog("REST API User", `ACCESS DENIED (Async): Invalid user schema.`);
                  }
                } catch (err) {
                  updateSession(uid, "user", false, false);
                  sessionState.isFullyReady = true;
                  debugLog("REST API User", `ACCESS DENIED (Async): Failed to parse user response: ${err.message}`);
                }
              } else {
                updateSession(uid, "user", false, false);
                sessionState.isFullyReady = true;
                debugLog("REST API User", `Empty user info response from Native (Async).`);
              }
            } else {
              updateSession(uid, "user", false, false);
              sessionState.isFullyReady = true;
              debugLog("REST API User", `Null response from Native verification (Async).`);
            }
          } else {
            checkCount++;
            if (checkCount < 40) { // Poll for up to 20 seconds
              setTimeout(pollAsyncResponse, 500);
            } else {
              debugLog("REST API User", "Async verification timed out.");
              sessionState.isFullyReady = true;
            }
          }
        } catch (e) {
          debugLog("REST API User", `Error polling async response: ${e.message}`);
          sessionState.isFullyReady = true;
        }
      }

      setTimeout(pollAsyncResponse, 500);
    } else {
      debugLog("REST API User", "Async native exports not found. Running synchronously.");
      verifyUserWithRestApi(uid);
    }
  } catch (err) {
    debugLog("REST API User", `Failed to execute async registration: ${err.message}. Running synchronously.`);
    verifyUserWithRestApi(uid);
  }
}

function handleRoleChange(oldRole, newRole, skipReload = false) {
  debugLog("Auth Role Change", `User role changed from [${oldRole.toUpperCase()}] to [${newRole.toUpperCase()}].`);
  
  if (newRole !== "admin") {
    // Demoted from admin: Delete admin-only files instantly
    try {
      const dir = getFilesDir();
      const configPath = `${dir}/patch_config.properties`;
      const logPath = `${dir}/ota_log.txt`;
      
      const removeFunc = new NativeFunction(
        Module.findExportByName(null, "remove"),
        "int",
        ["pointer"]
      );
      
      const configPtr = Memory.allocUtf8String(configPath);
      const logPtr = Memory.allocUtf8String(logPath);
      
      removeFunc(configPtr);
      removeFunc(logPtr);

      debugLog("Auth Role Change", `Admin configurations and logs cleared from: ${dir}`);
    } catch (e) {
      debugLog("Auth Role Change", `Failed to clear admin files: ${e.message}`);
    }
  }

  // Trigger hot reload of Frida script and library update check
  if (!skipReload) {
    triggerFridaReload();
  } else {
    debugLog("Auth Role Change", "Skipping Frida reload (initial boot transition).");
  }
}

function triggerFridaReload() {
  debugLog("Auth Role Change", "Triggering native reload of Frida script and library OTA check...");
  try {
    const reload_fn_ptr = findNativeExport([
      "cfg_reload",
      "reload_frida_script_native",
    ]);
    if (reload_fn_ptr && !reload_fn_ptr.isNull()) {
      const reloadFrida = new NativeFunction(reload_fn_ptr, 'void', []);
      reloadFrida();
      debugLog("Auth Role Change", "Native reload triggered successfully.");
    } else {
      debugLog("Auth Role Change", "Error: native reload export not found!");
    }
  } catch (e) {
    debugLog("Auth Role Change", `Error triggering reload: ${e.message}`);
  }
}
