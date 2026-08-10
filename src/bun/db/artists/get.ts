import db from "../setup.ts"
import type { Artist, MusicSource, Track } from "../../../shared/types.ts";

const getArtistStmt = db.prepare(`
  SELECT id, name, source, thumbnail, playlistId, lastFetched, cacheTtl, etag
  FROM artists WHERE id = ?;
`);

const getArtistByPlaylistIdStmt = db.prepare(`
  SELECT id, name, source, thumbnail, playlistId, lastFetched, cacheTtl, etag
  FROM artists WHERE playlistId = ?;
`);

const getArtistWithTracksStmt = db.prepare(`
  SELECT 
    a.id, a.name, a.source, a.thumbnail, a.playlistId, a.lastFetched, a.cacheTtl, a.etag,
    t.id as track_id, t.name as track_name, t.source as track_source,
    t.thumbnail as track_thumbnail, t.duration, t.releasedDate,
    json_group_array(
      json_object('id', ta2.artist_id, 'name', COALESCE(a2.name, ''))
    ) as track_artists_json
  FROM artists a
  LEFT JOIN track_artists ta ON a.id = ta.artist_id
  LEFT JOIN tracks t ON ta.track_id = t.id
  LEFT JOIN track_artists ta2 ON t.id = ta2.track_id
  LEFT JOIN artists a2 ON ta2.artist_id = a2.id
  WHERE a.id = $id
  GROUP BY t.id, a.id;
`);

export function getArtistByPlaylistId(playlistId: string): Artist | null {
  const row = getArtistByPlaylistIdStmt.get(playlistId) as { id: string; name: string; source: MusicSource; thumbnail: string; playlistId: string; lastFetched: number | null; cacheTtl: number | null; etag: string | null } | null;
  if (!row) return null;
  return { id: row.id, name: row.name, source: row.source, thumbnail: row.thumbnail, playlistId: row.playlistId, tracks: [], lastFetched: row.lastFetched ?? undefined, cacheTtl: row.cacheTtl ?? undefined, etag: row.etag ?? undefined };
}

export default function getArtistById(id: string, includeTracks: boolean = true): Artist | null {
  if (!includeTracks) {
    const row = getArtistStmt.get(id) as { id: string; name: string; source: MusicSource; thumbnail: string; playlistId: string; lastFetched: number | null; cacheTtl: number | null; etag: string | null } | null;
    if (!row) return null;
    return { id: row.id, name: row.name, source: row.source, thumbnail: row.thumbnail, playlistId: row.playlistId, tracks: [], lastFetched: row.lastFetched ?? undefined, cacheTtl: row.cacheTtl ?? undefined, etag: row.etag ?? undefined };
  }

  const rows = getArtistWithTracksStmt.all({ $id: id }) as {
    id: string, name: string, source: MusicSource,
    playlistId: string, thumbnail: string, lastFetched: number | null, cacheTtl: number | null, etag: string | null,
    track_id: string | null, track_name: string | null,
    track_source: MusicSource | null, track_thumbnail: string | null,
    duration: number | null, releasedDate: string | null,
    track_artists_json: string,
  }[];

  if (!rows || rows.length === 0) return null;

  const artist: Artist = {
    id: rows[0].id,
    name: rows[0].name,
    source: rows[0].source,
    thumbnail: rows[0].thumbnail,
    playlistId: rows[0].playlistId,
    lastFetched: rows[0].lastFetched ?? undefined,
    cacheTtl: rows[0].cacheTtl ?? undefined,
    etag: rows[0].etag ?? undefined,
    tracks: [],
  };

  for (const row of rows) {
    if (!row.track_id) continue;
    let parsedArtists = JSON.parse(row.track_artists_json);
    parsedArtists = parsedArtists.filter((a: any) => a.id !== null);
    artist.tracks.push({
      id: row.track_id,
      name: row.track_name ?? "",
      source: row.track_source,
      thumbnail: row.track_thumbnail ?? "",
      duration: row.duration ?? 0,
      releasedDate: row.releasedDate ?? "",
      artist: parsedArtists,
    } as Track);
  }

  return artist;
}