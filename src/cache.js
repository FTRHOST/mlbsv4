/**
 * Secure Local Cache Handler for Asynchronous Licensing
 */

import { updateSession } from "./config";
import { debugLog } from "./utils";
import { calculateCacheSignature, verifyCacheSignature } from "./crypto";

export function getFilesDir() {
  let filesDir = "/data/data/com.mobilelegends.taptest/files";
  try {
    const modules = Process.enumerateModules();
    for (let i = 0; i < modules.length; i++) {
      const mod = modules[i];
      if (mod.name.indexOf("mypatch") !== -1 || mod.name.indexOf("myloader") !== -1) {
        const path = mod.path;
        // Example: /data/app/~~.../lib/arm64/libmypatch.so
        // Or if loaded from cache: /data/user/0/com.mobilelegends.taptest/files/libmypatch_cache.so
        // We only want directory if it contains /files/ or /data/user/ or /data/data/
        if (path.indexOf("/files/") !== -1) {
          const idx = path.indexOf("/files/");
          filesDir = path.substring(0, idx + 6);
          break;
        } else if (path.indexOf("/data/user/") !== -1 || path.indexOf("/data/data/") !== -1) {
          // If in private app files directory but not directly in /files
          const idx = path.lastIndexOf("/");
          if (idx !== -1) {
            filesDir = path.substring(0, idx);
            break;
          }
        }
      }
    }
  } catch (e) {
    // Ignore
  }
  return filesDir;
}

export function loadAuthCache() {
  const dir = getFilesDir();
  const cachePath = `${dir}/auth_cache.json`;
  try {
    const content = File.readAllText(cachePath);
    if (content) {
      const cached = JSON.parse(content);
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
    // Cache file might not exist yet
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
    File.writeAllText(cachePath, JSON.stringify(data));
    debugLog("Auth Cache", `Successfully cached signed session for ${uid}.`);
  } catch (e) {
    debugLog("Auth Cache", `Failed to save auth cache: ${e.message}`);
  }
}
