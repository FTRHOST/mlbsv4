/**
 * Secure Local Cache Handler for Asynchronous Licensing
 */

import { updateSession } from "./config";
import { debugLog } from "./utils";
import { calculateCacheSignature, verifyCacheSignature, encryptString, decryptString } from "./crypto";

export function getFilesDir() {
  let filesDir = "/data/data/com.mobilelegends.taptest/files";
  try {
    if (Java.available) {
      Java.performNow(() => {
        const ActivityThread = Java.use("android.app.ActivityThread");
        const currentApplication = ActivityThread.currentApplication();
        if (currentApplication) {
          const filesDirObj = currentApplication.getFilesDir();
          if (filesDirObj) {
            filesDir = filesDirObj.getAbsolutePath();
          }
        }
      });
    }
  } catch (e) {
    // Fallback to module path detection if Java fails
    try {
      const modules = Process.enumerateModules();
      for (let i = 0; i < modules.length; i++) {
        const mod = modules[i];
        if (mod.name.indexOf("mypatch") !== -1 || mod.name.indexOf("myloader") !== -1) {
          const path = mod.path;
          if (path.indexOf("/files/") !== -1) {
            const idx = path.indexOf("/files/");
            filesDir = path.substring(0, idx + 6);
            break;
          } else if (path.indexOf("/data/user/") !== -1 || path.indexOf("/data/data/") !== -1) {
            const idx = path.lastIndexOf("/");
            if (idx !== -1) {
              filesDir = path.substring(0, idx);
              break;
            }
          }
        }
      }
    } catch (err) {
      // Ignore
    }
  }
  return filesDir;
}

export function loadAuthCache() {
  const dir = getFilesDir();
  const cachePath = `${dir}/auth_cache.json`;
  try {
    let content = File.readAllText(cachePath);
    if (content) {
      content = content.trim();
      let cached = null;
      let loadedFromPlaintext = false;

      if (content.startsWith("{")) {
        // Plaintext JSON format (only permitted for admin role debugging)
        const firstBrace = content.indexOf("{");
        const lastBrace = content.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          content = content.substring(firstBrace, lastBrace + 1);
        }
        cached = JSON.parse(content);
        loadedFromPlaintext = true;
      } else {
        // Encrypted hex format (for non-admin roles)
        let decrypted = decryptString(content);
        if (decrypted) {
          decrypted = decrypted.trim();
          const firstBrace = decrypted.indexOf("{");
          const lastBrace = decrypted.lastIndexOf("}");
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            decrypted = decrypted.substring(firstBrace, lastBrace + 1);
          }
          cached = JSON.parse(decrypted);
        }
      }

      if (cached && cached.uid) {
        // Validate integrity signature to prevent manual role editing
        if (!verifyCacheSignature(cached)) {
          debugLog("Auth Cache Integrity", "WARNING: Auth cache signature mismatch! Possible tampering detected.");
          try {
            File.writeAllText(cachePath, "{}"); // Reset tampered cache
          } catch (err) {
            // Ignore
          }
          return null;
        }

        // Enforce rule: non-admin roles (e.g. user, vip) MUST be encrypted on disk.
        // If loaded from plaintext, only allow role: "admin"
        if (loadedFromPlaintext && cached.role !== "admin") {
          debugLog("Auth Cache Integrity", "WARNING: Plaintext cache is not allowed for non-admin roles!");
          try {
            File.writeAllText(cachePath, "{}"); // Reset plaintext user cache
          } catch (err) {
            // Ignore
          }
          return null;
        }

        // Validate cache expiration (e.g. 7 days max age)
        const maxAge = 7 * 24 * 60 * 60 * 1000;
        if (cached.timestamp && (Date.now() - cached.timestamp > maxAge)) {
          debugLog("Auth Cache Integrity", "Cached session expired. Re-authentication required.");
          return null;
        }

        updateSession(cached.uid, cached.role, cached.ban, cached.is_allowed);
        debugLog("Auth Cache", `Loaded cached session for ${cached.uid} [${cached.role.toUpperCase()}].`);
        return cached;
      }
    }
  } catch (e) {
    debugLog("Auth Cache", `Cache load skipped/failed: ${e.message}`);
  }
  return null;
}

export function saveAuthCache(uid, role, ban, isAllowed) {
  const dir = getFilesDir();
  const cachePath = `${dir}/auth_cache.json`;
  try {
    const timestamp = Date.now();
    const signature = calculateCacheSignature(uid, role, ban, isAllowed, timestamp);
    const data = {
      uid: uid,
      role: role,
      ban: ban,
      is_allowed: isAllowed,
      timestamp: timestamp,
      signature: signature
    };
    
    const jsonString = JSON.stringify(data);
    
    // Admin is kept in plaintext for debugging; others (e.g., user, vip) are encrypted
    if (role === "admin") {
      File.writeAllText(cachePath, jsonString);
      debugLog("Auth Cache", `Successfully cached signed plaintext session (admin) for ${uid}.`);
    } else {
      const encryptedHex = encryptString(jsonString);
      File.writeAllText(cachePath, encryptedHex);
      debugLog("Auth Cache", `Successfully cached encrypted session (non-admin) for ${uid}.`);
    }
  } catch (e) {
    debugLog("Auth Cache", `Failed to save auth cache: ${e.message}`);
  }
}
