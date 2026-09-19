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
