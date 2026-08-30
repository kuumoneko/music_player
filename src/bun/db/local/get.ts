import db from "../setup.ts"
import type { MusicSource, Track } from "../../../shared/types.ts";

interface LocalFileRow {
  id: string;
  name: string;
  source: MusicSource;
  thumbnail: string;
  duration: number;
  releasedDate: string;
  fileModifiedAt: number | null;
  youtubeTrackId: string | null;
  artists_json: string;
}

function mapRowToTrack(row: LocalFileRow): Track {
  let parsedArtists = JSON.parse(row.artists_json);

  parsedArtists = parsedArtists.filter((a: any) => a.id !== null);

  return {
    id: row.id,
    name: row.name,
    source: row.source,
    thumbnail: row.thumbnail,
    duration: row.duration,
    releasedDate: row.releasedDate,
    fileModifiedAt: row.fileModifiedAt ?? undefined,
    youtubeTrackId: row.youtubeTrackId ?? undefined,
    artist: parsedArtists
  };
}

const baseSelect = `
  SELECT 
    t.id, t.name, t.source, t.thumbnail, 
    t.duration, t.releasedDate, t.fileModifiedAt, t.youtubeTrackId,
    json_group_array(
      json_object('id', ta.artist_id, 'name', COALESCE(a.name, ''))
    ) as artists_json
  FROM tracks t
  LEFT JOIN track_artists ta ON t.id = ta.track_id
  LEFT JOIN artists a ON ta.artist_id = a.id
`;

const getAllLocalStmt = db.prepare(`
  ${baseSelect}
  WHERE t.source = 'local'
  GROUP BY t.id;
`);

const getLocalByIdStmt = db.prepare(`
  ${baseSelect}
  WHERE t.source = 'local' AND t.id = $id
  GROUP BY t.id;
`);

export function getAllLocalFiles(): Track[] {
  const results = getAllLocalStmt.all() as unknown as LocalFileRow[];
  return results.map(mapRowToTrack);
}

const getAllLocalIdsStmt = db.prepare(`SELECT id FROM tracks WHERE source = 'local';`);

export function getAllLocalFileIds(): string[] {
  const rows = getAllLocalIdsStmt.all() as { id: string }[];
  return rows.map(r => r.id);
}

export function getLocalFileById(id: string): Track | null {
  const row = getLocalByIdStmt.get({ $id: id }) as LocalFileRow | null;
  if (!row) return null;
  return mapRowToTrack(row);
}

const searchLocalStmt = db.prepare(`
  ${baseSelect}
  WHERE t.source = 'local' AND t.name LIKE $query
  GROUP BY t.id
  LIMIT 50;
`);

export function searchLocalFiles(query: string): Track[] {
  const results = searchLocalStmt.all({ $query: `%${query}%` }) as unknown as LocalFileRow[];
  return results.map(mapRowToTrack);
}