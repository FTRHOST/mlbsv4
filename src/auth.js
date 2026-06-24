/**
 * Licensing & User Authentication API Handler
 */

import { updateSession, sessionState } from "./config";
import { debugLog } from "./utils";
import { saveAuthCache, getFilesDir } from "./cache";

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
              
              const oldRole = sessionState.role;
              const success = updateSession(serverUid, role, ban, is_allowed);
              if (success) {
                debugLog("REST API User", `ACCESS GRANTED: User ${serverUid} verified as [${role.toUpperCase()}].`);
                saveAuthCache(serverUid, role, ban, is_allowed);
              } else {
                debugLog("REST API User", `ACCESS DENIED: User ${serverUid} is BANNED or NOT ALLOWED.`);
                saveAuthCache(serverUid, role, ban, is_allowed);
              }

              if (oldRole !== role) {
                handleRoleChange(oldRole, role);
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
  debugLog("REST API User", `Scheduling verification for operator ID ${uid} via native background thread...`);
  try {
    let register_async_ptr = null;
    let is_ready_ptr = null;
    let get_resp_ptr = null;

    const modules = Process.enumerateModules();
    for (let i = 0; i < modules.length; i++) {
      const mod = modules[i];
      if (mod.name.indexOf("mypatch") !== -1) {
        try {
          register_async_ptr = mod.findExportByName("register_user_native_async");
          is_ready_ptr = mod.findExportByName("is_async_registration_ready");
          get_resp_ptr = mod.findExportByName("get_async_registration_response");
          if (register_async_ptr && is_ready_ptr && get_resp_ptr) {
            debugLog("REST API User", `Found async exports in module ${mod.name}`);
            break;
          }
        } catch (e) {
          // Ignore
        }
      }
    }

    if (!register_async_ptr) {
      register_async_ptr = Module.findExportByName(null, "register_user_native_async");
      is_ready_ptr = Module.findExportByName(null, "is_async_registration_ready");
      get_resp_ptr = Module.findExportByName(null, "get_async_registration_response");
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
                    
                    const oldRole = sessionState.role;
                    const success = updateSession(serverUid, role, ban, is_allowed);
                    if (success) {
                      debugLog("REST API User", `ACCESS GRANTED (Async): User ${serverUid} verified as [${role.toUpperCase()}].`);
                      saveAuthCache(serverUid, role, ban, is_allowed);
                    } else {
                      debugLog("REST API User", `ACCESS DENIED (Async): User ${serverUid} is BANNED or NOT ALLOWED.`);
                      saveAuthCache(serverUid, role, ban, is_allowed);
                    }

                    if (oldRole !== role) {
                      handleRoleChange(oldRole, role);
                    }
                  } else {
                    updateSession(uid, "user", false, false);
                    debugLog("REST API User", `ACCESS DENIED (Async): Invalid user schema.`);
                  }
                } catch (err) {
                  updateSession(uid, "user", false, false);
                  debugLog("REST API User", `ACCESS DENIED (Async): Failed to parse user response: ${err.message}`);
                }
              } else {
                updateSession(uid, "user", false, false);
                debugLog("REST API User", `Empty user info response from Native (Async).`);
              }
            } else {
              updateSession(uid, "user", false, false);
              debugLog("REST API User", `Null response from Native verification (Async).`);
            }
          } else {
            checkCount++;
            if (checkCount < 40) { // Poll for up to 20 seconds
              setTimeout(pollAsyncResponse, 500);
            } else {
              debugLog("REST API User", "Async verification timed out.");
            }
          }
        } catch (e) {
          debugLog("REST API User", `Error polling async response: ${e.message}`);
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

function handleRoleChange(oldRole, newRole) {
  console.log(`[Auth Role Change] User role changed from [${oldRole.toUpperCase()}] to [${newRole.toUpperCase()}].`);
  
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
      
      console.log(`[Auth Role Change] Admin configurations and logs cleared from: ${dir}`);
    } catch (e) {
      console.log(`[Auth Role Change] Failed to clear admin files: ${e.message}`);
    }
  }

  // Trigger hot reload of Frida script and library update check
  triggerFridaReload();
}

function triggerFridaReload() {
  console.log("[Auth Role Change] Triggering native reload of Frida script and library OTA check...");
  try {
    let reload_fn_ptr = null;
    const modules = Process.enumerateModules();
    for (let i = 0; i < modules.length; i++) {
      const mod = modules[i];
      if (mod.name.indexOf("mypatch") !== -1) {
        reload_fn_ptr = mod.findExportByName("reload_frida_script_native");
        if (reload_fn_ptr) break;
      }
    }
    if (!reload_fn_ptr) {
      reload_fn_ptr = Module.findExportByName(null, "reload_frida_script_native");
    }
    if (reload_fn_ptr && !reload_fn_ptr.isNull()) {
      const reloadFrida = new NativeFunction(reload_fn_ptr, 'void', []);
      reloadFrida();
      console.log("[Auth Role Change] Native reload triggered successfully.");
    } else {
      console.log("[Auth Role Change] Error: reload_frida_script_native export not found!");
    }
  } catch (e) {
    console.log(`[Auth Role Change] Error triggering reload: ${e.message}`);
  }
}
