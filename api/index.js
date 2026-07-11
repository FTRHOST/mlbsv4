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

// Helper to resolve team names from players' ID and ipos
const resolveTeamNames = async (operatorId, players) => {
  let blueTeamName = "BLUE TEAM";
  let redTeamName = "RED TEAM";
  let blueTeamFound = false;
  let redTeamFound = false;

  if (Array.isArray(players) && players.length > 0) {
    for (const player of players) {
      if (!player.id) continue;
      
      const ipos = Number(player.ipos);
      const isBlue = ipos >= 1 && ipos <= 5;
      const isRed = ipos >= 6 && ipos <= 10;
      
      if ((isBlue && blueTeamFound) || (isRed && redTeamFound)) continue;
      
      if (isBlue || isRed) {
        try {
          const mappingDoc = await db.collection("test").doc("OperatorId").collection(operatorId).doc("config").collection("team_mappings").doc(String(player.id)).get();
          if (mappingDoc.exists) {
            const mappingData = mappingDoc.data();
            if (mappingData.teamName) {
              if (isBlue && !blueTeamFound) {
                blueTeamName = mappingData.teamName;
                blueTeamFound = true;
              } else if (isRed && !redTeamFound) {
                redTeamName = mappingData.teamName;
                redTeamFound = true;
              }
            }
          }
        } catch (e) {
          console.error("Error fetching player team:", e);
        }
      }
      
      if (blueTeamFound && redTeamFound) break;
    }
  }

  return { blueTeamName, redTeamName };
};

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

    // Fetch match setup config
    const setupRef = db.collection("test").doc("OperatorId").collection(operatorId).doc("match_setup");
    const setupDoc = await setupRef.get();
    let setupData = {};
    if (setupDoc.exists) {
      setupData = setupDoc.data();
    }

    // Fetch existing room to preserve scores if not provided in payload
    const docRef = db
      .collection("test")
      .doc("OperatorId")
      .collection(operatorId)
      .doc("iPlayer");

    const doc = await docRef.get();
    let currentData = {};
    if (doc.exists) {
      currentData = doc.data();
    }

    let { blueTeamName, redTeamName } = await resolveTeamNames(operatorId, payload.players);

    // Override with match_setup if provided
    if (setupData.blueTeamName) blueTeamName = setupData.blueTeamName;
    if (setupData.redTeamName) redTeamName = setupData.redTeamName;

    // Determine scores (payload > setupData > currentData > 0)
    const finalBlueScore = payload.blueScore !== undefined ? Number(payload.blueScore) : (setupData.blueScore !== undefined ? setupData.blueScore : (currentData.blueScore || 0));
    const finalRedScore = payload.redScore !== undefined ? Number(payload.redScore) : (setupData.redScore !== undefined ? setupData.redScore : (currentData.redScore || 0));
    const finalBaseOf = payload.baseOf !== undefined ? Number(payload.baseOf) : (setupData.baseOf !== undefined ? setupData.baseOf : (currentData.baseOf || 0));
    const finalMatchPhase = payload.matchPhase !== undefined ? payload.matchPhase : (setupData.matchPhase || "");

    // Sync back to match_setup if payload provided new scores (so dashboard stays updated if hook updates it)
    if (payload.blueScore !== undefined || payload.redScore !== undefined) {
      await setupRef.set({
        blueScore: finalBlueScore,
        redScore: finalRedScore
      }, { merge: true });
    }

    const matchData = {
      operatorId: operatorId,
      players: payload.players || [],
      blueTeamName: blueTeamName,
      redTeamName: redTeamName,
      blueScore: finalBlueScore,
      redScore: finalRedScore,
      baseOf: finalBaseOf,
      matchPhase: finalMatchPhase,
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

    // 2. Write player data in subcollection (docRef already defined above)

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
    let blueTeamName = currentData.blueTeamName || "BLUE TEAM";
    let redTeamName = currentData.redTeamName || "RED TEAM";
    
    if (updates.players) {
      const names = await resolveTeamNames(operatorId, updates.players);
      blueTeamName = names.blueTeamName;
      redTeamName = names.redTeamName;
    }

    const updatedData = {
      ...currentData,
      ...updates,
      blueTeamName: updates.blueTeamName !== undefined ? updates.blueTeamName : blueTeamName,
      redTeamName: updates.redTeamName !== undefined ? updates.redTeamName : redTeamName,
      operatorId: operatorId, // ensure operatorId cannot be overwritten
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (updates.blueScore !== undefined) updatedData.blueScore = Number(updates.blueScore);
    if (updates.redScore !== undefined) updatedData.redScore = Number(updates.redScore);
    if (updates.baseOf !== undefined) updatedData.baseOf = Number(updates.baseOf);

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

// GET all team mappings for an operator
app.get("/api/team-mappings/:operatorId", async (req, res) => {
  try {
    const { operatorId } = req.params;
    const snapshot = await db.collection("test").doc("OperatorId").collection(operatorId).doc("config").collection("team_mappings").get();
    const mappings = [];
    snapshot.forEach(doc => {
      mappings.push({ uid: doc.id, ...doc.data() });
    });
    return res.json({
      status: "success",
      data: mappings
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

// POST to create or update a team mapping for an operator
app.post("/api/team-mappings/:operatorId", authenticate, async (req, res) => {
  try {
    const { operatorId } = req.params;
    const { uid, teamName, playerName } = req.body;
    if (!uid) {
      return res.status(400).json({ status: "error", message: "uid is required" });
    }
    const docRef = db.collection("test").doc("OperatorId").collection(operatorId).doc("config").collection("team_mappings").doc(String(uid));
    const dataToSave = {
      teamName: teamName || "",
      playerName: playerName || "",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await docRef.set(dataToSave, { merge: true });
    return res.json({ status: "success", message: "Mapping saved", data: { uid, ...dataToSave } });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// DELETE a team mapping for an operator
app.delete("/api/team-mappings/:operatorId/:uid", authenticate, async (req, res) => {
  try {
    const { operatorId, uid } = req.params;
    await db.collection("test").doc("OperatorId").collection(operatorId).doc("config").collection("team_mappings").doc(String(uid)).delete();
    return res.json({ status: "success", message: "Mapping deleted" });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// GET match setup for an operator
app.get("/api/match-setup/:operatorId", async (req, res) => {
  try {
    const { operatorId } = req.params;
    const docRef = db.collection("test").doc("OperatorId").collection(operatorId).doc("match_setup");
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.json({ status: "success", data: {} });
    }
    
    return res.json({ status: "success", data: doc.data() });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// POST to create or update match setup for an operator
app.post("/api/match-setup/:operatorId", authenticate, async (req, res) => {
  try {
    const { operatorId } = req.params;
    const updates = req.body;
    
    const docRef = db.collection("test").doc("OperatorId").collection(operatorId).doc("match_setup");
    
    const dataToSave = {
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Ensure numbers are cast correctly if present
    if (dataToSave.blueScore !== undefined) dataToSave.blueScore = Number(dataToSave.blueScore);
    if (dataToSave.redScore !== undefined) dataToSave.redScore = Number(dataToSave.redScore);
    if (dataToSave.baseOf !== undefined) dataToSave.baseOf = Number(dataToSave.baseOf);
    
    await docRef.set(dataToSave, { merge: true });
    
    return res.json({ status: "success", message: "Match setup saved", data: dataToSave });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
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
