import db from "../setup.ts"
import type { Artist } from "../../../shared/types.ts";

const upsertArtistStmt = db.prepare(`
  INSERT INTO artists (id, name, source, thumbnail, playlistId, lastFetched, cacheTtl, etag)
  VALUES ($id, $name, $source, $thumbnail, $playlistId, $lastFetched, $cacheTtl, $etag)
  ON CONFLICT(id) DO UPDATE SET 
    name = excluded.name,
    source = excluded.source,
    thumbnail = excluded.thumbnail,
    playlistId = excluded.playlistId,
    lastFetched = excluded.lastFetched,
    cacheTtl = excluded.cacheTtl,
    etag = COALESCE(excluded.etag, artists.etag);
`);

const writeArtist = db.transaction((artist: Artist) => {
  upsertArtistStmt.run({
    $id: artist.id,
    $name: artist.name,
    $source: artist.source,
    $thumbnail: artist.thumbnail || null,
    $playlistId: artist.playlistId || null,
    $lastFetched: Date.now(),
    $cacheTtl: artist.cacheTtl ?? null,
    $etag: artist.etag ?? null
  });
});

export default writeArtist