const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function setup() {
  await client.connect();
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      uid VARCHAR PRIMARY KEY,
      m_uiid VARCHAR,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      expired VARCHAR DEFAULT 'NEVER',
      is_allowed BOOLEAN DEFAULT true,
      role VARCHAR DEFAULT 'user',
      ban BOOLEAN DEFAULT false,
      last_login TIMESTAMP WITH TIME ZONE
    );

    CREATE TABLE IF NOT EXISTS rooms (
      operator_id VARCHAR PRIMARY KEY,
      players JSONB DEFAULT '[]'::jsonb,
      blue_team_name VARCHAR DEFAULT 'BLUE TEAM',
      red_team_name VARCHAR DEFAULT 'RED TEAM',
      blue_score INT DEFAULT 0,
      red_score INT DEFAULT 0,
      base_of INT DEFAULT 0,
      match_phase VARCHAR DEFAULT '',
      draft_time INT DEFAULT 0,
      draft_phase INT DEFAULT 0,
      caption VARCHAR DEFAULT '',
      map_draw INT DEFAULT 0,
      battle JSONB,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS team_mappings (
      operator_id VARCHAR,
      uid VARCHAR,
      team_name VARCHAR,
      player_name VARCHAR,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (operator_id, uid)
    );

    CREATE TABLE IF NOT EXISTS match_setup (
      operator_id VARCHAR PRIMARY KEY,
      blue_team_name VARCHAR,
      red_team_name VARCHAR,
      blue_score INT,
      red_score INT,
      base_of INT,
      match_phase VARCHAR,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS stats (
      operator_id VARCHAR,
      timestamp BIGINT,
      data JSONB,
      saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (operator_id, timestamp)
    );
  `);
  
  console.log("Tables created successfully");
  await client.end();
}

setup().catch(console.error);
