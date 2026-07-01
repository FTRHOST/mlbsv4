/**
 * MLBB Mod Configuration & Role Permissions System
 */

export const CONFIG = {
  TARGET_LIB: "liblogic.so",
  API_ROOMS_URL: "https://mlbsv4.vercel.app/api/rooms",
  API_KEY: "mlbs_secret_token_2026",

  // Define features accessible by each role
  ROLES: {
    admin: {
      allowFreeSkin: true,
      allowGMMode: true,
      allowUnreleased: true,
      description: "Administrator Access - All Features Enabled",
    },
    vip: {
      allowFreeSkin: true,
      allowGMMode: false,
      allowUnreleased: true,
      description: "VIP Access - Skins & Telemetry Enabled (No GM Mode)",
    },
    user: {
      allowFreeSkin: true,
      allowGMMode: true,
      allowUnreleased: true,
      description: "Regular User - Telemetry Only",
    },
    leaker: {
      allowFreeSkin: true,
      allowGMMode: true,
      allowUnreleased: true,
      description: "Leaker",
    },
  },
};

// Global session state to hold user permissions
export let sessionState = {
  uid: "",
  role: "user", // default fallback
  isAuthorized: false,
  permissions: {
    allowFreeSkin: false,
    allowGMMode: false,
    allowTelemetry: false,
    allowBattleFeatures: false,
  },
};

/**
 * Updates the global session state based on user role and auth status
 */
export function updateSession(uid, role, ban, isAllowed) {
  sessionState.uid = uid;
  sessionState.role = role || "user";

  if (ban === true || isAllowed === false) {
    sessionState.isAuthorized = false;
    sessionState.permissions = {
      allowFreeSkin: false,
      allowGMMode: false,
      allowTelemetry: false,
      allowBattleFeatures: false,
    };
    return false;
  }

  sessionState.isAuthorized = true;
  const roleConfig = CONFIG.ROLES[sessionState.role] || CONFIG.ROLES.user;
  sessionState.permissions = { ...roleConfig };
  return true;
}
