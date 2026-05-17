import db from "../setup.ts"
import type { Track } from "../../../shared/types.ts";
import writeLogs from "../log/write.ts";

const upsertLocalTrackStmt = db.prepare(`
  INSERT INTO tracks (
    id, name, source, thumbnail, duration, 
    releasedDate
  )
  VALUES (
    $id, $name, 'local', $thumbnail, $duration,
    $releasedDate
  )
  ON CONFLICT(id) DO UPDATE SET 
    name = excluded.name,
    thumbnail = excluded.thumbnail,
    duration = excluded.duration;
`);

const insertArtistStmt = db.prepare(`
  INSERT OR IGNORE INTO track_artists (track_id, artist_id, artist_name) 
  VALUES (?, ?, ?);
`);

const writeLocalFile = db.transaction((file: Track) => {
  if (file.source !== "local") {
    writeLogs([{ type: "info", message: `Warning: Track ${file.name} passed to writeLocalFile but had source '${file.source}'. Overriding to 'local'.` }])
    console.warn(`Warning: Track ${file.name} passed to writeLocalFile but had source '${file.source}'. Overriding to 'local'.`);
  }

  const result = upsertLocalTrackStmt.run({
    $id: file.id,
    // $etag: file.etag || null,
    $name: file.name,
    $thumbnail: file.thumbnail,
    $duration: file.duration,
    $releasedDate: file.releasedDate,
    // $index: file.index || null,
  });

  if (result.changes > 0) {
    for (const artist of file.artist) {
      insertArtistStmt.run(file.id, artist.id, artist.name);
    }
  }
});

const writeLocalFiles = db.transaction((files: Track[]) => {
  for (const file of files) {
    writeLocalFile(file);
  }
});

export default writeLocalFiles