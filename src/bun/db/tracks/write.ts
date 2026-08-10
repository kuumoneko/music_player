import db from "../setup.ts"
import type { Track } from "../../../shared/types.ts";

const upsertTrackStmt = db.prepare(`
  INSERT INTO tracks (
    id, name, source, thumbnail, duration, 
    releasedDate, youtubeTrackId, etag
  )
  VALUES (
    $id, $name, $source, $thumbnail, $duration, 
    $releasedDate, $youtubeTrackId, $etag
  )
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    source = excluded.source,
    thumbnail = excluded.thumbnail,
    duration = excluded.duration,
    releasedDate = excluded.releasedDate,
    youtubeTrackId = excluded.youtubeTrackId,
    etag = COALESCE(excluded.etag, tracks.etag)
`);

const deleteArtistsStmt = db.prepare(`DELETE FROM track_artists WHERE track_id = ?;`);
const insertArtistStmt = db.prepare(`INSERT INTO track_artists (track_id, artist_id) VALUES (?, ?);`);

const upsertArtistStmt = db.prepare(`
  INSERT INTO artists (id, name, source, thumbnail, playlistId)
  VALUES ($id, $name, $source, NULL, NULL)
  ON CONFLICT(id) DO UPDATE SET name = excluded.name, source = excluded.source;
`);

const writeTrack = db.transaction((track: Track) => {
  upsertTrackStmt.run({
    $id: track.id,
    $name: track.name,
    $source: track.source,
    $thumbnail: track.thumbnail,
    $duration: track.duration,
    $releasedDate: track.releasedDate,
    $youtubeTrackId: track.youtubeTrackId ?? null,
    $etag: track.etag ?? null,
  });

  deleteArtistsStmt.run(track.id);

  for (const artist of track.artist) {
    insertArtistStmt.run(track.id, artist.id);
    if (artist.id) {
      upsertArtistStmt.run({
        $id: artist.id,
        $name: artist.name || "Unknown Artist",
        $source: track.source,
      });
    }
  }
});

const writeTracks = db.transaction((tracks: Track[]) => {
  for (const track of tracks) {
    writeTrack(track);
  }
});

export default writeTracks