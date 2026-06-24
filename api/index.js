const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("[+] Firebase Admin SDK initialized using Environment Variable.");
    } catch (e) {
      console.error("[-] Failed to initialize Firebase Admin via Environment Variable:", e.message);
    }
  } else {
    // Look for serviceAccountKey.json in the project root
    const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
    if (fs.existsSync(keyPath)) {
      const serviceAccount = require(keyPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("[+] Firebase Admin SDK initialized using serviceAccountKey.json.");
    } else {
      // Fallback to default
      admin.initializeApp();
      console.log("[+] Firebase Admin SDK initialized using default credentials.");
    }
  }
}

const db = admin.firestore();

// Initialize Express App
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// API Key configuration (default fallback if process.env.API_KEY is not defined)
const API_KEY = process.env.API_KEY || "mlbs_secret_token_2026";

// Security Middleware for Write Operations
const authenticate = (req, res, next) => {
  const key = req.headers["x-api-key"] || req.query.apiKey;
  if (key && key === API_KEY) {
    return next();
  }
  return res.status(401).json({
    status: "error",
    message: "Unauthorized: Invalid or missing API Key"
  });
};

// Root endpoint test
app.get("/api", (req, res) => {
  res.json({
    status: "success",
    message: "MLBB Live Draft REST API is active"
  });
});

// GET all rooms
app.get("/api/rooms", async (req, res) => {
  try {
    const parentDocRef = db.collection("test").doc("OperatorId");
    const collections = await parentDocRef.listCollections();
    const rooms = [];

    for (const col of collections) {
      const doc = await col.doc("iPlayer").get();
      if (doc.exists) {
        rooms.push(doc.data());
      }
    }

    return res.json({
      status: "success",
      count: rooms.length,
      data: rooms
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

// GET single room by operatorId
app.get("/api/rooms/:operatorId", async (req, res) => {
  try {
    const { operatorId } = req.params;
    const docRef = db
      .collection("test")
      .doc("OperatorId")
      .collection(operatorId)
      .doc("iPlayer");
    
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({
        status: "error",
        message: `Room with Operator ID ${operatorId} not found`
      });
    }

    return res.json({
      status: "success",
      data: doc.data()
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

// POST to create or update room
app.post("/api/rooms", authenticate, async (req, res) => {
  try {
    const payload = req.body;
    const operatorId = payload.operatorId ? String(payload.operatorId).trim() : "";

    if (!operatorId) {
      return res.status(400).json({
        status: "error",
        message: "operatorId is required in payload"
      });
    }

    const matchData = {
      operatorId: operatorId,
      players: payload.players || [],
      draftTime: payload.draftTime !== undefined ? Number(payload.draftTime) : 0,
      draftPhase: payload.draftPhase !== undefined ? Number(payload.draftPhase) : 0,
      caption: payload.caption || "",
      mapDraw: payload.mapDraw !== undefined && payload.mapDraw !== null ? Number(payload.mapDraw) : 0,
      agentTimestamp: payload.timestamp || new Date().toISOString(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // 1. Write parent doc to activate it in Firebase Console
    await db.collection("test").doc("OperatorId").set({
      last_active: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // 2. Write player data in subcollection
    const docRef = db
      .collection("test")
      .doc("OperatorId")
      .collection(operatorId)
      .doc("iPlayer");

    await docRef.set(matchData);

    return res.status(200).json({
      status: "success",
      message: "Room data saved successfully",
      data: matchData
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

// PUT to partially update room
app.put("/api/rooms/:operatorId", authenticate, async (req, res) => {
  try {
    const { operatorId } = req.params;
    const updates = req.body;

    const docRef = db
      .collection("test")
      .doc("OperatorId")
      .collection(operatorId)
      .doc("iPlayer");

    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({
        status: "error",
        message: `Room with Operator ID ${operatorId} not found`
      });
    }

    const currentData = doc.data();

    // Merge updates
    const updatedData = {
      ...currentData,
      ...updates,
      operatorId: operatorId, // ensure operatorId cannot be overwritten
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await docRef.set(updatedData);

    return res.json({
      status: "success",
      message: "Room data updated successfully",
      data: updatedData
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

// DELETE a room
app.delete("/api/rooms/:operatorId", authenticate, async (req, res) => {
  try {
    const { operatorId } = req.params;
    const docRef = db
      .collection("test")
      .doc("OperatorId")
      .collection(operatorId)
      .doc("iPlayer");

    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({
        status: "error",
        message: `Room with Operator ID ${operatorId} not found`
      });
    }

    await docRef.delete();

    return res.json({
      status: "success",
      message: `Room with Operator ID ${operatorId} deleted successfully`
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

// GET user info by uid
app.get("/api/users/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    if (!uid || uid === "0") {
      return res.status(400).json({
        status: "error",
        message: "Invalid uid provided"
      });
    }

    const docRef = db.collection("users").doc(uid);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        status: "error",
        message: `User with ID ${uid} not found`
      });
    }

    return res.json({
      status: "success",
      data: {
        uid: doc.id,
        ...doc.data()
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

// POST to create or update user info (e.g. record last login, set default fields)
app.post("/api/users", authenticate, async (req, res) => {
  try {
    const { uid, m_uiID, last_login } = req.body;
    if (!uid || uid === "0") {
      return res.status(400).json({
        status: "error",
        message: "uid (Android ID) is required in payload"
      });
    }

    const docRef = db.collection("users").doc(uid);
    const doc = await docRef.get();

    let userData = {};
    if (doc.exists) {
      userData = {
        ...doc.data(),
        last_login: last_login || new Date().toISOString()
      };
      if (m_uiID && m_uiID !== "0") {
        userData.m_uiID = m_uiID;
      }
    } else {
      userData = {
        created_at: new Date().toISOString(),
        expired: "NEVER",
        is_allowed: true,
        last_login: last_login || new Date().toISOString(),
        role: "user",
        ban: false,
        m_uiID: m_uiID || ""
      };
    }

    await docRef.set(userData, { merge: true });

    return res.json({
      status: "success",
      message: "User information updated successfully",
      data: userData
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});


// Catch-all fallback route for debugging 404 errors
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: `Route not found on Express: ${req.method} ${req.url}`,
    debug: {
      method: req.method,
      url: req.url,
      path: req.path,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl
    }
  });
});

module.exports = app;
