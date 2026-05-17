import db from "../setup.ts"
import type { Artist } from "../../../shared/types.ts";

const upsertArtistStmt = db.prepare(`
  INSERT INTO artists (id, name, source, thumbnail, playlistId)
  VALUES ($id,  $name, $source, $thumbnail, $playlistId)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    source = excluded.source,
    thumbnail = excluded.thumbnail,
    playlistId = excluded.playlistId;
`);

const writeArtist = db.transaction((artist: Artist) => {
  upsertArtistStmt.run({
    $id: artist.id,
    // $etag: artist.etag || null,
    $name: artist.name,
    $source: artist.source,
    $thumbnail: artist.thumbnail || null,
    $playlistId: artist.playlistId || null
  });
});

export default writeArtist