/**
 * Logger & Helper Utilities Section
 */

export function getIndonesianDateTime() {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const d = new Date();

  // Indonesian Timezone (WIB is UTC+7)
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const wibDate = new Date(utc + 3600000 * 7);

  const day = wibDate.getDate();
  const month = months[wibDate.getMonth()];
  const year = wibDate.getFullYear();
  const hours = String(wibDate.getHours()).padStart(2, "0");
  const minutes = String(wibDate.getMinutes()).padStart(2, "0");
  const seconds = String(wibDate.getSeconds()).padStart(2, "0");

  return `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`;
}

import { sessionState } from "./config";

export function debugLog(section, message) {
  if (sessionState.role === "admin") {
    console.log(`[${section}] ${message}`);
  }
}
