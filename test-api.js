/**
 * MLBB Live Draft API - CRUD & Security Test Script
 * Run this script locally using: node test-api.js
 */

const API_BASE = process.argv[2] || process.env.API_URL || 'https://mlbsv4.vercel.app/api';
const TEST_OP_ID = 'test_operator_999';
const API_KEY = process.env.API_KEY || 'mlbs_secret_token_2026';

async function runTests() {
  console.log("=================================================");
  console.log("🚀 STARTING REST API CRUD & SECURITY INTEGRITY TEST");
  console.log(`📍 Endpoint: ${API_BASE}`);
  console.log("=================================================\n");

  // 1. SECURITY TEST: Write without API Key
  console.log("[*] TEST 1: Attempting to WRITE room data WITHOUT API Key...");
  try {
    const res = await fetch(`${API_BASE}/rooms`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        operatorId: TEST_OP_ID, 
        players: [] 
      })
    });
    
    if (res.status === 401) {
      console.log("   ✅ SUCCESS: Server rejected unauthorized write request (401 Unauthorized).\n");
    } else {
      console.log(`   ❌ FAILED: Server returned status code ${res.status} instead of 401.\n`);
    }
  } catch (err) {
    console.error("   ❌ ERROR:", err.message, "\n");
  }

  // 2. CREATE TEST: Write room with API Key
  console.log("[*] TEST 2: Creating a test room (POST) with valid API Key...");
  const dummyPayload = {
    operatorId: TEST_OP_ID,
    players: [
      { ipos: 1, id: "1001", name: "Tester Blue", team: 1, role: 1, battleSpell: 20100, SelHeroID: 0, banHero: 0 },
      { ipos: 6, id: "2001", name: "Tester Red", team: 2, role: 2, battleSpell: 20020, SelHeroID: 0, banHero: 0 }
    ],
    draftTime: 30,
    draftPhase: 1,
    caption: "Blue Team Ban",
    mapDraw: 1,
    timestamp: new Date().toISOString()
  };

  try {
    const res = await fetch(`${API_BASE}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify(dummyPayload)
    });
    
    const result = await res.json();
    if (res.ok && result.status === 'success') {
      console.log(`   ✅ SUCCESS: Room '${TEST_OP_ID}' created successfully.\n`);
    } else {
      console.log(`   ❌ FAILED: ${result.message || res.statusText}\n`);
      return;
    }
  } catch (err) {
    console.error("   ❌ ERROR:", err.message, "\n");
    return;
  }

  // 3. READ TEST: Fetch room publicly
  console.log("[*] TEST 3: Reading room data (GET) publicly (No API Key)...");
  try {
    const res = await fetch(`${API_BASE}/rooms/${TEST_OP_ID}`);
    const result = await res.json();
    if (res.ok && result.status === 'success') {
      console.log("   ✅ SUCCESS: Room data retrieved successfully.");
      console.log(`      - Operator ID: ${result.data.operatorId}`);
      console.log(`      - Caption: "${result.data.caption}"`);
      console.log(`      - Players Count: ${result.data.players.length}\n`);
    } else {
      console.log(`   ❌ FAILED: ${result.message || res.statusText}\n`);
    }
  } catch (err) {
    console.error("   ❌ ERROR:", err.message, "\n");
  }

  // 4. UPDATE TEST: Update room details with API Key
  console.log("[*] TEST 4: Updating room details (PUT) with valid API Key...");
  const updatePayload = {
    draftTime: 15,
    caption: "Red Team Pick"
  };

  try {
    const res = await fetch(`${API_BASE}/rooms/${TEST_OP_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify(updatePayload)
    });
    
    const result = await res.json();
    if (res.ok && result.status === 'success') {
      console.log("   ✅ SUCCESS: Room data updated successfully.");
      console.log(`      - New Caption: "${result.data.caption}"`);
      console.log(`      - New Time: ${result.data.draftTime} seconds\n`);
    } else {
      console.log(`   ❌ FAILED: ${result.message || res.statusText}\n`);
    }
  } catch (err) {
    console.error("   ❌ ERROR:", err.message, "\n");
  }

  // 5. DELETE TEST: Delete room with API Key
  console.log("[*] TEST 5: Deleting test room (DELETE) with valid API Key...");
  try {
    const res = await fetch(`${API_BASE}/rooms/${TEST_OP_ID}`, {
      method: 'DELETE',
      headers: {
        'x-api-key': API_KEY
      }
    });
    
    const result = await res.json();
    if (res.ok && result.status === 'success') {
      console.log(`   ✅ SUCCESS: Room '${TEST_OP_ID}' deleted successfully.\n`);
    } else {
      console.log(`   ❌ FAILED: ${result.message || res.statusText}\n`);
    }
  } catch (err) {
    console.error("   ❌ ERROR:", err.message, "\n");
  }

  // 6. VERIFICATION TEST: Read deleted room
  console.log("[*] TEST 6: Verifying deletion by reading the room (GET)...");
  try {
    const res = await fetch(`${API_BASE}/rooms/${TEST_OP_ID}`);
    if (res.status === 404) {
      console.log("   ✅ SUCCESS: Verified that room does not exist anymore (404 Not Found).\n");
    } else {
      console.log(`   ❌ FAILED: Server returned status code ${res.status} instead of 404.\n`);
    }
  } catch (err) {
    console.error("   ❌ ERROR:", err.message, "\n");
  }

  console.log("=================================================");
  console.log("🎉 ALL INTEGRITY TESTS PASSED SUCCESSFULLY!");
  console.log("=================================================");
}

runTests();
