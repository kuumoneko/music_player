import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, rmSync } from "fs";
import { dirname, resolve } from "path";
import { config } from "dotenv";

config();

const srcPath =
  process.env["KUUMO_SRC_DB"] ||
  resolve(
    process.env["APPDATA"] || resolve(process.env["USERPROFILE"] || ".", "AppData/Roaming"),
    "KuumoApp/app_data.sqlite"
  );
const outPath = resolve(process.cwd(), "tests/fixtures/app_data.sqlite");

if (!existsSync(srcPath)) {
  console.error(`Không tìm thấy DB gốc: ${srcPath}`);
  process.exit(1);
}

mkdirSync(dirname(outPath), { recursive: true });
for (const ext of ["", "-wal", "-shm"]) {
  const p = `${outPath}${ext}`;
  if (existsSync(p)) rmSync(p, { force: true });
}

const src = new Database(srcPath, { readonly: true });
const dst = new Database(outPath);

const blockedKvKeys = new Set([
  "googleUserEmail",
  "googleOAuthTokens",
  "youtubeApiKeys",
  "googleClientId",
  "googleClientSecret",
  "DiscordClientId",
  "recentSearches",
  "playedTrack",
  "homeFeedSections",
]);

try {
  // Tắt foreign_keys tạm thời lúc seed để tránh lệch thứ tự bảng, bật lại khi dùng
  dst.exec("PRAGMA foreign_keys = OFF; BEGIN TRANSACTION;");

  const tables = src
    .query<{ name: string; sql: string | null }, []>(
      `SELECT name, sql FROM sqlite_master
       WHERE type = 'table' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'`
    )
    .all();

  for (const t of tables) {
    dst.exec(`${t.sql};`);
  }

  // 1. Lấy tối đa 5 artists mẫu (ưu tiên có playlistId)
  const artists = src
    .query<Record<string, unknown>, []>(
      `SELECT * FROM artists ORDER BY (playlistId IS NOT NULL) DESC LIMIT 5`
    )
    .all();
  const artistIds = new Set(artists.map((r:any) => String(r.id)));

  // 2. Lấy tối đa 5 playlists mẫu
  const playlists = src
    .query<Record<string, unknown>, []>(`SELECT * FROM playlists LIMIT 5`)
    .all();
  const playlistIds = new Set(playlists.map((r:any) => String(r.id)));

  // 3. Lấy tối đa 10 tracks mẫu
  const tracks = src
    .query<Record<string, unknown>, []>(`SELECT * FROM tracks LIMIT 10`)
    .all();
  const trackIds = new Set(tracks.map((r:any) => String(r.id)));

  const insertRows = (tableName: string, rows: Record<string, any>[]) => {
    if (rows.length === 0) return;
    const cols = Object.keys(rows[0]);
    const quotedCols = cols.map((c) => `"${c}"`).join(", ");
    const placeholders = cols.map(() => "?").join(", ");
    const stmt = dst.prepare(
      `INSERT OR IGNORE INTO "${tableName}" (${quotedCols}) VALUES (${placeholders})`
    );
    for (const row of rows) {
      stmt.run(...cols.map((c) => row[c] ?? null));
    }
  };

  insertRows("artists", artists);
  insertRows("playlists", playlists);
  insertRows("tracks", tracks);

  // 4. Liên kết track_artists và playlist_tracks theo các ID đã giữ lại
  if (tables.some((t) => t.name === "track_artists") && trackIds.size > 0 && artistIds.size > 0) {
    const allTa = src.query<{ track_id: string; artist_id: string }, []>(`SELECT * FROM track_artists`).all();
    const filteredTa = allTa.filter((r:any) => trackIds.has(r.track_id) && artistIds.has(r.artist_id));
    insertRows("track_artists", filteredTa);
  }

  if (tables.some((t) => t.name === "playlist_tracks") && playlistIds.size > 0 && trackIds.size > 0) {
    const allPt = src
      .query<{ playlist_id: string; track_id: string; position: number | null; addedAt: string | null }, []>(
        `SELECT * FROM playlist_tracks`
      )
      .all();
    const filteredPt = allPt.filter((r) => playlistIds.has(r.playlist_id) && trackIds.has(r.track_id));
    insertRows("playlist_tracks", filteredPt);
  }

  // 5. Lọc user_data và system: bỏ key nhạy cảm / phình dữ liệu
  for (const kvTable of ["user_data", "system"] as const) {
    if (!tables.some((t) => t.name === kvTable)) continue;
    const rows = src.query<{ key: string; value: string | null }, []>(`SELECT key, value FROM "${kvTable}"`).all();
    const safeRows = rows.filter((r) => {
      if (blockedKvKeys.has(r.key)) return false;
      if (typeof r.value === "string" && (r.value.startsWith("ENC:") || r.value.includes("AIza"))) {
        return false;
      }
      return true;
    });
    insertRows(kvTable, safeRows);
  }

  // Bảng log và search_cache giữ rỗng (hoặc chỉ để schema) để file fixture siêu nhẹ

  dst.exec("COMMIT; VACUUM;");
  console.log(
    `Done! ${outPath} (${artists.length} artists, ${playlists.length} playlists, ${tracks.length} tracks) have been created.`
  );
} finally {
  src.close();
  dst.close();
}