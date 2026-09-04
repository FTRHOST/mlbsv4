/**
 * Secure Local Cache Handler for Asynchronous Licensing
 */

import { updateSession, sessionState } from "./config";
import { debugLog } from "./utils";
import { calculateCacheSignature, verifyCacheSignature, encryptString, decryptString } from "./crypto";

/**
 * Deteksi package name aktif tanpa bergantung pada Java bridge
 * (Java.available sering false saat hook berjalan sehingga fallback hardcode taptest terpakai).
 * Urutan: Java bridge → Il2Cpp bridge → /proc/self/cmdline → null.
 */
export function getPackageNameSync() {
  try {
    if (typeof Java !== "undefined" && Java.available) {
      let pkg = null;
      Java.performNow(() => {
        try {
          const currentApplication = Java.use("android.app.ActivityThread").currentApplication();
          if (currentApplication) {
            pkg = currentApplication.getPackageName();
          }
        } catch (_) {}
      });
      if (pkg) return pkg;
    }
  } catch (_) {}
  try {
    if (typeof Il2Cpp !== "undefined" && Il2Cpp.application && Il2Cpp.application.identifier) {
      const id = Il2Cpp.application.identifier;
      if (id) return id;
    }
  } catch (_) {}
  try {
    const raw = File.readAllText("/proc/self/cmdline");
    if (raw) {
      const pkg = raw.split("\0")[0].replace(/[^A-Za-z0-9_.]/g, "").trim();
      if (pkg && pkg.indexOf(".") !== -1) return pkg;
    }
  } catch (_) {}
  return null;
}

export function getFilesDir() {
  let filesDir = null;
  try {
    if (Java.available) {
      Java.performNow(() => {
        const ActivityThread = Java.use("android.app.ActivityThread");
        const currentApplication = ActivityThread.currentApplication();
        if (currentApplication) {
          try {
            const filesDirObj = currentApplication.getFilesDir();
            if (filesDirObj) {
              filesDir = filesDirObj.getAbsolutePath();
            }
          } catch (_) {}
          // Fallback package-aware: bangun path dari package aktif agar tahan ganti package
          if (!filesDir) {
            try {
              const pkg = currentApplication.getPackageName();
              if (pkg) {
                filesDir = `/data/data/${pkg}/files`;
              }
            } catch (_) {}
          }
        }
      });
    }
  } catch (e) {
    // Lanjut ke deteksi fallback di bawah
  }
  if (!filesDir) {
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
  // Fallback package-aware tanpa Java bridge (tahan ganti package)
  if (!filesDir) {
    const pkg = getPackageNameSync();
    if (pkg) {
      filesDir = `/data/data/${pkg}/files`;
    }
  }
  // Last resort: hardcode lama
  if (!filesDir) {
    filesDir = "/data/data/com.mobilelegends.taptest/files";
  }
  return filesDir;
}

export function getExternalFilesDir() {
  let extDir = null;
  try {
    if (Java.available) {
      Java.performNow(() => {
        const ActivityThread = Java.use("android.app.ActivityThread");
        const currentApplication = ActivityThread.currentApplication();
        if (currentApplication) {
          try {
            const extDirObj = currentApplication.getExternalFilesDir(null);
            if (extDirObj) {
              extDir = extDirObj.getAbsolutePath();
            }
          } catch (_) {}
          // Fallback package-aware: bangun path dari package aktif agar tahan ganti package
          if (!extDir) {
            try {
              const pkg = currentApplication.getPackageName();
              if (pkg) {
                extDir = `/storage/emulated/0/Android/data/${pkg}/files`;
              }
            } catch (_) {}
          }
        }
      });
    }
  } catch (e) {
    // Fallback di bawah
  }
  // Fallback package-aware tanpa Java bridge (tahan ganti package)
  if (!extDir) {
    const pkg = getPackageNameSync();
    if (pkg) {
      extDir = `/storage/emulated/0/Android/data/${pkg}/files`;
    }
  }
  // Last resort: hardcode lama
  if (!extDir) {
    extDir = "/storage/emulated/0/Android/data/com.mobilelegends.taptest/files";
  }
  return extDir;
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

      const firstBrace = content.indexOf("{");
      const lastBrace = content.lastIndexOf("}");

      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
        const jsonCandidate = content.substring(firstBrace, lastBrace + 1);
        try {
          cached = JSON.parse(jsonCandidate);
          loadedFromPlaintext = true;
        } catch (parseErr) {
          // Not valid plaintext JSON, try decrypting
          let decrypted = decryptString(content);
          if (decrypted) {
            decrypted = decrypted.trim();
            const fb = decrypted.indexOf("{");
            const lb = decrypted.lastIndexOf("}");
            if (fb !== -1 && lb !== -1 && lb >= fb) {
              cached = JSON.parse(decrypted.substring(fb, lb + 1));
            }
          }
        }
      } else {
        // Entire payload might be encrypted hex string
        let decrypted = decryptString(content);
        if (decrypted) {
          decrypted = decrypted.trim();
          const fb = decrypted.indexOf("{");
          const lb = decrypted.lastIndexOf("}");
          if (fb !== -1 && lb !== -1 && lb >= fb) {
            cached = JSON.parse(decrypted.substring(fb, lb + 1));
          }
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

        sessionState.branch = cached.branch || "production";
        updateSession(cached.uid, cached.role, cached.ban, cached.is_allowed);
        debugLog("Auth Cache", `Loaded cached session for ${cached.uid} [${cached.role.toUpperCase()}] (Branch: ${sessionState.branch}).`);
        return cached;
      }
    }
  } catch (e) {
    debugLog("Auth Cache", `Cache load skipped/failed: ${e.message}`);
  }
  return null;
}

export function saveAuthCache(uid, role, ban, isAllowed, branch = "production") {
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
      branch: branch,
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
