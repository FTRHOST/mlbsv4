const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

// Make WebSocket available globally for Supabase realtime under Node 20
if (!globalThis.WebSocket) {
  globalThis.WebSocket = require("ws");
}

const path = require("path");
const fs = require("fs");

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Need service role to bypass RLS in the API

if (!supabaseUrl || !supabaseKey) {
  console.error("[-] Missing Supabase credentials in environment variables.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Express App
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// API Key configuration (default fallback if process.env.API_KEY is not defined)
const API_KEY = process.env.API_KEY || "";

// Helper to resolve team names from players' ID and ipos
const resolveTeamNames = async (operatorId, players) => {
  let blueTeamName = "BLUE TEAM";
  let redTeamName = "RED TEAM";
  let blueTeamFound = false;
  let redTeamFound = false;

  if (Array.isArray(players) && players.length > 0) {
    const fetchPromises = [];
    for (const player of players) {
      if (!player.id) continue;
      
      const ipos = Number(player.ipos);
      const isBlue = ipos >= 1 && ipos <= 5;
      const isRed = ipos >= 6 && ipos <= 10;
      
      if (isBlue || isRed) {
        const promise = supabase
          .from("team_mappings")
          .select("team_name")
          .eq("operator_id", operatorId)
          .eq("uid", String(player.id))
          .single()
          .then(({ data, error }) => {
            if (error) return null;
            return { isBlue, isRed, data };
          })
          .catch(e => {
            console.error("Error fetching player team:", e);
            return null;
          });
        fetchPromises.push(promise);
      }
    }

    const results = await Promise.all(fetchPromises);
    for (const res of results) {
      if (res && res.data) {
        if (res.data.team_name) {
          if (res.isBlue && !blueTeamFound) {
            blueTeamName = res.data.team_name;
            blueTeamFound = true;
          } else if (res.isRed && !redTeamFound) {
            redTeamName = res.data.team_name;
            redTeamFound = true;
          }
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
    message: "MLBB Live Draft REST API is active (Supabase)"
  });
});

// GET all rooms
app.get("/api/rooms", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("rooms")
      .select("operator_id, players, blue_team_name, red_team_name, blue_score, red_score, base_of, match_phase, draft_time, draft_phase, caption, map_draw, battle, updated_at");
      
    if (error) throw error;

    const rooms = data || [];

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
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("operator_id", operatorId)
      .single();
      
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          status: "error",
          message: `Room with Operator ID ${operatorId} not found`
        });
      }
      throw error;
    }

    // Convert snake_case to camelCase for backwards compatibility
    const responseData = {
      operatorId: data.operator_id,
      players: data.players,
      blueTeamName: data.blue_team_name,
      redTeamName: data.red_team_name,
      blueScore: data.blue_score,
      redScore: data.red_score,
      baseOf: data.base_of,
      matchPhase: data.match_phase,
      draftTime: data.draft_time,
      draftPhase: data.draft_phase,
      caption: data.caption,
      mapDraw: data.map_draw,
      Battle: data.battle,
      updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : Date.now()
    };

    return res.json({
      status: "success",
      data: responseData
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
    const { data: setupDoc } = await supabase
      .from("match_setup")
      .select("*")
      .eq("operator_id", operatorId)
      .single();
      
    let setupData = setupDoc || {};

    // Fetch existing room
    const { data: snapshot } = await supabase
      .from("rooms")
      .select("*")
      .eq("operator_id", operatorId)
      .single();
      
    let currentData = snapshot || {};

    let { blueTeamName, redTeamName } = await resolveTeamNames(operatorId, payload.players);

    // Override with match_setup if provided
    if (setupData.blue_team_name) blueTeamName = setupData.blue_team_name;
    if (setupData.red_team_name) redTeamName = setupData.red_team_name;

    // Determine scores (payload > setupData > currentData > 0)
    const finalBlueScore = payload.blueScore !== undefined ? Number(payload.blueScore) : (setupData.blue_score !== undefined ? setupData.blue_score : (currentData.blue_score || 0));
    const finalRedScore = payload.redScore !== undefined ? Number(payload.redScore) : (setupData.red_score !== undefined ? setupData.red_score : (currentData.red_score || 0));
    const finalBaseOf = payload.baseOf !== undefined ? Number(payload.baseOf) : (setupData.base_of !== undefined ? setupData.base_of : (currentData.base_of || 0));
    const finalMatchPhase = payload.matchPhase !== undefined ? payload.matchPhase : (setupData.match_phase || "");

    // Sync back to match_setup if payload provided new scores (so dashboard stays updated if hook updates it)
    if (payload.blueScore !== undefined || payload.redScore !== undefined) {
      await supabase.from("match_setup").upsert({
        operator_id: operatorId,
        blue_score: finalBlueScore,
        red_score: finalRedScore,
        updated_at: new Date().toISOString()
      }, { onConflict: 'operator_id' });
    }

    const matchData = {
      operator_id: operatorId,
      players: payload.players || [],
      blue_team_name: blueTeamName,
      red_team_name: redTeamName,
      blue_score: finalBlueScore,
      red_score: finalRedScore,
      base_of: finalBaseOf,
      match_phase: finalMatchPhase,
      draft_time: payload.draftTime !== undefined ? Number(payload.draftTime) : 0,
      draft_phase: payload.draftPhase !== undefined ? Number(payload.draftPhase) : 0,
      caption: payload.caption || "",
      map_draw: payload.mapDraw !== undefined && payload.mapDraw !== null ? Number(payload.mapDraw) : 0,
      battle: payload.Battle || null,
      updated_at: new Date().toISOString()
    };

    // 2. Write player data
    const { error: upsertError } = await supabase.from("rooms").upsert(matchData, { onConflict: 'operator_id' });
    if (upsertError) throw upsertError;

    // Return in format expected by clients
    const responseData = {
      ...payload,
      operatorId: matchData.operator_id,
      blueTeamName: matchData.blue_team_name,
      redTeamName: matchData.red_team_name,
      blueScore: matchData.blue_score,
      redScore: matchData.red_score,
      baseOf: matchData.base_of,
      matchPhase: matchData.match_phase,
      draftTime: matchData.draft_time,
      draftPhase: matchData.draft_phase,
      mapDraw: matchData.map_draw,
      Battle: matchData.battle,
      updatedAt: new Date(matchData.updated_at).getTime()
    };

    return res.status(200).json({
      status: "success",
      message: "Room data saved successfully",
      data: responseData
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

    const { data: currentData, error: fetchError } = await supabase
      .from("rooms")
      .select("*")
      .eq("operator_id", operatorId)
      .single();
      
    if (fetchError || !currentData) {
      return res.status(404).json({
        status: "error",
        message: `Room with Operator ID ${operatorId} not found`
      });
    }

    // Merge updates
    let blueTeamName = currentData.blue_team_name || "BLUE TEAM";
    let redTeamName = currentData.red_team_name || "RED TEAM";
    
    if (updates.players) {
      const names = await resolveTeamNames(operatorId, updates.players);
      blueTeamName = names.blueTeamName;
      redTeamName = names.redTeamName;
    }

    const updatedData = {
      blue_team_name: updates.blueTeamName !== undefined ? updates.blueTeamName : blueTeamName,
      red_team_name: updates.redTeamName !== undefined ? updates.redTeamName : redTeamName,
      updated_at: new Date().toISOString()
    };

    if (updates.players !== undefined) updatedData.players = updates.players;
    if (updates.blueScore !== undefined) updatedData.blue_score = Number(updates.blueScore);
    if (updates.redScore !== undefined) updatedData.red_score = Number(updates.redScore);
    if (updates.baseOf !== undefined) updatedData.base_of = Number(updates.baseOf);
    if (updates.Battle !== undefined) updatedData.battle = updates.Battle;
    if (updates.matchPhase !== undefined) updatedData.match_phase = updates.matchPhase;
    if (updates.caption !== undefined) updatedData.caption = updates.caption;
    if (updates.draftTime !== undefined) updatedData.draft_time = Number(updates.draftTime);
    if (updates.draftPhase !== undefined) updatedData.draft_phase = Number(updates.draftPhase);
    if (updates.mapDraw !== undefined) updatedData.map_draw = Number(updates.mapDraw);

    const { error: updateError } = await supabase
      .from("rooms")
      .update(updatedData)
      .eq("operator_id", operatorId);

    if (updateError) throw updateError;

    const finalData = { ...currentData, ...updatedData };
    const responseData = {
      operatorId: finalData.operator_id,
      players: finalData.players,
      blueTeamName: finalData.blue_team_name,
      redTeamName: finalData.red_team_name,
      blueScore: finalData.blue_score,
      redScore: finalData.red_score,
      baseOf: finalData.base_of,
      matchPhase: finalData.match_phase,
      draftTime: finalData.draft_time,
      draftPhase: finalData.draft_phase,
      caption: finalData.caption,
      mapDraw: finalData.map_draw,
      Battle: finalData.battle,
      updatedAt: finalData.updated_at ? new Date(finalData.updated_at).getTime() : Date.now()
    };

    return res.json({
      status: "success",
      message: "Room data updated successfully",
      data: responseData
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
    
    const { error } = await supabase
      .from("rooms")
      .delete()
      .eq("operator_id", operatorId);

    if (error) throw error;

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

    const { data: doc, error } = await supabase
      .from("users")
      .select("*")
      .eq("uid", uid)
      .single();

    if (error || !doc) {
      return res.status(404).json({
        status: "error",
        message: `User with ID ${uid} not found`
      });
    }

    return res.json({
      status: "success",
      data: {
        uid: doc.uid,
        m_uiID: doc.m_uiid,
        created_at: doc.created_at,
        expired: doc.expired,
        is_allowed: doc.is_allowed,
        role: doc.role,
        ban: doc.ban,
        branch: doc.branch || "production",
        last_login: doc.last_login
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

// POST to create or update user info
app.post("/api/users", authenticate, async (req, res) => {
  try {
    const { uid, m_uiID, last_login, branch } = req.body;
    if (!uid || uid === "0") {
      return res.status(400).json({
        status: "error",
        message: "uid (Android ID) is required in payload"
      });
    }

    const currentLogin = last_login || new Date().toISOString();

    const { data: doc } = await supabase
      .from("users")
      .select("*")
      .eq("uid", uid)
      .single();

    let userData = {};

    if (doc) {
      userData = {
        last_login: currentLogin
      };
      if (m_uiID && m_uiID !== "0" && doc.m_uiid !== m_uiID) {
        userData.m_uiid = m_uiID;
      }
      if (branch) {
        userData.branch = branch;
      }
      
      const { error: updateError } = await supabase
        .from("users")
        .update(userData)
        .eq("uid", uid);
        
      if (updateError) throw updateError;
      
      userData = { ...doc, ...userData };
    } else {
      userData = {
        uid: uid,
        m_uiid: m_uiID || "",
        created_at: new Date().toISOString(),
        expired: "NEVER",
        is_allowed: true,
        role: "user",
        ban: false,
        branch: branch || "production",
        last_login: currentLogin
      };
      
      const { error: insertError } = await supabase
        .from("users")
        .insert(userData);
        
      if (insertError) throw insertError;
    }

    return res.json({
      status: "success",
      message: "User information updated successfully",
      data: {
        uid: userData.uid,
        m_uiID: userData.m_uiid || userData.m_uiID,
        created_at: userData.created_at,
        expired: userData.expired,
        is_allowed: userData.is_allowed,
        role: userData.role,
        ban: userData.ban,
        branch: userData.branch,
        last_login: userData.last_login
      }
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
    const { data, error } = await supabase
      .from("team_mappings")
      .select("*")
      .eq("operator_id", operatorId);
      
    if (error) throw error;
    
    const mappings = (data || []).map(doc => ({
      uid: doc.uid,
      teamName: doc.team_name,
      playerName: doc.player_name,
      updatedAt: doc.updated_at
    }));

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
    
    const dataToSave = {
      operator_id: operatorId,
      uid: String(uid),
      team_name: teamName || "",
      player_name: playerName || "",
      updated_at: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from("team_mappings")
      .upsert(dataToSave, { onConflict: 'operator_id,uid' });
      
    if (error) throw error;
    
    return res.json({ status: "success", message: "Mapping saved", data: { uid, teamName: dataToSave.team_name, playerName: dataToSave.player_name } });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// DELETE a team mapping for an operator
app.delete("/api/team-mappings/:operatorId/:uid", authenticate, async (req, res) => {
  try {
    const { operatorId, uid } = req.params;
    const { error } = await supabase
      .from("team_mappings")
      .delete()
      .eq("operator_id", operatorId)
      .eq("uid", String(uid));
      
    if (error) throw error;
    
    return res.json({ status: "success", message: "Mapping deleted" });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// GET match setup for an operator
app.get("/api/match-setup/:operatorId", async (req, res) => {
  try {
    const { operatorId } = req.params;
    const { data, error } = await supabase
      .from("match_setup")
      .select("*")
      .eq("operator_id", operatorId)
      .single();
    
    if (error || !data) {
      return res.json({ status: "success", data: {} });
    }
    
    return res.json({ status: "success", data: {
      blueTeamName: data.blue_team_name,
      redTeamName: data.red_team_name,
      blueScore: data.blue_score,
      redScore: data.red_score,
      baseOf: data.base_of,
      matchPhase: data.match_phase
    } });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// POST to create or update match setup for an operator
app.post("/api/match-setup/:operatorId", authenticate, async (req, res) => {
  try {
    const { operatorId } = req.params;
    const updates = req.body;
    
    const dataToSave = {
      operator_id: operatorId,
      updated_at: new Date().toISOString()
    };
    
    if (updates.blueTeamName !== undefined) dataToSave.blue_team_name = updates.blueTeamName;
    if (updates.redTeamName !== undefined) dataToSave.red_team_name = updates.redTeamName;
    if (updates.blueScore !== undefined) dataToSave.blue_score = Number(updates.blueScore);
    if (updates.redScore !== undefined) dataToSave.red_score = Number(updates.redScore);
    if (updates.baseOf !== undefined) dataToSave.base_of = Number(updates.baseOf);
    if (updates.matchPhase !== undefined) dataToSave.match_phase = updates.matchPhase;
    
    const { error } = await supabase
      .from("match_setup")
      .upsert(dataToSave, { onConflict: 'operator_id' });
      
    if (error) throw error;
    
    return res.json({ status: "success", message: "Match setup saved", data: updates });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

// POST to save battle stats
app.post("/api/stats/:operatorId", authenticate, async (req, res) => {
  try {
    const { operatorId } = req.params;
    const statsData = req.body;
    const timestamp = Date.now();
    
    console.log(`[+] Received stats for operatorId: ${operatorId}`);
    
    const { error } = await supabase
      .from("stats")
      .insert({
        operator_id: operatorId,
        timestamp: timestamp,
        data: statsData,
        saved_at: new Date().toISOString()
      });
      
    if (error) throw error;
    
    console.log(`[+] Stats successfully written to Supabase for ${operatorId}`);
    
    return res.json({ status: "success", message: "Stats saved", timestamp });
  } catch (error) {
    console.error(`[-] Error writing stats to Supabase: ${error.message}`);
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
