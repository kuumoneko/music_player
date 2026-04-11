import { Database } from "bun:sqlite";
import { Utils } from "electrobun";
import { resolve } from "node:path";

const userData = resolve(Utils.paths.userData, "..");

const db = new Database(resolve(userData, "app_data.sqlite"), { create: true });

db.run("PRAGMA foreign_keys = ON;");

db.run(`
  CREATE TABLE IF NOT EXISTS artists (
    id TEXT PRIMARY KEY,
    etag TEXT,
    name TEXT NOT NULL,
    source TEXT CHECK(source IN ('youtube', 'local')),
    thumbnail TEXT,
    playlistId TEXT
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    etag TEXT,
    name TEXT NOT NULL,
    source TEXT CHECK(source IN ('youtube', 'local')),
    thumbnail TEXT,
    duration INTEGER
  );

  CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    etag TEXT,
    name TEXT NOT NULL,
    source TEXT CHECK(source IN ('youtube', 'local')),
    thumbnail TEXT,
    duration INTEGER,
    releasedDate TEXT,
    track_index INTEGER
  );

  CREATE TABLE IF NOT EXISTS track_artists (
    track_id TEXT,
    artist_id TEXT,
    artist_name TEXT, 
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

  CREATE TABLE IF NOT EXISTS log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT
  );
`);

db.run(`CREATE INDEX IF NOT EXISTS idx_log_date ON log(date);`);
db.run(`PRAGMA cache_size = -2000;`);
db.run("PRAGMA shrink_memory;");
export default db;