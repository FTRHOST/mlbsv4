/**
 * Telemetry and Room Data Network Reporter — DISABLED (stealth).
 * Semua pengiriman dimatikan sesuai keputusan user. Fungsi dipertahankan
 * sebagai no-op agar import yang ada tidak crash.
 */

import { debugLog } from "./utils";

const TELEMETRY_ENABLED = false;

export function sendToRestApi(payload, target = 'rooms', operatorId = null) {
  if (!TELEMETRY_ENABLED) return;
  debugLog("REST API", "Telemetry disabled, dropping payload.");
}

export function sendRoomData(payload) {
  sendToRestApi(payload, 'rooms');
}

export function sendBattleStats(operatorId, payload) {
  debugLog("REST API", `sendBattleStats called for operator: ${operatorId}`);
  sendToRestApi(payload, 'stats', operatorId);
}
