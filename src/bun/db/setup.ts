import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { parseAppArgs } from "../lib/args.ts";

const dataDir = parseAppArgs(process.argv).dataDir || resolve(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

const db = new Database(resolve(dataDir, "app_data.sqlite"), { create: true });

db.run("PRAGMA foreign_keys = ON;");

db.run(`
  CREATE TABLE IF NOT EXISTS artists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source TEXT CHECK(source IN ('youtube', 'local')),
    thumbnail TEXT,
    playlistId TEXT
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source TEXT CHECK(source IN ('youtube', 'local')),
    thumbnail TEXT,
    duration INTEGER
  );

  CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source TEXT CHECK(source IN ('youtube', 'local')),
    thumbnail TEXT,
    duration INTEGER,
    releasedDate TEXT
  );

  CREATE TABLE IF NOT EXISTS track_artists (
    track_id TEXT,
    artist_id TEXT,
    FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    PRIMARY KEY (track_id, artist_id)
  );

  CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id TEXT,
    track_id TEXT,
    FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    PRIMARY KEY (playlist_id, track_id)
  );

  CREATE TABLE IF NOT EXISTS user_data (
    key TEXT NOT NULL PRIMARY KEY, 
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS search_cache (
    search_key TEXT NOT NULL PRIMARY KEY,
    data TEXT NOT NULL,
    fetched_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  source TEXT,
  message TEXT
  );
`);
db.run(`CREATE INDEX IF NOT EXISTS idx_log_date ON log(date);`);
const commands = [
  `ALTER TABLE tracks DROP COLUMN etag;`,
  `ALTER TABLE playlists DROP COLUMN etag;`,
  `ALTER TABLE artists DROP COLUMN etag;`,
  `ALTER TABLE track_artists DROP COLUMN artist_name;`,
  `ALTER TABLE tracks DROP COLUMN track_index;`,
  `ALTER TABLE tracks ADD COLUMN fileModifiedAt INTEGER;`,
  `ALTER TABLE tracks ADD COLUMN lastCheckedAt INTEGER;`,
  `ALTER TABLE tracks ADD COLUMN youtubeTrackId TEXT;`,
  `ALTER TABLE artists ADD COLUMN lastFetched INTEGER;`,
  `ALTER TABLE playlists ADD COLUMN lastFetched INTEGER;`,
  `ALTER TABLE artists ADD COLUMN cacheTtl INTEGER;`,
  `ALTER TABLE tracks ADD COLUMN etag TEXT;`,
  `ALTER TABLE playlists ADD COLUMN etag TEXT;`,
  `ALTER TABLE artists ADD COLUMN etag TEXT;`,
  `ALTER TABLE log ADD COLUMN source TEXT;`,
];
for (const sql of commands) {
  try { db.run(sql); } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    try {
      db.run("INSERT INTO log (date, type, message) VALUES (datetime('now', 'localtime'), 'error', ?)", [message]);
    } catch { }
  }
}
db.run(`PRAGMA cache_size = -2000;`);
db.run("PRAGMA shrink_memory;");
db.run("PRAGMA journal_mode = WAL;");

export default db;