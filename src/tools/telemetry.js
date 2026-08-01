/**
 * Telemetry and Room Data Network Reporter
 */

import { CONFIG, sessionState } from "./config";
import { debugLog } from "./utils";

export function sendToRestApi(payload) {
  try {
    let send_room_data_native_ptr = null;
    const modules = Process.enumerateModules();
    for (let i = 0; i < modules.length; i++) {
      const mod = modules[i];
      if (mod.name.indexOf("mypatch") !== -1) {
        send_room_data_native_ptr = mod.findExportByName("send_room_data_native");
        if (send_room_data_native_ptr) break;
      }
    }
    if (!send_room_data_native_ptr) {
      send_room_data_native_ptr = Module.findExportByName(null, "send_room_data_native");
    }

    if (send_room_data_native_ptr && !send_room_data_native_ptr.isNull()) {
      const sendRoomDataNative = new NativeFunction(send_room_data_native_ptr, 'void', ['pointer']);
      const jsonBody = JSON.stringify(payload);
      const payloadPtr = Memory.allocUtf8String(jsonBody);
      sendRoomDataNative(payloadPtr);
      debugLog("REST API", "Data forwarded to native send_room_data_native");
      return;
    }
  } catch (err) {
    debugLog("REST API", `Error trying native forwarder: ${err.message}`);
  }

  if (typeof Java === "undefined" || !Java.available) {
    debugLog("REST API", "Java not available");
    return;
  }
  Java.perform(() => {
    try {
      const Thread = Java.use("java.lang.Thread");
      const dynamicClassName =
        "com.mobilelegends.ApiRunnable_" + Math.floor(Math.random() * 1000000);
      const ApiRunnable = Java.registerClass({
        name: dynamicClassName,
        implements: [Java.use("java.lang.Runnable")],
        methods: {
          run: function () {
            try {
              const URL = Java.use("java.net.URL");
              const HttpURLConnection = Java.use("java.net.HttpURLConnection");
              const DataOutputStream = Java.use("java.io.DataOutputStream");

              let isFirebase = CONFIG.API_ROOMS_URL.indexOf("firebaseio.com") !== -1;
              let targetUrlStr = CONFIG.API_ROOMS_URL;

              if (isFirebase) {
                // Ensure base URL ends with /
                if (!targetUrlStr.endsWith("/")) targetUrlStr += "/";
                // Append operatorId path and auth token (API_KEY acts as Firebase Secret here)
                // We write directly to test/OperatorId/{operatorId}/iPlayer.json
                if (!targetUrlStr.includes("test/OperatorId/")) {
                    targetUrlStr += "test/OperatorId/";
                }
                targetUrlStr += payload.operatorId + "/iPlayer.json?auth=" + CONFIG.FIREBASE_RTDB_SECRET;
                
                // Add Server Timestamp for Firebase RTDB
                payload.updatedAt = { ".sv": "timestamp" };
              }

              const urlObj = URL.$new(targetUrlStr);
              const conn = Java.cast(
                urlObj.openConnection(),
                HttpURLConnection,
              );
              
              conn.setRequestMethod("POST");
              
              if (isFirebase) {
                // Java HttpURLConnection often doesn't support PATCH natively, use override header
                conn.setRequestProperty("X-HTTP-Method-Override", "PATCH");
              } else {
                conn.setRequestProperty("x-api-key", CONFIG.API_KEY);
              }
              
              conn.setRequestProperty("Content-Type", "application/json");
              conn.setRequestProperty(
                "User-Agent",
                "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
              );
              conn.setConnectTimeout(5000);
              conn.setReadTimeout(5000);
              conn.setDoOutput(true);

              const jsonBody = JSON.stringify(payload);
              const jsonJavaString = Java.use("java.lang.String").$new(jsonBody);
              const jsonBytes = jsonJavaString.getBytes("UTF-8");

              const os = conn.getOutputStream();
              const writer = DataOutputStream.$new(os);
              writer.write(jsonBytes, 0, jsonBytes.length);
              writer.flush();
              writer.close();

              const responseCode = conn.getResponseCode();
              debugLog(
                "REST API",
                `Data sent to ${isFirebase ? "Firebase RTDB" : "Vercel"}. Response Code: ${responseCode}`,
              );
              conn.disconnect();
            } catch (err) {
              debugLog("REST API", `Error: ${err.message}`);
            }
          },
        },
      });
      const runnable = ApiRunnable.$new();
      const apiThread = Thread.$new(runnable);
      apiThread.start();
    } catch (err) {
      debugLog("REST API", `Thread start error: ${err.message}`);
    }
  });
}

export function sendRoomData(payload) {
  sendToRestApi(payload);
}

export function sendBattleStats(operatorId, payload) {
  // Similar to sendToRestApi but targeting /api/stats/:operatorId
  try {
    // Basic implementation mimicking sendToRestApi but calling the stats endpoint
    // For simplicity, let's reuse sendToRestApi by temporarily overriding or constructing a new URL.
    // Actually, creating a new function is safer.
    
    // Simplification: Using Java.perform directly for now, similar to sendToRestApi
    Java.perform(() => {
        try {
            const URL = Java.use("java.net.URL");
            const HttpURLConnection = Java.use("java.net.HttpURLConnection");
            const DataOutputStream = Java.use("java.io.DataOutputStream");
            
            // Construct stats URL based on base API URL
            let targetUrl = CONFIG.API_ROOMS_URL.replace("/api/rooms", "") + "/api/stats/" + operatorId;
            
            const urlObj = URL.$new(targetUrl);
            const conn = Java.cast(urlObj.openConnection(), HttpURLConnection);
            conn.setRequestMethod("POST");
            conn.setRequestProperty("x-api-key", CONFIG.API_KEY);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setConnectTimeout(5000);
            conn.setDoOutput(true);
            
            const jsonBody = JSON.stringify(payload);
            const jsonBytes = Java.use("java.lang.String").$new(jsonBody).getBytes("UTF-8");
            
            const os = conn.getOutputStream();
            const writer = DataOutputStream.$new(os);
            writer.write(jsonBytes, 0, jsonBytes.length);
            writer.flush();
            writer.close();
            
            debugLog("REST API", `Stats sent to ${targetUrl}. Response: ${conn.getResponseCode()}`);
            conn.disconnect();
        } catch (err) {
            debugLog("REST API", `Error sending stats: ${err.message}`);
        }
    });
  } catch (err) {
    debugLog("REST API", `Error in sendBattleStats: ${err.message}`);
  }
}
