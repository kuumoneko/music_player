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

const getTrackIdsFromBothSourcesStmt = db.prepare(`
  SELECT track_id FROM track_artists WHERE artist_id = ?
  UNION
  SELECT pt.track_id FROM playlist_tracks pt
  JOIN artists a2 ON a2.playlistId = pt.playlist_id WHERE a2.id = ?
`);

const linkTrackToArtistStmt = db.prepare(`INSERT OR IGNORE INTO track_artists (track_id, artist_id) VALUES (?, ?);`);

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

  const artistRow = getArtistStmt.get(id) as { id: string; name: string; source: MusicSource; thumbnail: string; playlistId: string; lastFetched: number | null; cacheTtl: number | null; etag: string | null } | null;
  if (!artistRow) return null;

  const artist: Artist = {
    id: artistRow.id,
    name: artistRow.name,
    source: artistRow.source,
    thumbnail: artistRow.thumbnail,
    playlistId: artistRow.playlistId,
    lastFetched: artistRow.lastFetched ?? undefined,
    cacheTtl: artistRow.cacheTtl ?? undefined,
    etag: artistRow.etag ?? undefined,
    tracks: [],
  };

  if (!artistRow.playlistId) return artist;

  const trackIdRows = getTrackIdsFromBothSourcesStmt.all(id, id) as { track_id: string }[];
  if (trackIdRows.length === 0) return artist;

  const trackIds = trackIdRows.map(r => r.track_id);
  const placeholders = trackIds.map(() => '?').join(',');

  const trackRows = db.prepare(
    `SELECT id, name, source, thumbnail, duration, releasedDate FROM tracks WHERE id IN (${placeholders}) ORDER BY releasedDate DESC`
  ).all(...trackIds) as { id: string; name: string; source: MusicSource; thumbnail: string; duration: number | null; releasedDate: string | null }[];

  const taRows = db.prepare(
    `SELECT ta.track_id, ta.artist_id, COALESCE(a.name, '') as artist_name FROM track_artists ta LEFT JOIN artists a ON ta.artist_id = a.id WHERE ta.track_id IN (${placeholders})`
  ).all(...trackIds) as { track_id: string; artist_id: string; artist_name: string }[];

  const taMap = new Map<string, { id: string; name: string }[]>();
  for (const ta of taRows) {
    let arr = taMap.get(ta.track_id);
    if (!arr) { arr = []; taMap.set(ta.track_id, arr); }
    arr.push({ id: ta.artist_id, name: ta.artist_name });
  }

  for (const tid of trackIds) {
    const arr = taMap.get(tid) || [];
    if (!arr.some(a => a.id === id)) {
      linkTrackToArtistStmt.run(tid, id);
      arr.push({ id, name: artistRow.name });
      taMap.set(tid, arr);
    }
  }

  for (const t of trackRows) {
    artist.tracks.push({
      id: t.id,
      name: t.name,
      source: t.source,
      thumbnail: t.thumbnail ?? "",
      duration: t.duration ?? 0,
      releasedDate: t.releasedDate ?? "",
      artist: taMap.get(t.id) || [],
    } as Track);
  }

  return artist;
}