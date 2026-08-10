import db from "../setup.ts"
import { MusicSource, type Track } from "../../../shared/types.ts";
import writeLogs from "../log/write.ts";

const upsertLocalTrackStmt = db.prepare(`
  INSERT INTO tracks (
    id, name, source, thumbnail, duration, 
    releasedDate, fileModifiedAt
  )
  VALUES (
    $id, $name, 'local', $thumbnail, $duration,
    $releasedDate, $fileModifiedAt
  )
  ON CONFLICT(id) DO UPDATE SET 
    name = excluded.name,
    thumbnail = excluded.thumbnail,
    duration = excluded.duration,
    releasedDate = excluded.releasedDate,
    fileModifiedAt = excluded.fileModifiedAt;
`);

const deleteArtistsStmt = db.prepare(`DELETE FROM track_artists WHERE track_id = ?;`);
const insertArtistStmt = db.prepare(`
  INSERT INTO track_artists (track_id, artist_id) 
  VALUES (?, ?)
  ON CONFLICT (track_id,artist_id) DO NOTHING;
`);

const writeLocalFile = db.transaction((file: any) => {
  if (file.source !== MusicSource.Local) {
    writeLogs([{ type: "info", message: `Warning: Track ${file.name} passed to writeLocalFile but had source '${file.source}'. Skipping...` }])
    return;
  }

  upsertLocalTrackStmt.run({
    $id: file.id ?? "",
    $name: file.name ?? "",
    $thumbnail: file.thumbnail ?? "",
    $duration: file.duration ?? 0,
    $releasedDate: file.releasedDate ?? "",
    $fileModifiedAt: file.fileModifiedAt ?? null,
  });

  deleteArtistsStmt.run(file.id);
  for (const artist of file.artist) {
    insertArtistStmt.run(file.id, artist.id);
  }
});

const writeLocalFiles = db.transaction((files: Track[]) => {
  for (const file of files) {
    writeLocalFile({
      ...file,
      fileModifiedAt: file.fileModifiedAt !== undefined ? Math.floor(file.fileModifiedAt) : undefined,
      name: String(file.name ?? "")
    });
  }
});

export default writeLocalFiles