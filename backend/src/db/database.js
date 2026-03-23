const Database = require('better-sqlite3') //the database tool 
const path = require('path') // built into Node, helps with file paths
const fs = require('fs') //built into Node, lets you create/read/delete files

// get the path from .env or use default
const DB_PATH = process.env.DB_PATH || './data/recruiter.db' //process.env.DB_PATH reads from your .env file

// create the data folder if it doesn't exist
const dir = path.dirname(DB_PATH)
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
}

const db = new Database(DB_PATH) //either opens the existing `.db` file or creates a brand new one.
db.pragma('journal_mode = WAL') //`WAL` → makes reading and writing faster
db.pragma('foreign_keys = ON') //if a profile belongs to a user, you can't delete that user without deleting the profile first. Keeps data clean.

db.exec(`

    CREATE TABLE IF NOT EXISTS users (
        id          TEXT PRIMARY KEY,
        email       TEXT UNIQUE NOT NULL,
        password    TEXT NOT NULL,
        role        TEXT NOT NULL,
        name        TEXT NOT NULL,
        created_at  TEXT DEFAULT (datetime('now'))        
    );

    CREATE TABLE IF NOT EXISTS profiles (
        id TEXT         PRIMARY KEY,
        user_id         TEXT UNIQUE NOT NULL REFERENCES users(id),
        headline        TEXT,
        summary         TEXT,
        location        TEXT,
        completion_pct  INTEGER DEFAULT 0,
        share_token     TEXT UNIQUE,
        created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS experience (
        id          TEXT PRIMARY KEY,
        profile_id  TEXT NOT NULL REFERENCES profiles(id),
        role        TEXT NOT NULL,
        company     TEXT NOT NULL,
        duration    TEXT,
        description TEXT,
        skills      TEXT DEFAULT '[]',
        created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS skills (
        id          TEXT PRIMARY KEY,
        profile_id  TEXT NOT NULL REFERENCES profiles(id),
        name        TEXT NOT NULL,
        level       TEXT,
        category    TEXT
    );

    CREATE TABLE IF NOT EXISTS projects (
        id          TEXT PRIMARY KEY,
        profile_id  TEXT NOT NULL REFERENCES profiles(id),
        title       TEXT NOT NULL,
        description TEXT,
        tech_stack  TEXT DEFAULT '[]',
        link        TEXT,
        created_at  TEXT DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS education (
        id          TEXT PRIMARY KEY,
        profile_id  TEXT NOT NULL REFERENCES profiles(id),
        institution TEXT NOT NULL,
        degree      TEXT,
        field       TEXT,
        start_year  TEXT,
        end_year    TEXT,
        grade       TEXT
    );

    CREATE TABLE IF NOT EXISTS shortlists (
        id            TEXT PRIMARY KEY,
        recruiter_id  TEXT NOT NULL REFERENCES users(id),
        candidate_id  TEXT NOT NULL REFERENCES users(id),
        status        TEXT DEFAULT 'shortlisted',
        notes         TEXT,
        created_at    TEXT DEFAULT (datetime('now')),
        UNIQUE(recruiter_id, candidate_id)
    );

    CREATE TABLE IF NOT EXISTS ai_sessions (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id),
        messages    TEXT DEFAULT '[]',
        created_at  TEXT DEFAULT (datetime('now'))
    );
`)

console.log('✅ Database ready')

module.exports = db