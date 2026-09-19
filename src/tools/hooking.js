/**
 * Shared Il2Cpp hooking helpers (zero-dependency).
 *
 * Diekstrak dari duplikat identik di mods/skins.js, mods/gm.js,
 * mods/unreleased.js, dan mods/battle_commands.js agar satu pola dipakai
 * di semua modul. Tanpa perubahan perilaku.
 */

export function safeClass(Assembly, name) {
  try {
    const cls =
      (Assembly.tryClass && Assembly.tryClass(name)) || Assembly.class(name);
    if (!cls || !cls.handle || cls.handle.isNull()) return null;
    return cls;
  } catch (e) {
    return null;
  }
}

export function hookMethod(cls, name, fn) {
  try {
    if (!cls) return false;
    const m = (cls.tryMethod && cls.tryMethod(name)) || cls.method(name);
    if (!m) return false;
    m.implementation = fn;
    return true;
  } catch (e) {
    return false;
  }
}

export function safeMethod(cls, name) {
  try {
    if (!cls) return null;
    const m = (cls.tryMethod && cls.tryMethod(name)) || cls.method(name);
    if (!m || !m.virtualAddress || m.virtualAddress.isNull()) return null;
    return m;
  } catch (e) {
    return null;
  }
}

// Resolve native helper exports with version tolerance: new neutral names
// (cfg_*) first, legacy descriptive names as fallback. WAJIB karena OTA
// mengupdate JS dan .so di waktu berbeda (cache CDN .so/.sig bisa lebih
// lambat dari hook.js) — salah satu sisi boleh lebih tua tanpa crash.
// Juga tahan terhadap Module instance tanpa findExportByName (cek typeof).
export function findNativeExport(names) {
  const list = Array.isArray(names) ? names : [names];
  const tryNames = (lookup) => {
    for (let i = 0; i < list.length; i++) {
      try {
        const p = lookup(list[i]);
        if (p && !p.isNull()) return p;
      } catch (e) {}
    }
    return null;
  };
  try {
    const modules = Process.enumerateModules();
    for (let i = 0; i < modules.length; i++) {
      const mod = modules[i];
      if (!mod || !mod.name || mod.name.indexOf("mypatch") === -1) continue;
      const hit = tryNames((n) => {
        if (typeof mod.findExportByName === "function") {
          return mod.findExportByName(n);
        }
        return mod.getExportByName(n);
      });
      if (hit) return hit;
    }
  } catch (e) {}
  const globalHit = tryNames((n) => Module.findExportByName(null, n));
  if (globalHit) return globalHit;
  return tryNames((n) => Module.findExportByName("libmypatch.so", n));
}
