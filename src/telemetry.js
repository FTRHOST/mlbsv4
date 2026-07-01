/**
 * Telemetry and Room Data Network Reporter
 */

import { CONFIG, sessionState } from "./config";
import { debugLog } from "./utils";

export function sendToRestApi(payload) {
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

              const urlObj = URL.$new(CONFIG.API_ROOMS_URL);
              const conn = Java.cast(
                urlObj.openConnection(),
                HttpURLConnection,
              );
              conn.setRequestMethod("POST");
              conn.setRequestProperty("Content-Type", "application/json");
              conn.setRequestProperty("x-api-key", CONFIG.API_KEY);
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
                `Data sent to Vercel. Response Code: ${responseCode}`,
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
  send({
    type: "ROOM_DATA",
    payload: payload,
  });
  sendToRestApi(payload);
}
