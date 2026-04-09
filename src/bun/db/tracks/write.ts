import db from "../setup.ts"
import type { Track } from "../../../shared/types.ts";

const upsertTrackStmt = db.prepare(`
  INSERT INTO tracks (
    id, etag, name, source, thumbnail, duration, 
    releasedDate,  track_index
  )
  VALUES (
    $id, $etag, $name, $source, $thumbnail, $duration, 
    $releasedDate,  $index
  )
  ON CONFLICT(id) DO NOTHING
`);

const deleteArtistsStmt = db.prepare(`DELETE FROM track_artists WHERE track_id = ?;`);
const insertArtistStmt = db.prepare(`INSERT INTO track_artists (track_id, artist_id, artist_name) VALUES (?, ?, ?);`);

const writeTrack = db.transaction((track: Track) => {
  upsertTrackStmt.run({
    $id: track.id,
    $etag: track.etag || null,
    $name: track.name,
    $source: track.source,
    $thumbnail: track.thumbnail,
    $duration: track.duration,
    $releasedDate: track.releasedDate,
    $index: track.index || null,
  });

  deleteArtistsStmt.run(track.id);

  for (const artist of track.artist) {
    insertArtistStmt.run(track.id, artist.id, artist.name);
  }
});

export const writeManyTracks = db.transaction((tracks: Track[]) => {
  for (const track of tracks) {
    writeTrack(track);
  }
});